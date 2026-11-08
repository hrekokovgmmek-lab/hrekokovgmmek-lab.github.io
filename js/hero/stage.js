// Сцена героя: один WebGL на всю страницу. Порядок кадра: жидкость → клетки поля → фон (+ портрет, если есть фото).
// Числа — config hero.tuning.
import * as THREE from '/vendor/three-0.185.1/three.module.min.js';
import { BG_VERT, FULL_VERT, CELLS_FRAG, BG_FRAG } from '/js/hero/glsl.js';
import { Fluid } from '/js/hero/fluid.js';
import { glyphAtlas, drawHeadline, drawYears, drawIntroText } from '/js/hero/canvases.js';
import { createHud } from '/js/hero/hud.js';
import { pickPalette, paletteBytes, rgb01, atmoOf } from '/js/hero/palettes.js';

THREE.ColorManagement.enabled = false;

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const mix = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
// Часы ударов: разгон (парабола на первых 40 %) и торможение (на последних 40 %), сшитые с прямой той же скорости.
const A = 0.4, V = 1 / (1 - A / 2);
const easeIn = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u < A ? (V * u * u) / (2 * A) : V * (u - A / 2));
const easeOut = (u) => 1 - easeIn(1 - u);

/** Рамка портрета: какую часть фото (доли высоты сверху) видно по высоте холста. */
export function framing(W, H, svh, T) {
  const ph = T.phone;
  if (W <= ph.breakpoint) {
    const perPx = ph.perPxFactor / W;
    let top = ph.hairTopV - Math.max(ph.hairTopScreen * svh, ph.minTopPx) * perPx;
    top = Math.min(top, 0.96 - svh * perPx);
    return { top, bottom: top + H * perPx, phone: true };
  }
  return { top: T.cropDesktop[0], bottom: T.cropDesktop[1], phone: false };
}

export async function createStage(canvas, S) {
  const cfg = S.cfg, T = cfg.hero.tuning, F = T.fluid;
  const pal = pickPalette(cfg.theme);
  if (pal.name !== 'config') applyTokens(pal);
  const atmo = atmoOf(pal);
  const root = document.documentElement;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.autoClear = true;
  renderer.setClearColor(new THREE.Color().setRGB(...rgb01(pal.ink)), 1);

  let W = 0, H = 0, dpr = 1, frame0 = null;
  const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  // ---- проход клеток ----
  const cellsScene = new THREE.Scene();
  const CU = {
    uCellPx: { value: new THREE.Vector2(T.field.cell[0], T.field.cell[1]) }, uScale: { value: T.field.scalePx },
    uTime: { value: 0 }, uLevels: { value: T.field.levels }, uSwirl: { value: new THREE.Vector3(0, 0, 0) },
    uSwirlSigma2: { value: T.field.swirlSigma2 }, uSwirlAmt: { value: T.field.swirlAmt },
  };
  const cellsMat = new THREE.ShaderMaterial({ vertexShader: FULL_VERT, fragmentShader: CELLS_FRAG, uniforms: CU, depthTest: false, depthWrite: false });
  const cellsQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), cellsMat);
  cellsQuad.frustumCulled = false; cellsScene.add(cellsQuad);
  let cellsRT = null;

  // ---- текстуры ----
  const palTex = new THREE.DataTexture(paletteBytes(pal), 256, 1, THREE.RGBAFormat);
  palTex.wrapS = THREE.RepeatWrapping; palTex.magFilter = palTex.minFilter = THREE.LinearFilter; palTex.needsUpdate = true;
  let glyphTex = null;
  const headCanvas = document.createElement('canvas');
  const headTex = new THREE.CanvasTexture(headCanvas);
  headTex.minFilter = headTex.magFilter = THREE.LinearFilter; headTex.generateMipmaps = false;
  const blank = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1, THREE.RGBAFormat); blank.needsUpdate = true;
  const yearCanvas = document.createElement('canvas');
  const yearTex = new THREE.CanvasTexture(yearCanvas);
  yearTex.minFilter = yearTex.magFilter = THREE.LinearFilter; yearTex.generateMipmaps = false;
  const years = { a: null, b: null, w: 0, h: 0 };

  // ---- фон ----
  const U = {
    uRes: { value: new THREE.Vector2(1, 1) }, uDpr: { value: 1 }, uTime: { value: 0 },
    uCells: { value: blank }, uCellsSize: { value: new THREE.Vector2(1, 1) }, uCellPx: CU.uCellPx,
    uGlyph: { value: blank }, uPal: { value: palTex }, uPalFreq: { value: 1.6 }, uPalDrift: { value: 0.025 },
    uStudio: { value: new THREE.Vector3(...rgb01(pal.studio)) }, uInk: { value: new THREE.Vector3(...rgb01(pal.ink)) },
    uGridPx: { value: T.field.gridPx }, uGridAmt: { value: 0.05 }, uBitHz: { value: T.field.bitHz },
    uLineK: { value: new THREE.Vector4(0.34, 0.24, atmo.lineDark, 0.3) }, uBoost: { value: 0 }, uDim: { value: 0 },
    uAtmo: { value: new THREE.Vector4(atmo.grain, atmo.vignette, atmo.glow, atmo.glowR) },
    uGlowCol: { value: new THREE.Vector3(...rgb01(atmo.glowCol)) }, uGlowPos: { value: new THREE.Vector3(0, 0, 0) },
    uPaperEdge: { value: new THREE.Vector3(...rgb01(atmo.paperEdge)) },
    uHead: { value: headTex }, uTextL: { value: 0 }, uTextR: { value: 0 },
    uRim: { value: new THREE.Vector4(...T.mask.codeRim) }, uCodeHz: { value: T.mask.codeHz }, uCodeAmt: { value: 1 },
    uBottomFill: { value: new THREE.Vector3(0, 0, 16 / 255) }, uBottomX: { value: new THREE.Vector2(0, 0) },
    uDye: { value: blank }, uDyeOn: { value: 0 }, uInkCut: { value: new THREE.Vector2(...T.mask.inkCut) },
    uSeamX: { value: 0 }, uSplit: { value: -0.02 }, uBand: { value: new THREE.Vector4(0, 0, 0, 0) },
    uYear: { value: yearTex }, uYearMix: { value: 0 }, uYearOn: { value: 0 },
    uIntro: { value: new THREE.Vector4(0, 0, 0, 0) },
    uIntroText: { value: blank }, uIntroTextAmt: { value: 0 },
  };
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(T.fovDeg, 1, 0.002, 100);
  const bgMat = new THREE.ShaderMaterial({ vertexShader: BG_VERT, fragmentShader: BG_FRAG, uniforms: U, depthTest: false, depthWrite: false });
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), bgMat);
  bg.frustumCulled = false; bg.renderOrder = -1; scene.add(bg);

  // ---- жидкость ----
  const fluid = S.motion ? new Fluid(renderer, F) : null;

  // ---- портрет (если есть фото) ----
  let portrait = null;
  if (cfg.hero.assets.face && cfg.hero.assets.depth) {
    try {
      const mod = await import('/js/hero/portrait.js');
      portrait = await mod.createPortrait({ THREE, scene, camera, U, cfg, S });
    } catch (e) { console.warn('портрет не загрузился', e); portrait = null; }
  }

  const hudCanvas = document.getElementById('hud');
  const hud = hudCanvas && S.motion ? createHud(hudCanvas, S) : null;

  // ---- указатель ----
  const ptr = { x: 0, y: 0, px: 0, py: 0, has: false, moved: false, last: -1e9, speed: 0, touchUntil: 0 };
  const flowers = [];
  addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    ptr.x = e.clientX; ptr.y = e.clientY;
    if (!ptr.has) { ptr.px = ptr.x; ptr.py = ptr.y; ptr.has = true; }
    ptr.moved = true; ptr.last = performance.now();
  }, { passive: true });
  document.documentElement.addEventListener('mouseleave', () => { ptr.has = false; });
  addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch' && S.motion) flowers.push([e.clientX, e.clientY]);
  }, { passive: true });

  // ---- геометрия кадра и заголовок ----
  const face = { seamX: 0, eyeY: 0, faceHalf: 0, hairTopY: 0, bottomY: 0, x0: 0, x1: 0 };
  function measureFace() {
    const fr = framing(W, H, S.svh, T);
    const span = fr.bottom - fr.top, photoPx = H / span; // высота фото в CSS px
    const yOf = (v) => (v - fr.top) * photoPx;
    const wPx = photoPx * 0.75;
    if (portrait) Object.assign(face, portrait.faceScreen(W, H)); else {
      face.seamX = W / 2; face.eyeY = yOf(0.414); face.faceHalf = photoPx * 0.1375;
      face.hairTopY = yOf(T.phone.hairTopV);
    }
    face.bottomY = yOf(1); face.x0 = W / 2 - wPx / 2; face.x1 = W / 2 + wPx / 2;
    face.phone = fr.phone;
  }
  function headline() {
    const lang = root.dataset.lang || cfg.langs[0];
    const hl = cfg.hero.headline;
    const left = hl.left[lang] || hl.left[cfg.langs[0]] || hl.left, right = hl.right[lang] || hl.right[cfg.langs[0]] || hl.right;
    const w0 = headCanvas.width, h0 = headCanvas.height;
    drawHeadline(headCanvas, { W, H, dpr: U.uDpr.value, seamX: face.seamX, eyeY: face.eyeY, faceHalf: face.faceHalf, left, right,
      phone: face.phone, hairTopY: face.hairTopY, gutter: 20 });
    if (w0 !== headCanvas.width || h0 !== headCanvas.height) headTex.dispose(); // новый размер — новая текстура, а не подзагрузка
    headTex.needsUpdate = true;
  }

  function resize() {
    W = canvas.clientWidth || innerWidth; H = canvas.clientHeight || innerHeight;
    const phone = W <= T.phone.breakpoint;
    dpr = Math.min(devicePixelRatio || 1, phone ? T.dprMax.phone : T.dprMax.desktop);
    renderer.setPixelRatio(dpr);
    renderer.setSize(W, H, false);
    U.uRes.value.set(W, H); U.uDpr.value = renderer.getPixelRatio();
    const cols = Math.ceil(W / T.field.cell[0]) + 1, rows = Math.ceil(H / T.field.cell[1]) + 1;
    if (!cellsRT || cellsRT.width !== cols || cellsRT.height !== rows) {
      cellsRT?.dispose();
      cellsRT = new THREE.WebGLRenderTarget(cols, rows, { type: THREE.HalfFloatType, format: THREE.RGBAFormat,
        minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false, generateMipmaps: false });
      U.uCells.value = cellsRT.texture; U.uCellsSize.value.set(cols, rows);
    }
    glyphTex?.dispose();
    glyphTex = new THREE.CanvasTexture(glyphAtlas(U.uDpr.value, T.field.cell));
    glyphTex.minFilter = glyphTex.magFilter = THREE.LinearFilter; glyphTex.generateMipmaps = false;
    U.uGlyph.value = glyphTex;
    fluid?.resize(W, H);
    portrait?.resize(W, H, S.svh);
    camera.aspect = W / H; camera.updateProjectionMatrix();
    measureFace();
    headline();
    U.uBottomX.value.set(face.x0, face.x1);
  }
  resize();
  addEventListener('resize', resize);
  // прогрев: картинки портрета — в видеокарту, шейдеры — собрать сейчас, а не в первом кадре входа
  try {
    for (const tex of portrait?.textures || []) renderer.initTexture(tex);
    renderer.compile(scene, camera); renderer.compile(cellsScene, ortho);
  } catch (e) { /* старые three без compile — не страшно */ }
  addEventListener('langchange', headline);
  document.fonts?.ready.then(() => { resize(); });
  document.fonts?.load('850 100px "Roboto Flex"').then(headline).catch(() => {});

  // ---- вход на сайт: на фоне из 0 и 1 — домен, потом он растворяется и плавно проявляется портрет ----
  const INTRO = { textIn: 0.5, textHold: 1.0, textOut: 1.1, appearFrom: 1.0, appear: 1.6, end: 2.8 };
  let introOn = S.motion && !location.hash && S.P < 0.02 && !!portrait;
  let introT0 = null, introClock = 0, steady = 0, waitT0 = null;
  const introCanvas = document.createElement('canvas');
  const introTex = new THREE.CanvasTexture(introCanvas);
  introTex.minFilter = introTex.magFilter = THREE.LinearFilter; introTex.generateMipmaps = false;
  function introText() {
    const w0 = introCanvas.width, h0 = introCanvas.height;
    drawIntroText(introCanvas, { W, H, text: String(cfg.domain || 'artemvartanov.com').toUpperCase() });
    if (w0 !== introCanvas.width || h0 !== introCanvas.height) introTex.dispose();
    introTex.needsUpdate = true;
    U.uIntroText.value = introTex;
  }
  if (introOn) { root.classList.add('intro'); S.introDelay = INTRO.end; } else root.classList.remove('intro');
  const ease = (u) => 0.5 - 0.5 * Math.cos(Math.PI * clamp01(u));
  function introStep(t) {
    if (!introOn) { S.introAppear = 1; U.uIntroTextAmt.value = 0; U.uIntro.value.w = 0; return; }
    if (introT0 === null) {
      // ждём, пока кадры пойдут ровно (3 подряд быстрее 25 мс) или 1,5 с — что раньше
      if (waitT0 === null) waitT0 = t;
      steady = lastDt < 0.025 ? steady + 1 : 0;
      if (steady < 3 && t - waitT0 < 1.5) { S.introAppear = 0; U.uIntroTextAmt.value = 0; return; }
      introT0 = t; dispatchEvent(new Event('introstart'));
    }
    introClock += Math.min(lastDt, 1 / 30);
    let it = introClock;
    if (S.P > 0.01) it = INTRO.end; // начал листать — вход сразу заканчивается
    S.introAppear = ease((it - INTRO.appearFrom) / INTRO.appear);
    if (it >= INTRO.end) { introOn = false; S.introAppear = 1; U.uIntroTextAmt.value = 0; root.classList.remove('intro'); }
  }

  // ---- кадр ----
  let tPrev = 0, frames = 0, lastP = -1;
  const swirl = { x: 0, y: 0, k: 0 };
  let lastDt = 1;
  function frame(t, dt) {
    lastDt = dt;
    const P = S.P;
    const coarse = !S.fine;
    if (!S.motion) { // без движения: статичный кадр, перерисовка только при изменении
      if (frames > 2 && Math.abs(P - lastP) < 1e-4) return;
      t = 30;
    }
    lastP = P;
    const f = Math.min(2, Math.max(0.001, dt * 60));
    U.uTime.value = t; CU.uTime.value = t;

    // удары прокрутки
    const B = T.beats;
    const rise = easeIn(clamp01((P - B[0]) / (B[1] - B[0])));
    const sweep = clamp01((P - B[1]) / (B[2] - B[1]));
    const burn = easeOut(clamp01((P - B[2]) / (B[3] - B[2])));
    const hiddenBottom = Math.max(0, (H - S.svh) / H);
    const splitStart = (hiddenBottom + 0.04 - 0.055) / 1.3;
    U.uSplit.value = mix(splitStart, 0.82, rise);
    U.uSeamX.value = mix(face.seamX, -18, sweep);
    const fade = 1 - smooth(0.35, 0.6, sweep);
    U.uTextL.value = smooth(0.01, 0.17, P) * fade;
    U.uTextR.value = fade * (rise > 0 ? 1 : 0);
    U.uBoost.value = burn * (1 - smooth(0.86, 1, P));
    U.uDim.value = S.storyDim || 0;
    U.uCodeAmt.value = P < 0.995 ? 1 : 0;
    U.uBottomFill.value.x = H - face.bottomY;
    U.uBottomFill.value.y = portrait && P < 0.995 ? 1 : 0;

    // жидкость: мазки только пока виден герой
    const heroOn = P < 0.995;
    if (fluid) {
      if (ptr.moved) {
        const dx = ptr.x - ptr.px, dy = ptr.y - ptr.py, dist = Math.hypot(dx, dy);
        if (heroOn && dist > 0.5) {
          const steps = Math.min(F.maxSteps, Math.max(1, Math.ceil(dist / F.stepPx)));
          const thick = 0.45 + 0.55 * clamp01(dist / f / 24);
          const dir = [dx / dist, -dy / dist];
          for (let i = 1; i <= steps; i++) {
            const k = i / steps, x = ptr.px + dx * k, y = ptr.py + dy * k;
            fluid.splat(x / W, 1 - y / H, (dx / W) * F.force / steps, (-dy / H) * F.force / steps, dir, thick);
          }
        }
        ptr.speed = Math.min(1, ptr.speed * 0.6 + dist / 60);
        ptr.px = ptr.x; ptr.py = ptr.y; ptr.moved = false;
      }
      while (flowers.length) {
        const [x, y] = flowers.shift();
        if (P > 0.3) continue;
        for (let i = 0; i < 9; i++) {
          const a = (i / 9) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
          fluid.splat((x + c * 10) / W, 1 - (y + s * 10) / H, (c * 220) / W, (-s * 220) / H, [c, -s], 3, 1.1);
        }
        ptr.touchUntil = t + 78 / 60;
      }
      if (coarse) fluid.step(1, F.fadeTouch); else fluid.step(f, F.fade);
      U.uDye.value = fluid.texture;
      U.uDyeOn.value = fluid.asleep ? 0 : 1;
    }
    ptr.speed *= Math.pow(0.92, f);

    // закрутка: курсор; без курсора — между глаз портрета, после героя — нигде
    let tx = face.seamX, ty = H - face.eyeY, tk = heroOn ? 1 : 0;
    if (ptr.has && S.fine) { tx = ptr.x; ty = H - ptr.y; tk = 1; }
    const e = 1 - Math.pow(0.88, f);
    swirl.x = mix(swirl.x, tx, e); swirl.y = mix(swirl.y, ty, e); swirl.k = mix(swirl.k, tk, e);
    CU.uSwirl.value.set(swirl.x, swirl.y, swirl.k);
    // тёплый свет — там же, где закрутка; без курсора после героя — по центру, слабее
    const gk = ptr.has && S.fine ? 1 : heroOn ? 0.8 : 0.55;
    if (!(ptr.has && S.fine) && !heroOn) { swirl.gx = mix(swirl.gx ?? W / 2, W / 2, e); swirl.gy = mix(swirl.gy ?? H / 2, H * 0.55, e); }
    else { swirl.gx = swirl.x; swirl.gy = swirl.y; }
    U.uGlowPos.value.set(swirl.gx, swirl.gy, gk);

    // год за лентой (только широкий экран): пара соседних лет и доля перехода от истории
    const yv = W > 760 ? (S.storyVis || 0) : 0;
    U.uYearOn.value = yv;
    if (yv > 0.001 && S.storyYears) {
      const pos = Math.max(0, S.storyPos || 0), lo = Math.min(S.storyYears.length - 1, Math.floor(pos));
      const a = S.storyYears[lo], b = S.storyYears[Math.min(S.storyYears.length - 1, lo + 1)];
      const target = clamp01(pos - lo); // слайд уже сглажен — год меняется ровно за время переезда
      let jump = false;
      if (a !== years.a || b !== years.b || years.w !== W || years.h !== H) {
        const w0 = yearCanvas.width, h0 = yearCanvas.height;
        drawYears(yearCanvas, { W, H, dpr: 1, a, b });
        if (w0 !== yearCanvas.width || h0 !== yearCanvas.height) yearTex.dispose();
        yearTex.needsUpdate = true;
        Object.assign(years, { a, b, w: W, h: H });
        jump = true; // новая пара лет: переход начинается с нуля, без сглаживания назад
      }
      // сглаживание по времени: шаги колеса и рывки прокрутки не дёргают волну
      U.uYearMix.value = jump ? target : mix(U.uYearMix.value, target, 1 - Math.pow(0.86, f));
    }

    introStep(t);
    portrait?.frame({ t, dt, f, P, rise, sweep, burn, ptr, W, H, S });
    if (hud && portrait) hud.draw({ t, P, rise, ptr, points: P < T.beats[1] ? portrait.tracked() : [], scanning: S.scanning, beats: T.beats });

    renderer.setRenderTarget(cellsRT);
    renderer.render(cellsScene, ortho);
    renderer.setRenderTarget(null);
    renderer.render(scene, camera);
    frames++;
    if (frames === 1 && frame0) frame0();
    tPrev = t;
  }

  function goodbye() { renderer.dispose(); }
  return {
    frame, resize, goodbye, fluid, U, face, renderer,
    set onFirstFrame(fn) { frame0 = fn; },
    get passes() { return fluid ? fluid.passes : 0; },
    palette: pal.name,
    get introMs() { return introOn ? (INTRO.appearFrom + 0.8) * 1000 : 0; },
  };
}

function applyTokens(p) {
  const r = document.documentElement.style;
  for (const k of ['studio', 'ink', 'paper', 'soft', 'line', 'signal']) if (p[k]) r.setProperty('--' + k, p[k]);
}
