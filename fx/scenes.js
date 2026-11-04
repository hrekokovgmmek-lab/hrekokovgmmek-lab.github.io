// artemvartanov.com — the signature scenes (demo/site/fx/scenes.js; plan demo/site/docs/fx-plan.md, stage 4).
// An element with data-scene gets the scene of that name, fx/scenes/<name>.js, drawn by the one WebGL stage (stage.js,
// three) inside the element's box and timed by the scroll (scroll.js). A scene's module, and three with the first one,
// load only when its element comes within a window's height of the screen: Lighthouse, which does not scroll, never
// sees them. The numbers come from the page's own data (<script id="fx-data">, written by build.py from the same
// sources as the charts). Every chart (.chart) also gets its depth (fx/depth.js, drawn in its SVG, no three.js) on
// the same terms: the owner's decision 04.11 — with effects the charts are always in 3D. FX.scenes.start() mounts them
// all at once (the tests).
const FX = window.FX || { on: false };
const CSS = '.js .chart.fx-scene .draw{stroke-dashoffset:0}.js .chart.fx-scene .pop,.js .chart.fx-scene .cell{opacity:1}'
  + '.js .chart.fx-scene .bar,.js .chart.fx-scene .seg{transform:none}.js .chart.fx-scene *{transition:none!important}';

let off = !FX.on;
const undo = [];
document.addEventListener('fx:off', () => { off = true; for (const f of undo.splice(0)) f(); }, { once: true });

let data = {};
try { data = JSON.parse(document.getElementById('fx-data').textContent); } catch (e) { /* no data: no scenes */ }

const mounted = new Map();
let style = null;

function mount(el) {
  if (mounted.has(el)) return mounted.get(el);
  const name = el.getAttribute('data-scene');
  const job = (async () => {
    const [stage, scroll, scene] = await Promise.all([import('./stage.js'), import('./scroll.js'), import(`./scenes/${name}.js`)]);
    const tools = await scroll.ready;
    if (off || !FX.on) return;
    if (!style) {
      style = document.createElement('style');
      style.id = 'fx-scenes-style';
      style.textContent = CSS;
      document.head.appendChild(style);
      undo.push(() => style.remove());
    }
    scene.mount({ el, stage, ...tools, data: data[name], undo: (f) => undo.push(f) });
  })();
  mounted.set(el, job);
  return job;
}

const deep = new Map();

function deepen(el) {
  if (deep.has(el)) return deep.get(el);
  const job = (async () => {
    const depth = await import('./depth.js');
    if (off || !FX.on) return;
    const handle = depth.mount({ el });
    undo.push(() => handle.remove());
  })();
  deep.set(el, job);
  return job;
}

const all = [...document.querySelectorAll('[data-scene]')], charts = [...document.querySelectorAll('.chart')];
const near = (el) => { if (el.matches('.chart')) deepen(el); if (el.hasAttribute('data-scene')) mount(el); };
if (!off && (all.length || charts.length)) {
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { io.unobserve(e.target); near(e.target); }
  }, { rootMargin: '0px 0px 100% 0px' });
  for (const el of new Set([...all, ...charts])) io.observe(el);
  undo.push(() => io.disconnect());
}

FX.scenes = { start: () => Promise.all([...charts.map(deepen), ...all.map(mount)]) };
