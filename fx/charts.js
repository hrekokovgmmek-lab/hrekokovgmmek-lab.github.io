// artemvartanov.com — the charts come alive with the scroll (demo/site/fx/charts.js; plan demo/site/docs/fx-plan.md,
// stage 3). A chart with data-fx replays the page's own choreography — the classes draw, pop, bar and seg with their
// --d and --t — tied to the scroll and reversible: it builds up as it rises from the bottom of the window to the
// middle, and unbuilds on the way back. All drawings of a chart (two languages × wide and narrow) run on one timeline,
// so a change of language or width mid-way shows the same moment. At the end every attribute and style is back at its
// value in the markup, and the last frame is the static chart to the pixel (fx/charts.test.mjs).
// Bars and segments grow through their own geometry (width, height, x, y), not transforms: gsap writes SVG transforms
// as an attribute, and the page's CSS transform rules would override it. A chart that was on screen, or had played,
// when this started is left as it is. The rule of each chart is below, under its data-fx name.
// Nothing is loaded or built until the first chart or table comes within a window's height of the screen: the charts
// are below the first screen, and ScrollTrigger and the timelines (one task of ~70 ms on a slow phone) are not needed
// before then — measured 04.11 on the live site, Lighthouse TBT 20 ms when they were set up at load.
import { load } from './gsap.js';

const FX = window.FX || { on: false };
const DRAW = 2.4;                 // build.py DRAW: seconds the creator line takes, the measure of every other line
const CSS = '.js .chart.fx-chart .draw{stroke-dashoffset:0}.js .chart.fx-chart .pop,.js .chart.fx-chart .cell{opacity:1}'
  + '.js .chart.fx-chart .bar,.js .chart.fx-chart .seg{transform:none}.js .chart.fx-chart *{transition:none!important}';

let off = !FX.on;
const undo = [];
document.addEventListener('fx:off', () => { off = true; for (const f of undo.splice(0)) f(); }, { once: true });

// --d, --t and --len are always in the element's own style attribute (build.py): read them there. getComputedStyle
// between gsap's writes would make the browser recompute styles once per element
const prop = (el, name, dflt) => { const v = parseFloat(el.style.getPropertyValue(name)); return Number.isNaN(v) ? dflt : v; };
const at = (el) => prop(el, '--d', 0);
const attrs = (el, ...names) => names.map((n) => +el.getAttribute(n));

// ---------- the page's choreography, under the scroll ----------

function tween(tl, el, t) {
  const c = el.classList;
  if (c.contains('draw')) {
    tl.fromTo(el, { strokeDashoffset: prop(el, '--len', 0) }, { strokeDashoffset: 0, duration: DRAW, ease: 'power1.inOut' }, t);
  } else if (c.contains('bar')) {
    const [y, h] = attrs(el, 'y', 'height');
    if (c.contains('up')) tl.fromTo(el, { attr: { y: y + h, height: 0 } }, { attr: { y, height: h }, duration: 0.55, ease: 'power2.out' }, t);
    else tl.fromTo(el, { attr: { height: 0 } }, { attr: { height: h }, duration: 0.55, ease: 'power2.out' }, t);
  } else if (c.contains('seg')) {
    const [x, w] = attrs(el, 'x', 'width'), d = prop(el, '--t', 0.4);
    if (/100%/.test(el.style.transformOrigin))   // grows to the left (the creator side of the mirror chart)
      tl.fromTo(el, { attr: { x: x + w, width: 0 } }, { attr: { x, width: w }, duration: d, ease: 'none' }, t);
    else tl.fromTo(el, { attr: { width: 0 } }, { attr: { width: w }, duration: d, ease: 'none' }, t);
  } else {
    tl.fromTo(el, { opacity: 0 }, { opacity: 1, duration: c.contains('cell') ? 0.5 : 0.45, ease: 'power1.out' }, t);
  }
}

function base(tl, svg, skip = () => false) {
  for (const el of svg.querySelectorAll('.draw, .pop, .bar, .seg, .cell'))
    if (!el.hasAttribute('data-fx-last') && !skip(el)) tween(tl, el, at(el));
}

// the elements marked data-fx-last, after everything else
function last(tl, svg, gap = 0.12) {
  const t = tl.duration() + gap;
  svg.querySelectorAll('[data-fx-last]').forEach((el, i) => tween(tl, el, t + i * 0.06));
}

// an SVG label whose digits decode: the svg is one image to a screen reader (role=img, aria-label), so its text can
// change; the original string comes back whole at the end
function decode(tl, el, t, dur) {
  const final = el.textContent, place = { p: 1 };
  const shown = (p) => {
    let k = 0;
    const n = (final.match(/[0-9]/g) || []).length, keep = Math.floor(p * n);
    return final.replace(/[0-9]/g, (d) => (k++ < keep ? d : String((Math.random() * 10) | 0)));
  };
  tl.fromTo(place, { p: 0 }, { p: 1, duration: dur, ease: 'none',
    onUpdate: () => { el.textContent = place.p >= 1 ? final : shown(place.p); } }, t);
  undo.push(() => { el.textContent = final; });
}

// ---------- the rule of each chart ----------

const RULES = {
  // the balance line draws with the scroll; each step's label decodes its digits as the line reaches it
  creator(tl, svg) {
    base(tl, svg);
    for (const el of svg.querySelectorAll('text.lab.pop')) decode(tl, el, at(el), 0.5);
  },

  // the 15 first buys fall onto the axis, drifting in from either side, and settle in their stacks at 1,500 and
  // 2,000 SOL; the stack labels come once the last one has landed
  bigbuy(tl, svg) {
    const labels = [...svg.querySelectorAll('text.lab.pop')];
    base(tl, svg, (el) => el.tagName === 'circle' || labels.includes(el));
    svg.querySelectorAll('circle.pop').forEach((el, i) => {
      const [cx, cy] = attrs(el, 'cx', 'cy'), t = at(el), drift = (((i * 7) % 11) - 5) * 12;
      tl.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.12 }, t)
        .fromTo(el, { attr: { cx: cx + drift, cy: cy - 140 } }, { attr: { cx, cy }, duration: 0.7, ease: 'bounce.out' }, t);
    });
    const end = tl.duration();
    labels.forEach((el, i) => tween(tl, el, end + i * 0.1));
  },

  // both sides of each coin grow out of the centre line at once, the buyer's loss to the left and the creator's
  // gain to the right; "together" comes last, once all four are drawn
  mirror(tl, svg) {
    base(tl, svg);
    last(tl, svg, 0.2);
  },

  // the 90 days pour in from left to right, each day's money in up and out down (the page's own wave, 12 ms a day,
  // under the scroll); the totals under the chart roll like an odometer — fx/text.js, data-scramble
  treasury(tl, svg) {
    base(tl, svg);
  },

  // log scale: all bars grow together one gridline at a time, each a step ten times the last, and each stops at its
  // own value; the figures come after. The gridlines are the chart's own vertical lines
  scale(tl, svg) {
    const STEP = 0.26;
    const grid = [...svg.querySelectorAll('line')].filter((l) => l.getAttribute('x1') === l.getAttribute('x2'))
      .map((l) => +l.getAttribute('x1')).sort((a, b) => a - b);
    for (const el of svg.querySelectorAll('.seg')) {
      const [x, w] = attrs(el, 'x', 'width');
      grid.map((g) => g - x).filter((s) => s > 1 && s < w - 1).concat(w).forEach((to, j) => {
        const v = { attr: { width: to }, duration: STEP * 0.7, ease: 'power2.out' };
        if (j === 0) tl.fromTo(el, { attr: { width: 0 } }, v, 0.05); else tl.to(el, v, 0.05 + j * STEP);
      });
    }
    const end = tl.duration();
    svg.querySelectorAll('text.pop').forEach((el, i) => tween(tl, el, end + 0.05 + i * 0.04));
  },

  // the share of failed transactions draws minute by minute; the median line and its 76% come only after it
  share(tl, svg) {
    base(tl, svg);
    last(tl, svg, 0.15);
  },

  // the entry path, before and after the two fixes: a pulse rides the tip of each row through its stages, each stage
  // as long as its milliseconds (the page's own timing), so the faster path visibly finishes first. The pulses are
  // added for the effect only and are gone (transparent, aria-hidden) by the last frame
  latency(tl, svg) {
    base(tl, svg);
    const rows = new Map(), brick = getComputedStyle(document.documentElement).getPropertyValue('--brick').trim() || '#a84b36';
    for (const s of svg.querySelectorAll('.seg')) { const y = s.getAttribute('y'); if (!rows.has(y)) rows.set(y, []); rows.get(y).push(s); }
    for (const [y, segs] of rows) {
      const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle'), end = segs[segs.length - 1];
      for (const [k, v] of Object.entries({ cx: segs[0].getAttribute('x'), cy: +y + +segs[0].getAttribute('height') / 2, r: 6, fill: brick, 'aria-hidden': 'true' }))
        dot.setAttribute(k, v);
      svg.appendChild(dot);
      undo.push(() => dot.remove());
      tl.fromTo(dot, { opacity: 0 }, { opacity: 1, duration: 0.06 }, at(segs[0]));
      for (const s of segs) { const [x, w] = attrs(s, 'x', 'width'); tl.to(dot, { attr: { cx: x + w }, duration: prop(s, '--t', 0.4), ease: 'none' }, at(s)); }
      tl.to(dot, { opacity: 0, duration: 0.2 }, at(end) + prop(end, '--t', 0.4));
    }
  },

  // one buy to the lamport: when the 3.55% that is not the pool appears, the camera dives into it (the drawing's own
  // viewBox, same proportions), then pulls back out as it splits into its parts below; the last frame is the full view
  split(tl, svg) {
    base(tl, svg);
    const vb = svg.getAttribute('viewBox'), [, , W, H] = vb.trim().split(/\s+/).map(Number);
    const segs = [...svg.querySelectorAll('.seg')], top = Math.min(...segs.map((s) => +s.getAttribute('y')));
    const rest = segs.filter((s) => +s.getAttribute('y') === top).sort((a, b) => +a.getAttribute('x') - +b.getAttribute('x')).pop();
    const [rx, ry, rw, rh] = attrs(rest, 'x', 'y', 'width', 'height');
    const zw = Math.max(rw * 5, W * 0.22), zh = zw * H / W;
    const zx = Math.min(W - zw, Math.max(0, rx + rw / 2 - zw / 2)), zy = Math.min(H - zh, Math.max(0, ry + rh / 2 - zh / 2));
    const t = at(rest) + prop(rest, '--t', 0.2);
    tl.to(svg, { attr: { viewBox: `${zx} ${zy} ${zw} ${zh}` }, duration: 0.35, ease: 'power2.inOut' }, t)
      .to(svg, { attr: { viewBox: vb }, duration: 0.55, ease: 'power2.inOut' }, t + 0.5);
  },

  // the fee of 25 buys: the cheapest and the dearest land on the scale (the site has these two and the quantiles,
  // not the 25 values, and none are made up), the range joins them, then the band of the middle 80%, the median last
  fees(tl, svg) {
    const points = [...svg.querySelectorAll('circle.pop')], band = svg.querySelector('.seg');
    const range = [...svg.querySelectorAll('line.pop')].find((l) => !l.hasAttribute('data-fx-last'));
    points.forEach((el, i) => {
      const cy = +el.getAttribute('cy'), t = 0.1 + i * 0.18;
      tl.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.1 }, t)
        .fromTo(el, { attr: { cy: cy - 70 } }, { attr: { cy }, duration: 0.55, ease: 'bounce.out' }, t);
    });
    if (range) tween(tl, range, 0.6);
    if (band) tween(tl, band, 0.8);
    last(tl, svg, 0.15);
  },

  // the log of measurements: each day's bar rises in order, as entries are only ever added (the page's own 20 ms a
  // day, under the scroll); a day with no entries stays a gap
  log(tl, svg) {
    base(tl, svg);
  },
};

// ---------- tables ----------
// Rows come in as a staircase with the scroll, and back; the terminal fee bars grow with them. At the end every row
// and bar is cleared of inline styles, exactly the markup's table. A market row opens and closes smoothly: Flip
// takes the rows' places before the page's own click handler moves them, and animates from there. Flip loads when
// the market table comes near the window, so it is there by the first click.

const TABLE_CSS = '.js .ledger.fx-table[data-anim] tbody tr{opacity:1;transform:none;transition:none!important}'
  + '.js .fees.fx-table[data-anim] .hbar{transform:none;transition:none!important}';

function tables(gsap, ScrollTrigger, add) {
  const todo = [...document.querySelectorAll('table.ledger, table.market')].filter((t) => !t.classList.contains('in') && !onScreen(t));
  for (const table of todo) {
    add(() => {
      const rows = [...table.querySelectorAll('tbody tr')].filter((r) => !r.classList.contains('more') || r.classList.contains('open'));
      const bars = [...table.querySelectorAll('.hbar')], moved = [...rows, ...bars];
      const tl = gsap.timeline({ paused: true, onUpdate: () => { if (tl.progress() === 1) gsap.set(moved, { clearProps: 'opacity,transform' }); } });
      tl.fromTo(rows, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out', stagger: 0.06 }, 0);
      if (bars.length) tl.fromTo(bars, { scaleX: 0 }, { scaleX: 1, duration: 0.5, ease: 'power2.out', stagger: 0.06 }, 0.15);
      table.classList.add('fx-table');
      ScrollTrigger.create({ trigger: table, start: 'clamp(top 92%)', end: 'clamp(top 50%)', scrub: 0.3, animation: tl });
      undo.push(() => { table.classList.remove('fx-table'); gsap.set(moved, { clearProps: 'opacity,transform' }); });
    });
  }
  const market = document.querySelector('table.market');
  if (!market) return;
  const near = new IntersectionObserver(async ([e]) => {
    if (!e.isIntersecting) return;
    near.disconnect();
    await load('Flip');
    if (off) return;
    const { Flip } = window;
    const toggle = (ev) => {
      if (ev.type === 'keydown' && ev.key !== 'Enter' && ev.key !== ' ') return;
      if (off || !(ev.target.closest && ev.target.closest('tr.row'))) return;
      const state = Flip.getState(market.querySelectorAll('tbody tr'));
      requestAnimationFrame(() => Flip.from(state, { duration: 0.35, ease: 'power2.out', prune: true,
        onEnter: (els) => gsap.fromTo(els, { opacity: 0 }, { opacity: 1, duration: 0.3, clearProps: 'opacity' }) }));
    };
    market.addEventListener('click', toggle, true);       // capture: before the page's handler opens the row
    market.addEventListener('keydown', toggle, true);
    undo.push(() => { market.removeEventListener('click', toggle, true); market.removeEventListener('keydown', toggle, true); });
  }, { rootMargin: '300px 0px' });
  near.observe(market);
  undo.push(() => near.disconnect());
}

// ---------- start ----------

function onScreen(el) {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.bottom > 0 && r.top < innerHeight;
}

async function init() {
  if (off) return;
  const { gsap, ScrollTrigger, add } = await (await import('./scroll.js')).ready;
  if (off) return;
  const style = document.createElement('style');
  style.id = 'fx-charts-style';
  style.textContent = CSS + TABLE_CSS;
  document.head.appendChild(style);
  undo.push(() => style.remove());
  // which charts are still to come: measured once for all, before anything is written
  const todo = [...document.querySelectorAll('.chart[data-fx]')]
    .filter((c) => RULES[c.getAttribute('data-fx')] && !c.classList.contains('in') && !onScreen(c));
  tables(gsap, ScrollTrigger, add);
  // one chart per task, so no single long task holds the page (Lighthouse TBT)
  for (const chart of todo) {
    await new Promise((go) => setTimeout(go, 0));
    if (off) return;
    if (chart.classList.contains('in')) continue;          // the reader got there first: the page's own animation plays
    const rule = RULES[chart.getAttribute('data-fx')];
    add(() => {
      const master = gsap.timeline({ paused: true });
      for (const svg of chart.querySelectorAll('svg')) { const tl = gsap.timeline(); rule(tl, svg, gsap); master.add(tl, 0); }
      chart.classList.add('fx-chart');          // after the first frame is set: the chart never shows unbuilt-then-built
      ScrollTrigger.create({ trigger: chart, start: 'clamp(top 90%)', end: 'clamp(center 52%)', scrub: 0.4, animation: master });
    });
    undo.push(() => chart.classList.remove('fx-chart'));
  }
  FX.charts.ready = true;
}

// wait until a chart or a table is within a window's height below the screen (a tab opened with them near the top
// counts at once), then set everything up; start() does it now (the tests)
let begun = null;
const start = () => begun || (begun = init());
FX.charts = { ready: false, start };
(() => {
  if (off) return;
  const near = [...document.querySelectorAll('.chart[data-fx], table.ledger, table.market')];
  if (!near.length) return;
  const io = new IntersectionObserver((entries) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    io.disconnect();
    start();
  }, { rootMargin: '0px 0px 100% 0px' });
  for (const el of near) io.observe(el);
  undo.push(() => io.disconnect());
})();

export { start };
