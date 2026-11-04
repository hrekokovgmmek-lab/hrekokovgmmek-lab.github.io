// artemvartanov.com — the 240 failures (demo/site/fx/scenes/failures.js; plan demo/site/docs/fx-plan.md, stage 4,
// the prototype). 240 points, one per failed pump.fun transaction taken apart on 23.10.2026, each sized by the failures
// of its page — the weights the shares of the bar "why transactions on the pump.fun curve fail" are made of (owner's
// decision 04.11). They swarm over the chart, then fly, left to right, into the part of their reason; a reason's
// points fill its part of the bar by area, so the bar is these points. Then the drawn chart comes back over them and
// they fade: the last frame is the static chart. All of it tied to the scroll, both ways.
// Data: build.py failure_rows(): [reason, failures of the page] × 240, no signature, no address.

const DENSITY = 0.55;            // the points cover this much of their part of the bar
const ease = (q) => (q < 0.5 ? 4 * q * q * q : 1 - Math.pow(-2 * q + 2, 3) / 2);
const clamp = (v) => Math.min(1, Math.max(0, v));
const hex = (s) => { const m = /^#?([0-9a-f]{6})$/i.exec((s || '').trim()); const n = m ? parseInt(m[1], 16) : 0x1f1f1f; return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };

export function mount({ el, stage, ScrollTrigger, add, data, undo }) {
  if (!Array.isArray(data) || !data.length || el.classList.contains('in')) return;     // seen already: left as it is
  const N = data.length, ink = hex(getComputedStyle(document.documentElement).getPropertyValue('--ink'));
  let p = 0, goal = 0, L = null, lw = 0, lh = 0, shown = -1;

  // the chart's own drawing goes transparent while the points have the floor, and comes back at the end; the
  // attribute is put back exactly as it was
  const had = el.getAttribute('style');
  const showChart = (o) => {
    if (o === shown) return;
    shown = o;
    if (o >= 1) { if (had === null) el.removeAttribute('style'); else el.setAttribute('style', had); }
    else el.setAttribute('style', (had ? had.replace(/;?\s*$/, ';') : '') + `opacity:${o.toFixed(3)}`);
  };

  // where each point goes in the visible drawing (language and width decide which), in px of the chart's box
  function layout() {
    const svg = [...el.querySelectorAll('svg')].find((s) => s.getBoundingClientRect().width > 0);
    if (!svg) return null;
    const box = el.getBoundingClientRect(), r = svg.getBoundingClientRect(), sc = r.width / svg.viewBox.baseVal.width;
    const ox = r.left - box.left, oy = r.top - box.top;
    const segs = [...svg.querySelectorAll('rect.seg')].map((s) => ({
      x: ox + +s.getAttribute('x') * sc, y: oy + +s.getAttribute('y') * sc,
      w: +s.getAttribute('width') * sc, h: +s.getAttribute('height') * sc, tint: hex(s.getAttribute('fill')) }));
    const pts = data.map(([k, w], i) => ({ i, k, w }));
    for (const [k, seg] of segs.entries()) {
      const mine = pts.filter((q) => q.k === k), total = mine.reduce((a, q) => a + q.w, 0) || 1;
      for (const q of mine) q.r = Math.max(1.2, Math.sqrt((DENSITY * seg.w * seg.h * q.w) / total / Math.PI));
      pack(mine, seg);
    }
    // the swarm: a slow whirl over the chart, one place per point on a sunflower spiral
    const cx = box.width / 2, cy = Math.min(box.height * 0.45, segs[0].y + segs[0].h * 2.2);
    const rx = box.width * 0.42, ry = Math.min(box.height * 0.42, 150);
    const minX = Math.min(...pts.map((q) => q.x)), span = Math.max(1, Math.max(...pts.map((q) => q.x)) - minX);
    for (const q of pts) {
      const u = (q.i + 0.5) / N;
      q.a = q.i * 2.399963; q.d = Math.sqrt(u); q.cx = cx; q.cy = cy; q.rx = rx; q.ry = ry;
      q.s = 0.14 + 0.3 * (q.x - minX) / span;          // the flight starts left to right
      q.tint = segs[q.k] ? segs[q.k].tint : ink;
    }
    return pts;
  }

  // spread the points of one reason inside its part of the bar: start on a sunflower, push apart, keep inside
  function pack(pts, seg) {
    pts.forEach((q, n) => { q.x = seg.x + seg.w * ((n * 0.618034 + 0.31) % 1); q.y = seg.y + seg.h * ((n + 0.5) / pts.length); });
    for (let it = 0; it < 60; it++) {
      for (let a = 0; a < pts.length; a++) for (let b = a + 1; b < pts.length; b++) {
        const P = pts[a], Q = pts[b], m = P.r + Q.r + 0.5;
        let dx = Q.x - P.x, dy = Q.y - P.y;
        const d = Math.hypot(dx, dy) || 0.01;
        if (d < m) { const f = (m - d) / 2 / d; dx *= f; dy *= f; P.x -= dx; P.y -= dy; Q.x += dx; Q.y += dy; }
      }
      for (const q of pts) {
        q.x = seg.w < 2 * q.r ? seg.x + seg.w / 2 : Math.min(seg.x + seg.w - q.r, Math.max(seg.x + q.r, q.x));
        q.y = seg.h < 2 * q.r ? seg.y + seg.h / 2 : Math.min(seg.y + seg.h - q.r, Math.max(seg.y + q.r, q.y));
      }
    }
  }

  let geo, mat, points, scene, cam;
  const handle = stage.add({
    el,
    setup({ THREE, renderer }) {
      geo = new THREE.BufferGeometry();
      for (const [name, n] of [['position', 3], ['tint', 3], ['size', 1], ['alpha', 1]])
        geo.setAttribute(name, new THREE.BufferAttribute(new Float32Array(N * n), n).setUsage(THREE.DynamicDrawUsage));
      mat = new THREE.ShaderMaterial({
        uniforms: { dpr: { value: renderer.getPixelRatio() } },
        vertexShader: 'attribute vec3 tint; attribute float size; attribute float alpha; varying vec3 vTint; varying float vAlpha; uniform float dpr;'
          + 'void main(){ vTint = tint; vAlpha = alpha; gl_PointSize = size * 2.0 * dpr; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: 'varying vec3 vTint; varying float vAlpha;'
          + 'void main(){ float d = length(gl_PointCoord - 0.5) * 2.0; float a = (1.0 - smoothstep(0.84, 1.0, d)) * vAlpha; if (a < 0.01) discard; gl_FragColor = vec4(vTint, a); }',
        transparent: true, depthTest: false, depthWrite: false,
      });
      points = new THREE.Points(geo, mat);
      points.frustumCulled = false;
      scene = new THREE.Scene();
      scene.add(points);
      cam = new THREE.OrthographicCamera(0, 1, 0, -1, -10, 10);
      cam.position.z = 1;
    },
    still: () => p === goal && (p <= 0 || p >= 1),                  // nothing on the canvas, nothing moving
    frame(t, dt, w, h, renderer) {
      if (w !== lw || h !== lh || !L) { cam.right = w; cam.bottom = -h; cam.updateProjectionMatrix(); lw = w; lh = h; L = layout(); }
      mat.uniforms.dpr.value = renderer.getPixelRatio();
      p += (goal - p) * Math.min(1, dt * 7);
      if (Math.abs(goal - p) < 0.0005) p = goal;
      showChart(p < 0.8 ? 0 : clamp((p - 0.8) / 0.12));
      const fade = p < 0.12 ? p / 0.12 : p > 0.9 ? clamp(1 - (p - 0.9) / 0.1) : 1;
      if (!L || fade <= 0) return;                                   // nothing to draw: the canvas stays clear
      const pos = geo.attributes.position.array, tin = geo.attributes.tint.array, siz = geo.attributes.size.array, alp = geo.attributes.alpha.array;
      for (const q of L) {
        const a = q.a + t * (0.12 + (q.i % 7) * 0.012), sx = q.cx + q.rx * q.d * Math.cos(a), sy = q.cy + q.ry * q.d * Math.sin(a);
        const k = ease(clamp((p - q.s) / 0.28)), j = q.i * 3;
        pos[j] = sx + (q.x - sx) * k; pos[j + 1] = -(sy + (q.y - sy) * k); pos[j + 2] = 0;
        for (let c = 0; c < 3; c++) tin[j + c] = ink[c] + (q.tint[c] - ink[c]) * k;
        siz[q.i] = q.r * (0.75 + 0.25 * k);
        alp[q.i] = fade;
      }
      for (const name of ['position', 'tint', 'size', 'alpha']) geo.attributes[name].needsUpdate = true;
      renderer.render(scene, cam);
    },
    dispose() { if (geo) geo.dispose(); if (mat) mat.dispose(); },
  });
  if (!window.FX || !window.FX.on) return;                           // no WebGL after all: the chart as it is
  el.classList.add('fx-scene');
  showChart(0);
  add(() => ScrollTrigger.create({
    trigger: el, start: 'clamp(top bottom)', end: 'clamp(center 40%)',
    onUpdate: (self) => { goal = self.progress; },
    onLeave: () => { goal = p = 1; showChart(1); },                  // gone past: the static chart, at once
    onLeaveBack: () => { goal = p = 0; showChart(0); },
  }));
  const mo = new MutationObserver(() => { L = null; });               // another language: another drawing to land in
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-lang'] });
  undo(() => { mo.disconnect(); handle.remove(); el.classList.remove('fx-scene'); showChart(1); });
}
