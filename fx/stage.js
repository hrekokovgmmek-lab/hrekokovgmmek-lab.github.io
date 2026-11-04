// artemvartanov.com — the WebGL stage (demo/site/fx/stage.js; plan demo/site/docs/fx-plan.md, stage 1).
// One WebGL2 renderer per page. Its canvas is fixed behind the content, takes no clicks and no focus, and draws at
// most 2 device pixels per CSS pixel. Each scene belongs to an element of the page and draws inside that element's
// box (full: true — over the whole window while the element is on screen).
// The loop runs only while some scene's element is on screen (an element in a closed tab of About has no box, so it
// counts as off screen), the page is visible and the context is alive; otherwise the loop stops and the canvas hides.
// A lost context pauses everything until the browser gives it back; on the third loss in a visit, or when no context
// can be had or the GPU is a software one, FX.off() turns effects off and the page stays as it is without them.
// Colours come from the page's CSS tokens: color('--ink').
//   import * as stage from './stage.js';
//   const s = stage.add({ el, setup({ THREE, renderer, color }) {…}, frame(t, dt, w, h, renderer) {…}, dispose() {…} });
//   s.remove();
// A scene that keeps this.scene and this.camera after setup gets its shaders compiled at once, before it is seen.
import * as THREE from './three-0.185.1/three.module.min.js';

export { THREE };

const FX = window.FX || { on: false, off() {} };
const DPR_MAX = 2;
const LOSSES_MAX = 2;          // the third lost context in one visit ends the effects
const AHEAD = '25% 0px';       // a scene starts a little before its element scrolls in
const CSS = '#fx-canvas{position:fixed;left:0;top:0;width:100%;height:100vh;height:100lvh;z-index:-1;'
  + 'pointer-events:none;visibility:hidden}html.fx-live #fx-canvas{visibility:visible}'
  + 'html.fx-live body{background:transparent}';   // html carries the same paper, so no pixel changes

let canvas = null, renderer = null, closed = !FX.on;
let lost = false, losses = 0, hidden = document.visibilityState === 'hidden';
let raf = 0, last = 0, frames = 0, live = false, dirty = false;
const scenes = new Set();
const io = new IntersectionObserver((entries) => {
  for (const e of entries) for (const s of scenes) if (s.el === e.target) s.seen = e.isIntersecting;
  update();
}, { rootMargin: AHEAD });

export function color(token, fallback = '#000000') {
  const v = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  return new THREE.Color(v || fallback);
}

export function getRenderer() { return renderer; }

function tools() { return { THREE, renderer, canvas, color }; }

function open() {
  if (renderer || closed) return !!renderer;
  const c = document.createElement('canvas');
  c.id = 'fx-canvas';
  c.setAttribute('aria-hidden', 'true');
  const gl = c.getContext('webgl2', { alpha: true, antialias: true, premultipliedAlpha: true, depth: true,
    stencil: false, powerPreference: 'low-power', failIfMajorPerformanceCaveat: true });
  if (!gl) { closed = true; FX.off('gl'); return false; }
  const style = document.createElement('style');
  style.id = 'fx-style';
  style.textContent = CSS;
  document.head.appendChild(style);
  document.body.appendChild(c);
  canvas = c;
  renderer = new THREE.WebGLRenderer({ canvas: c, context: gl });
  renderer.autoClear = false;
  renderer.setClearColor(0x000000, 0);
  size();
  new ResizeObserver(size).observe(c);
  c.addEventListener('webglcontextlost', (e) => {
    if (closed) return;
    lost = true; losses++; dirty = false;
    if (losses > LOSSES_MAX) { FX.off('gl-lost'); return; }   // the third time: give up while it is lost
    e.preventDefault();          // ask the browser to give it back
    update();
  });
  c.addEventListener('webglcontextrestored', () => {
    if (closed) return;
    lost = false;
    for (const s of scenes) if (s.def.restore) s.def.restore(tools());
    update();
  });
  return true;
}

function size() {
  if (!renderer) return;
  const dpr = Math.min(window.devicePixelRatio || 1, DPR_MAX);
  if (renderer.getPixelRatio() !== dpr) renderer.setPixelRatio(dpr);
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
}

export function add(def) {
  const none = { remove() {} };
  if (!FX.on || !def || !def.el || !open()) return none;
  const s = { def, el: def.el, full: !!def.full, seen: false };
  try {
    if (def.setup) def.setup(tools());
    if (def.scene && def.camera) renderer.compile(def.scene, def.camera);
  } catch (e) { console.error('fx: scene setup failed', e); return none; }
  for (const o of scenes) if (o.el === s.el) s.seen = o.seen;   // the observer reports an element only once
  scenes.add(s);
  io.observe(s.el);
  update();
  return { remove() { drop(s); } };
}

function drop(s) {
  if (!scenes.delete(s)) return;
  if (![...scenes].some((o) => o.el === s.el)) io.unobserve(s.el);
  try { if (s.def.dispose) s.def.dispose(); } catch (e) { console.error('fx: scene dispose failed', e); }
  update();
}

function update() {
  const want = !!renderer && FX.on && !lost && !hidden && [...scenes].some((s) => s.seen);
  if (want && !raf) { last = performance.now(); raf = requestAnimationFrame(tick); }
  if (!want) {
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    show(false);
  }
}

function show(on) {
  if (on === live) return;
  live = on;
  document.documentElement.classList.toggle('fx-live', on);
}

function tick(now) {
  raf = requestAnimationFrame(tick);
  const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
  last = now;
  const W = canvas.clientWidth, H = canvas.clientHeight, boxes = [];
  for (const s of scenes) {
    if (!s.seen) continue;
    if (s.full) { boxes.push([s, 0, 0, W, H]); continue; }
    const r = s.el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < H && r.right > 0 && r.left < W)
      boxes.push([s, r.left, H - r.bottom, r.width, r.height]);
  }
  if (!boxes.length) {           // on its way in (AHEAD) but not yet on screen: nothing to draw
    if (dirty) { renderer.setScissorTest(false); renderer.clear(); dirty = false; }
    show(false);
    return;
  }
  renderer.setScissorTest(false);
  renderer.clear();
  renderer.setScissorTest(true);
  for (const [s, x, y, w, h] of boxes) {
    renderer.setViewport(x, y, w, h);
    renderer.setScissor(x, y, w, h);
    try { s.def.frame(now / 1000, dt, w, h, renderer); }
    catch (e) { console.error('fx: scene frame failed', e); drop(s); }
  }
  dirty = true;
  frames++;
  show(true);
}

export function state() {
  return {
    on: FX.on, gl: renderer ? 'ok' : closed ? 'off' : 'not opened', lost, losses, hidden, running: !!raf, live,
    frames, dpr: renderer ? renderer.getPixelRatio() : 0, scenes: scenes.size,
    seen: [...scenes].filter((s) => s.seen).length,
  };
}

document.addEventListener('visibilitychange', () => { hidden = document.visibilityState === 'hidden'; update(); });

document.addEventListener('fx:off', () => {
  closed = true;
  if (raf) { cancelAnimationFrame(raf); raf = 0; }
  // the context goes first: the GPU memory comes back now, not at garbage collection, and the clean-up below then
  // talks to a lost context, which ignores it (a live one would complain about buffers left from before a restore)
  if (renderer && !lost) { renderer.forceContextLoss(); lost = true; }
  for (const s of [...scenes]) drop(s);
  io.disconnect();
  show(false);
  if (renderer) { renderer.dispose(); renderer = null; }
  if (canvas) { canvas.remove(); canvas = null; }
  const style = document.getElementById('fx-style');
  if (style) style.remove();
}, { once: true });
