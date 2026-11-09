// 3D-портрет: фото на сетке 200×300, выдавленное картой глубины; машина открывается той же маской, что и фон.
// Глаза-линзы к курсору, голубое свечение, призрак и сканирование в покое, распад снизу вверх.
import { NOISE, MASK, ATMO } from '/js/hero/glsl.js';
import { framing } from '/js/hero/stage.js';

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const mix = (a, b, t) => a + (b - a) * t;

const VERT = /* glsl */`
uniform sampler2D uDepth; uniform float uDepthK;
varying vec2 vUv;
void main() {
  vUv = uv;
  vec3 p = position;
  p.z += texture2D(uDepth, uv).r * uDepthK;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;

const FRAG = /* glsl */`
uniform sampler2D uFace; uniform sampler2D uMachine; uniform float uHasMachine;
uniform vec2 uTexSize; uniform float uImgAspect;
uniform vec4 uEyes; uniform vec2 uLook; uniform float uEyeR; uniform vec3 uGlow;
uniform vec2 uCut; uniform float uChinV; uniform float uShirtK;
uniform float uScan; uniform float uGhost;
uniform float uBurn; uniform vec2 uBurnRange; uniform float uAppear; uniform float uFaceK;
uniform sampler2D uCells; uniform vec2 uCellsSize; uniform vec2 uCellPx;
uniform sampler2D uGlyph; uniform sampler2D uPal; uniform float uPalFreq; uniform float uPalDrift;
uniform vec4 uRim; uniform float uCodeHz; uniform float uCodeAmt;
uniform vec4 uAtmo; uniform vec3 uGlowCol; uniform vec3 uGlowPos; uniform vec3 uPaperEdge;
varying vec2 vUv;
${NOISE}
${MASK}
${ATMO}
vec3 pal(float n, float x) { return texture2D(uPal, vec2(fract(uPalFreq * n + uPalDrift * uTime + x / 2400.0), 0.5)).rgb; }
float glyphAt(vec2 cell, vec2 local, float hz, float seed) {
  float h = hash12(cell + seed);
  float bit = step(0.5, hash12(cell + seed * 1.7 + floor(uTime * hz + h * 17.0)));
  return texture2D(uGlyph, vec2((bit + local.x) * 0.5, local.y)).a;
}
float lum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
// линза: внутри радиуса вокруг зрачка картинка машины сдвигается к курсору, сильнее в центре
vec2 lensUv(vec2 uv, vec2 eye) {
  vec2 d = (uv - eye) * vec2(uImgAspect, 1.0);
  float r = length(d) / uEyeR;
  float w = r < 1.0 ? (1.0 - r) * (1.0 - r) : 0.0;
  return uv - uLook * w;
}
vec4 machineAt(vec2 uv) {
  if (uHasMachine < 0.5) { vec4 f = texture2D(uFace, uv); return vec4(f.rgb * vec3(0.18, 0.2, 0.24), f.a); }
  return texture2D(uMachine, uv);
}
void main() {
  vec2 css = gl_FragCoord.xy / uDpr;
  vec2 suv = gl_FragCoord.xy / (uRes * uDpr);
  vec4 face = texture2D(uFace, vUv);
  face.rgb *= uFaceK; // яркость фото (config hero.tuning.faceBrightness)
  float m = maskAt(css, suv);
  // машина: линзы, отсечка снизу, футболка ниже подбородка
  vec2 muv = lensUv(lensUv(vUv, uEyes.xy), uEyes.zw);
  vec4 mc = machineAt(muv);
  float cut = smoothstep(uCut.x, uCut.y, vUv.y);
  mc.a *= cut;
  vec4 shirt = vec4(face.rgb * uShirtK, face.a * step(vUv.y, uChinV));
  vec4 mach = vec4(mix(shirt.rgb, mc.rgb, mc.a), max(mc.a, shirt.a));
  // свечение глаз с пульсом
  float pulse = 0.55 + 0.15 * sin(uTime * 3.0);
  for (int i = 0; i < 2; i++) {
    vec2 e = i == 0 ? uEyes.xy : uEyes.zw;
    vec2 d = (vUv - e) * vec2(uImgAspect, 1.0);
    float g = exp(-dot(d, d) / pow(0.6 * uEyeR, 2.0));
    mach.rgb += uGlow * g * pulse * mc.a;
  }
  // призрак машины и полоса сканирования (только на фото)
  vec3 col = face.rgb;
  if (uScan > -0.5) {
    vec2 tx = vec2(2.2) / uTexSize;
    float L0 = lum(machineAt(vUv + vec2(tx.x, 0.0)).rgb) - lum(machineAt(vUv - vec2(tx.x, 0.0)).rgb);
    float L1 = lum(machineAt(vUv + vec2(0.0, tx.y)).rgb) - lum(machineAt(vUv - vec2(0.0, tx.y)).rgb);
    float edge = smoothstep(0.04, 0.13, abs(L0) + abs(L1)) * mc.a;
    float vTop = 1.0 - vUv.y;
    float band = mix(-0.12, 1.12, uScan) + sin(vUv.x * 3.14159) * 0.05;
    float d = vTop - band;
    float core = exp(-d * d / 0.0045);
    float trail = d < 0.0 ? exp(d * 9.0) : 0.0;
    float k = edge * (core * 0.32 + trail * 0.14) + uGhost * edge;
    col = mix(col, mc.rgb, 0.06 * core * mc.a);
    vec3 scr = vec3(0.92, 0.98, 1.0) * k;
    col = 1.0 - (1.0 - col) * (1.0 - scr);
  }
  vec4 outc = vec4(mix(col, mach.rgb, m), mix(face.a, mach.a, m));
  // кромка из кода — та же, что у фона
  vec2 cell = floor(css / uCellPx), local = fract(css / uCellPx);
  float ink = inkAt(suv);
  float rim = max(smoothstep(uRim.x, uRim.y, ink) * (1.0 - smoothstep(uRim.z, uRim.w, ink)) * uCodeAmt, introRim(css));
  if (rim > 0.001) {
    float n = texture2D(uCells, (cell + 0.5) / uCellsSize).r;
    outc.rgb = mix(outc.rgb, pal(n, css.x), rim * glyphAt(cell, local, uCodeHz, 3.1) * outc.a);
  }
  // распад снизу вверх с радужной кромкой
  if (uBurn > 0.0) {
    float q = fbm(vUv * 6.0) * 0.75 + vUv.y * 0.45;
    float T = mix(uBurnRange.x, uBurnRange.y, uBurn);
    if (q < T) discard;
    float e = 1.0 - smoothstep(0.0, 0.035, q - T);
    outc.rgb = mix(outc.rgb, pal(q * 2.0 + uTime * 0.15, css.x) * 1.2, e);
  }
  // вход на сайт: портрет проявляется снизу вверх мягкой волной с лёгким разбросом по клеткам
  if (uAppear < 0.999) {
    float th = (1.0 - vUv.y) * 0.92 + vnoise(css / 90.0 + uTime * 0.3) * 0.08;
    outc.a *= smoothstep(th - 0.3, th + 0.3, uAppear * 1.6 - 0.3);
  }
  // плечи обрезаны краями снимка — мягко гасим полосу у левого и правого края, без ровного среза
  outc.a *= smoothstep(0.0, 0.09, vUv.x) * smoothstep(1.0, 0.91, vUv.x);
  if (outc.a < 0.01) discard;
  vec3 lt = outc.rgb, dk = outc.rgb;
  atmosphere(lt, dk, css, suv);
  outc.rgb = mix(lt, dk, m) + grain(css) * uAtmo.x;
  gl_FragColor = outc;
}`;

function loadTex(THREE, url) {
  return new Promise((res, rej) => new THREE.TextureLoader().load(url, (t) => {
    t.colorSpace = THREE.NoColorSpace; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
    t.anisotropy = 4; res(t);
  }, undefined, rej));
}
function loadImageData(url) {
  return new Promise((res, rej) => {
    const im = new Image(); im.onload = () => {
      const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
      const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0);
      res(g.getImageData(0, 0, c.width, c.height));
    }; im.onerror = rej; im.src = url;
  });
}

export async function createPortrait({ THREE, scene, camera, U, cfg, S }) {
  const T = cfg.hero.tuning, A = cfg.hero.assets;
  const pts = cfg.hero.points || {};
  const [face, depth, machine, depthData] = await Promise.all([
    loadTex(THREE, A.face), loadTex(THREE, A.depth), A.machine ? loadTex(THREE, A.machine).catch(() => null) : null,
    loadImageData(A.depth).catch(() => null),
  ]);
  const iw = face.image.width, ih = face.image.height, aspect = iw / ih;
  const PW = 2 * aspect;
  const P = (i) => pts[i] || null;
  const eyeR = P(468), eyeL = P(473), chin = P(152);
  const depthAt = (u, v) => {
    if (!depthData) return 0.5;
    const x = Math.min(depthData.width - 1, Math.max(0, Math.round(u * (depthData.width - 1))));
    const y = Math.min(depthData.height - 1, Math.max(0, Math.round(v * (depthData.height - 1))));
    return depthData.data[(y * depthData.width + x) * 4] / 255;
  };
  const world = (u, v) => new THREE.Vector3((u - 0.5) * PW, 1 - 2 * v, depthAt(u, v) * T.depthStrength);

  // поворот вокруг центра головы (уровень глаз, середина объёма)
  const eyeV = eyeR && eyeL ? (eyeR[1] + eyeL[1]) / 2 : 0.414;
  const pivot = new THREE.Group();
  pivot.position.set(0, 1 - 2 * eyeV, 0.11);
  scene.add(pivot);

  const UP = {
    uDepth: { value: depth }, uDepthK: { value: T.depthStrength },
    uFace: { value: face }, uMachine: { value: machine || face }, uHasMachine: { value: machine ? 1 : 0 },
    uTexSize: { value: new THREE.Vector2(iw, ih) }, uImgAspect: { value: aspect },
    uEyes: { value: new THREE.Vector4(eyeR ? eyeR[0] : 0.44, eyeR ? 1 - eyeR[1] : 0.586, eyeL ? eyeL[0] : 0.56, eyeL ? 1 - eyeL[1] : 0.586) },
    uLook: { value: new THREE.Vector2() }, uEyeR: { value: T.eyes.radius }, uGlow: { value: new THREE.Vector3(...T.eyes.glow) },
    uCut: { value: new THREE.Vector2(T.machineCutV, T.machineCutV + 0.036) },
    uChinV: { value: chin ? 1 - (chin[1] + 0.012) : 0.33 }, uShirtK: { value: 0.22 },
    uScan: { value: -1 }, uGhost: { value: 0 }, uBurn: { value: 0 }, uAppear: { value: 1 }, uFaceK: { value: T.faceBrightness ?? 1 }, uBurnRange: { value: new THREE.Vector2(T.dissolve.from, T.dissolve.to) },
  };
  const uniforms = { ...U, ...UP };
  const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms, transparent: true, depthTest: true, depthWrite: true });
  const geo = new THREE.PlaneGeometry(PW, 2, T.planeSegments[0], T.planeSegments[1]);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(-pivot.position.x, -pivot.position.y, -pivot.position.z);
  pivot.add(mesh);

  // мягкая тень сзади: размытый силуэт на фоне (не поворачивается с головой), видна только на светлом
  let shadowMesh = null;
  if (A.shadow) {
    const st = await loadTex(THREE, A.shadow).catch(() => null);
    if (st) {
      const sm = new THREE.ShaderMaterial({
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: `uniform sampler2D uShadow; uniform float uShadowK; uniform vec3 uShadowCol; varying vec2 vUv;
          ${NOISE}
          ${MASK}
          void main() {
            vec2 css = gl_FragCoord.xy / uDpr; vec2 suv = gl_FragCoord.xy / (uRes * uDpr);
            float a = texture2D(uShadow, vUv).r * uShadowK * (1.0 - maskAt(css, suv));
            // внизу тень доходит до краёв снимка: там футболка уже гаснет (9 % ширины), и тень лежала бы серой полосой
            // с ровным срезом — гасим её у краёв раньше футболки
            a *= smoothstep(0.05, 0.2, vUv.x) * smoothstep(0.95, 0.8, vUv.x);
            if (a < 0.003) discard;
            gl_FragColor = vec4(uShadowCol, a);
          }`,
        uniforms: { ...U, uShadow: { value: st }, uShadowK: { value: T.backShadow ?? 0.28 }, uShadowCol: { value: new THREE.Vector3(58 / 255, 46 / 255, 34 / 255) } },
        transparent: true, depthTest: false, depthWrite: false,
      });
      shadowMesh = new THREE.Mesh(new THREE.PlaneGeometry(PW, 2), sm);
      shadowMesh.position.z = -0.02;
      shadowMesh.renderOrder = 0;
      scene.add(shadowMesh);
      mesh.renderOrder = 1;
    }
  }

  const cam = { base: new THREE.Vector3(), dist: 1 };
  let W = 1, H = 1, phone = false;
  function resize(w, h, svh) {
    W = w; H = h;
    const fr = framing(W, H, svh, T);
    phone = fr.phone;
    const visH = 2 * (fr.bottom - fr.top);
    cam.dist = visH / 2 / Math.tan((T.fovDeg * Math.PI) / 360);
    cam.base.set(0, 1 - (fr.top + fr.bottom), cam.dist);
    camera.position.copy(cam.base); camera.lookAt(0, cam.base.y, 0);
    camera.updateProjectionMatrix();
    UP.uCut.value.set(T.machineCutV, phone ? Math.max(0.25, T.machineCutV + 0.036) : T.machineCutV + 0.036);
  }

  // экранные координаты точек сетки (CSS px, y сверху) при текущем повороте
  const tmp = new THREE.Vector3();
  function screenOf(u, v) {
    tmp.copy(world(u, v));
    mesh.localToWorld(tmp);
    tmp.project(camera);
    return [(tmp.x * 0.5 + 0.5) * W, (0.5 - tmp.y * 0.5) * H];
  }
  function faceScreen() {
    pivot.updateMatrixWorld(true);
    const r = eyeR ? screenOf(...eyeR) : [W / 2 - 40, H * 0.43], l = eyeL ? screenOf(...eyeL) : [W / 2 + 40, H * 0.43];
    const a = P(234) ? screenOf(...P(234)) : [r[0] - 90, r[1]], b = P(454) ? screenOf(...P(454)) : [l[0] + 90, l[1]];
    const brow = P(10) ? screenOf(...P(10)) : [W / 2, r[1] - 120], ch = chin ? screenOf(...chin) : [W / 2, r[1] + 220];
    const hairTopY = brow[1] - (ch[1] - brow[1]) * 0.36;
    return { seamX: (r[0] + l[0]) / 2, eyeY: (r[1] + l[1]) / 2, faceHalf: Math.abs(b[0] - a[0]) / 2, hairTopY, eyesScreen: [r, l] };
  }

  // поворот за курсором (сглаживание по времени), дрейф в покое
  const rot = { x: 0, y: 0 }, look = { x: 0, y: 0 };
  const touch = { on: false, x: 0, y: 0, until: 0 };
  addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') { touch.on = true; touch.x = e.clientX; touch.y = e.clientY; } }, { passive: true });
  addEventListener('pointermove', (e) => { if (e.pointerType === 'touch' && touch.on) { touch.x = e.clientX; touch.y = e.clientY; } }, { passive: true });
  const up = (e) => { if (e.pointerType === 'touch') { touch.on = false; touch.until = performance.now() / 1000 + 1.2; } };
  addEventListener('pointerup', up, { passive: true }); addEventListener('pointercancel', up, { passive: true });

  const scan = { t0: null };
  let lastRo = 0;
  const roYaw = document.getElementById('ro-yaw'), roPitch = document.getElementById('ro-pitch');
  const ro = cfg.hero.readout;

  function frame({ t, dt, f, P: p, rise, sweep, burn, ptr }) {
    const tr = T.turn;
    let ty = 0, tx = 0;
    const now = performance.now() / 1000;
    const idle = !ptr.has || now - ptr.last / 1000 > tr.idleAfterS;
    if (touch.on || now < touch.until) {
      ty = (touch.x / W - 0.5) * tr.yawRad; tx = (touch.y / H - 0.5) * tr.pitchRad;
    } else if (S.fine && !idle) {
      ty = (ptr.x / W - 0.5) * tr.yawRad; tx = (ptr.y / H - 0.5) * tr.pitchRad;
    } else if (S.motion) {
      const k = S.fine ? 1 : 0;
      ty = Math.sin(t * 0.45) * (k ? tr.drift.yaw : tr.drift.touchYaw);
      tx = Math.sin(t * 0.31) * (k ? tr.drift.pitch : tr.drift.touchPitch);
    }
    if (p > T.beats[1] || !S.motion) { ty = 0; tx = 0; }
    const e = 1 - Math.pow(1 - tr.ease, dt * 60);
    rot.y += (ty - rot.y) * e; rot.x += (tx - rot.x) * e;
    pivot.rotation.set(rot.x, rot.y, 0);
    camera.position.set(cam.base.x, cam.base.y, cam.base.z * (1 + T.dissolve.cameraPullback * burn));

    // линзы глаз: к курсору
    pivot.updateMatrixWorld(true);
    let lx = 0, ly = 0;
    if (ptr.has && S.fine) {
      const fs = faceScreen();
      const dx = ptr.x - fs.seamX, dy = ptr.y - fs.eyeY, d = Math.hypot(dx, dy) || 1;
      const k = Math.min(1, d / 420) * T.eyes.lookMax;
      lx = (dx / d) * k; ly = (-dy / d) * k;
    }
    const le = 1 - Math.pow(1 - T.eyes.lookEase, f);
    look.x += (lx - look.x) * le; look.y += (ly - look.y) * le;
    UP.uLook.value.set(look.x, look.y);

    // сканирование в покое: первый проход через firstAtS, полоса sweepS, пауза pauseS
    if (p < T.beats[0] && S.motion) {
      if (scan.t0 === null) scan.t0 = t + T.scan.firstAtS + (S.introDelay || 0); // первое сканирование — после входа
      const cyc = T.scan.sweepS + T.scan.pauseS, k = t - scan.t0;
      const ph = k >= 0 ? k % cyc : -1;
      UP.uScan.value = ph >= 0 && ph < T.scan.sweepS ? ph / T.scan.sweepS : -1;
    } else UP.uScan.value = -1;
    S.scanning = UP.uScan.value > -0.5;

    UP.uBurn.value = burn;
    // вход: проявление и лёгкий подъём головы на место
    const ap = S.introAppear ?? 1;
    UP.uAppear.value = ap;
    if (shadowMesh) shadowMesh.material.uniforms.uShadowK.value = (T.backShadow ?? 0.28) * ap;
    pivot.position.y = (1 - 2 * eyeV) - (1 - ap) * (1 - ap) * 0.05;
    mesh.visible = p < 0.995 && burn < 0.999; // распад закончен — портрета нет, никаких остатков
    if (shadowMesh) shadowMesh.visible = p < T.beats[2];

    if (roYaw && t - lastRo > 0.1) {
      lastRo = t;
      roYaw.textContent = `${ro.yaw} ${(rot.y * 180 / Math.PI).toFixed(1)}°`;
      roPitch.textContent = `${ro.pitch} ${(-rot.x * 180 / Math.PI).toFixed(1)}°`;
    }
  }

  function tracked() {
    pivot.updateMatrixWorld(true);
    return (ro.tracked || []).filter(([i]) => P(i)).map(([i, label]) => ({ i, label, xy: screenOf(...P(i)) }));
  }

  const textures = [face, depth, machine, shadowMesh && shadowMesh.material.uniforms.uShadow.value].filter(Boolean);
  return { resize, frame, faceScreen, tracked, mesh, textures, get rot() { return rot; } };
}
