// artemvartanov.com — the charts in depth (demo/site/fx/depth.js; plan demo/site/docs/fx-plan.md, stage 4; owner's
// decision 04.11: "always 3D with effects"). The flat chart stays the front face — every bar, segment, dot and line where
// the measurement puts it, every label, both languages, the tooltips — and behind it, inside the same SVG, each mark
// gets what a solid shows around its front in an oblique drawing: the top and the side of a bar receding up and to the
// right, the rim of a coin, a wall behind a line. No perspective: nothing is foreshortened, the front is the value.
// Drawn in the SVG, not on the WebGL canvas: the canvas is fixed behind the page and is redrawn a frame after the
// page scrolls, so faces drawn there part from their bars while scrolling (measured 04.11); in the SVG they scroll
// with them, cost nothing at rest, and need no three.js.
// The faces follow the marks as the page's CSS and stage 3 animate them (an attribute or style written in the chart,
// a CSS transition running in it, the size, the language), read again only then. A heatmap cell recedes by its own
// count (data-v): an empty hour stays flat. All bars of a chart get one depth, in proportion to their thickness.
// The faces are aria-hidden and take no pointer: a screen reader and a click get the chart as it was.
//   mount({ el }) → { remove() }; FX.depth(el) — faces shown now (the tests), FX.depth.count — reads, outline writes

const SHADE = { top: 0.5, side: 0.25, wall: 0.72 };      // toward the paper: the top most, the side less, a wall most
const U = [0.8, -0.6];                                     // the depth axis on screen: up and to the right, unit length
const N = [0.6, 0.8];                                      // across it
const NS = 'http://www.w3.org/2000/svg';

const hex = (s) => { const m = /^#?([0-9a-f]{6})$/i.exec((s || '').trim()); if (!m) return null; const n = parseInt(m[1], 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const mix = (a, b, k) => `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * k)).join(',')})`;
const f2 = (v) => Math.round(v * 100) / 100;

// the points of a path drawn with M and L only (all of build.py's lines), in the drawing's own units
function polyline(d) {
  const n = (d || '').match(/-?[0-9.]+/g) || [], pts = [];
  for (let i = 0; i + 1 < n.length; i += 2) pts.push([+n[i], +n[i + 1]]);
  let len = 0;
  const cum = pts.map((p, i) => (i ? (len += Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1])) : 0));
  return { pts, cum, len };
}

const FX = window.FX || {};
const count = { reads: 0, writes: 0 }, live = new Map();
FX.depth = (el) => (live.has(el) ? live.get(el).faces() : 0);
FX.depth.count = count;

// the charts a CSS animation is running in, asked of the browser once a frame for all of them (each question makes it
// bring every animation up to date; thirteen a frame cost a fifth of a slow phone's time — measured 04.11)
let askedAt = null, busy = new Set();
function running() {
  const now = document.timeline.currentTime;
  if (now === askedAt) return busy;
  askedAt = now;
  busy = new Set();
  for (const a of document.getAnimations()) {
    const t = a.playState === 'running' && a.effect && a.effect.target, ch = t && t.closest && t.closest('.chart');
    if (ch) busy.add(ch);
  }
  return busy;
}

// one loop for all charts, running only while a CSS animation runs in one of them
let raf = 0;
const loop = () => { if (!raf) raf = requestAnimationFrame(tick); };
function tick() {
  raf = 0;
  let more = false;
  for (const c of live.values()) if (c.step()) more = true;
  if (more) loop();
}

export function mount({ el }) {
  if (live.has(el)) return live.get(el).handle;
  const css = getComputedStyle(document.documentElement);
  const paper = hex(css.getPropertyValue('--paper')) || [244, 242, 236];
  const cache = new Map();          // svg → its marks and its group of faces: the drawing never changes, only its animation

  function marks(svg) {
    let info = cache.get(svg);
    if (info) return info;
    const list = [];
    for (const m of svg.querySelectorAll('rect, circle, path.draw')) {
      if (m.closest('defs') || m.classList.contains('hit') || m.classList.contains('clip')) continue;
      const tag = m.tagName.toLowerCase(), col = hex(m.getAttribute(tag === 'path' ? 'stroke' : 'fill'));
      if (!col) continue;                                   // no fill, a pattern: nothing solid to draw
      list.push({ m, tag, faces: [], fo: m.hasAttribute('fill-opacity') ? +m.getAttribute('fill-opacity') : 1,
        v: m.hasAttribute('data-v') ? +m.getAttribute('data-v') : null, line: tag === 'path' ? polyline(m.getAttribute('d')) : null,
        top: mix(col, paper, SHADE.top), side: mix(col, paper, SHADE.side), wall: mix(col, paper, SHADE.wall) });
    }
    const vs = list.filter((q) => q.v !== null).map((q) => q.v);
    // how thick the bars are (a column's width, a row's height — what no animation changes)
    const th = list.filter((q) => q.tag === 'rect' && q.v === null).map((q) => {
      const w = +q.m.getAttribute('width'), h = +q.m.getAttribute('height');
      return q.m.classList.contains('bar') ? w : q.m.classList.contains('seg') ? h : Math.min(w, h);
    }).filter((v) => v > 0).sort((a, b) => a - b);
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('class', 'fx-depth');
    g.setAttribute('aria-hidden', 'true');
    g.setAttribute('pointer-events', 'none');
    svg.insertBefore(g, svg.firstChild);                    // behind everything the chart draws
    info = { list, g, vmax: vs.length ? Math.max(1, ...vs) : 1, thick: th.length ? th[th.length >> 1] : 0 };
    cache.set(svg, info);
    return info;
  }

  let shown = 0;
  function build() {
    count.reads++;
    const svg = [...el.querySelectorAll('svg')].find((s) => s.getBoundingClientRect().width > 0);
    if (!svg) { shown = 0; return; }
    const { list, g, vmax, thick } = marks(svg);
    const vb = svg.viewBox.baseVal, r = svg.getBoundingClientRect();
    const px = Math.min(r.width / vb.width, r.height / vb.height);          // CSS px per unit of the drawing
    if (!(px > 0)) return;
    const most = (innerWidth <= 640 ? 5 : 7) / px;                         // the deepest face, in units
    const D = thick ? Math.min(most, Math.max(2 / px, 1.1 * thick)) : most;
    let base = null;                                                        // for marks a CSS transform is growing
    // Every mark keeps its own faces, made once: a mark that fades in or out changes only their opacity, and one that
    // grows, only their outline — nothing else is rewritten. A face with nothing to show gets an empty outline.
    const face = (q, k) => q.faces[k] || (q.faces[k] = g.appendChild(document.createElementNS(NS, 'path')));
    const items = [];
    for (const q of list) {
      const cs = getComputedStyle(q.m);
      const a = cs.display === 'none' || cs.visibility === 'hidden' ? 0 : +cs.opacity * q.fo;
      let M = null;
      if (cs.transform !== 'none' && cs.display !== 'none') {
        base = base || DOMMatrix.fromMatrix(svg.getScreenCTM()).inverse();
        const own = q.m.getScreenCTM();
        if (own) M = base.multiply(DOMMatrix.fromMatrix(own));
      }
      const P = M ? (x, y) => [M.a * x + M.c * y + M.e, M.b * x + M.d * y + M.f] : (x, y) => [x, y];
      if (q.tag === 'path') {                               // the wall: as far as the line is drawn
        const { pts, cum, len } = q.line, upto = Math.max(0, len - (parseFloat(cs.strokeDashoffset) || 0));
        const dx = most * U[0], dy = most * U[1];
        let d = '';
        for (let i = 1; i < pts.length && cum[i - 1] < upto; i++) {
          let [x1, y1] = pts[i - 1], [x2, y2] = pts[i];
          if (cum[i] > upto) { const f = (upto - cum[i - 1]) / (cum[i] - cum[i - 1]); x2 = x1 + (x2 - x1) * f; y2 = y1 + (y2 - y1) * f; }
          const A = P(x1, y1), B = P(x2, y2);
          d += `M${f2(A[0])},${f2(A[1])}L${f2(B[0])},${f2(B[1])}L${f2(B[0] + dx)},${f2(B[1] + dy)}L${f2(A[0] + dx)},${f2(A[1] + dy)}Z`;
        }
        items.push({ p: face(q, 0), k: [Infinity, 0], d, fill: q.wall, a });     // first: lines lie behind what stands on them
        continue;
      }
      if (q.tag === 'circle') {                             // a coin: its rim, as thick as a coin
        const [cx, cy] = P(+q.m.getAttribute('cx'), +q.m.getAttribute('cy'));
        const rr = +q.m.getAttribute('r') * (M ? Math.sqrt(Math.abs(M.a * M.d - M.b * M.c)) : 1);
        let d = '';
        if (rr * px > 0.3) {
          const cd = Math.min(most, rr * 0.9), dx = cd * U[0], dy = cd * U[1];
          const p1 = [cx + N[0] * rr, cy + N[1] * rr], p2 = [cx - N[0] * rr, cy - N[1] * rr], R = f2(rr);
          d = `M${f2(p1[0])},${f2(p1[1])}L${f2(p1[0] + dx)},${f2(p1[1] + dy)}A${R},${R} 0 0 0 ${f2(p2[0] + dx)},${f2(p2[1] + dy)}`
            + `L${f2(p2[0])},${f2(p2[1])}A${R},${R} 0 0 0 ${f2(p1[0])},${f2(p1[1])}Z`;
        }
        items.push({ p: face(q, 0), k: [cy + rr, cx - rr], d, fill: q.side, a });
        continue;
      }
      const x = +q.m.getAttribute('x'), y = +q.m.getAttribute('y'), w = +q.m.getAttribute('width'), h = +q.m.getAttribute('height');
      const pa = P(x, y), pb = P(x + w, y + h);
      const x0 = Math.min(pa[0], pb[0]), x1 = Math.max(pa[0], pb[0]), y0 = Math.min(pa[1], pb[1]), y1 = Math.max(pa[1], pb[1]);
      // a heatmap cell: as deep as its count, the busiest hour twice a bar's depth or 0.6 of the cell
      const dep = q.v === null ? D : (Math.min(2 * most, 0.6 * Math.min(x1 - x0, y1 - y0)) * q.v) / vmax;
      const solid = (x1 - x0) * px > 0.3 && (y1 - y0) * px > 0.3 && dep * px > 0.2;
      const ex = dep * U[0], ey = dep * U[1], k = [y1, x0];
      items.push({ p: face(q, 0), k, fill: q.side, a,                                    // the side
        d: solid ? `M${f2(x1)},${f2(y0)}L${f2(x1)},${f2(y1)}L${f2(x1 + ex)},${f2(y1 + ey)}L${f2(x1 + ex)},${f2(y0 + ey)}Z` : '' });
      items.push({ p: face(q, 1), k, fill: q.top, a,                                     // the top
        d: solid ? `M${f2(x0)},${f2(y0)}L${f2(x1)},${f2(y0)}L${f2(x1 + ex)},${f2(y0 + ey)}L${f2(x0 + ex)},${f2(y0 + ey)}Z` : '' });
    }
    // nearer the eye — up and to the right — goes later: rows from the bottom up, each row from the left; a face moves
    // in the drawing only when that order changes
    items.sort((A, B) => (B.k[0] - A.k[0]) || (A.k[1] - B.k[1]));
    let ref = g.firstChild, n = 0;
    for (const it of items) {
      if (it.p !== ref) g.insertBefore(it.p, ref); else ref = ref.nextSibling;
      const al = String(f2(Math.min(1, it.a)));
      if (it.p.getAttribute('d') !== it.d) { it.p.setAttribute('d', it.d); count.writes++; }
      if (it.p.getAttribute('fill') !== it.fill) it.p.setAttribute('fill', it.fill);
      if (it.p.getAttribute('fill-opacity') !== al) it.p.setAttribute('fill-opacity', al);
      if (it.d && it.a > 0.01) n++;
    }
    shown = n;
  }

  // what may move the marks: an attribute or a style written in the chart (not in its own faces), the language on
  // <html>, the chart's size (a tab opened, a width crossed); a CSS transition running in it keeps the loop going
  let dirty = true;
  const own = (n) => n.closest && n.closest('.fx-depth');
  const mo = new MutationObserver((recs) => {
    if (recs.some((r) => !own(r.target))) { dirty = true; c.step(); loop(); }
  });
  mo.observe(el, { attributes: true, subtree: true });
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-lang'] });
  const ro = new ResizeObserver(() => { dirty = true; c.step(); loop(); });
  ro.observe(el);
  const moving = () => running().has(el);

  let was = false;
  const c = {
    faces: () => shown,
    step() {                                   // read and draw if anything may have moved; true: keep looping
      const mov = moving();
      // once more after the last animation ends: its last frame was read just before it reached its end value
      if (dirty || mov || was) { dirty = false; build(); }
      was = mov;
      return mov;
    },
    handle: { remove() {
      mo.disconnect(); ro.disconnect(); live.delete(el);
      for (const { g } of cache.values()) g.remove();
      cache.clear();
    } },
  };
  live.set(el, c);
  c.step();
  loop();
  return c.handle;
}
