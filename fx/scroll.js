// artemvartanov.com — scroll-linked effects (demo/site/fx/scroll.js; plan demo/site/docs/fx-plan.md, stage 1).
// GSAP and ScrollTrigger are the npm builds in fx/gsap-3.15.0/, loaded once, the first time this module is imported.
// The page scrolls natively: no Lenis (the plan has it as optional; it would fight the sticky tab bar, and on touch
// screens it would be off anyway).
// About shows one tab at a time and the closed ones are hidden (no box), so a trigger inside a closed tab has no
// position until its tab opens. The page's tab code sends 'tabchange' on document; then, and again when the tab's
// entrance animation ends, every start and end is measured anew. Any other change of the page's height (the tools
// filter, an opened table row, the other language) does the same.
// Every effect goes into one gsap.context, so 'fx:off' puts the page back as it was.
//   import { ready } from './scroll.js';
//   const { gsap, ScrollTrigger, add } = await ready;
//   add(() => gsap.to(el, { scrollTrigger: { trigger: el, scrub: true }, … }));
import { load } from './gsap.js';

// effects may go off while gsap is still loading (no GL, reduced motion): listen from the start, and after that
// add() does nothing, so no trigger outlives the effects
let off = !(window.FX && window.FX.on);
const undo = [];
document.addEventListener('fx:off', () => { off = true; for (const f of undo.splice(0)) f(); }, { once: true });

async function boot() {
  const gsap = await load('ScrollTrigger');
  const { ScrollTrigger } = window;
  ScrollTrigger.config({ ignoreMobileResize: true });   // a phone's address bar coming and going is not a new layout
  const ctx = gsap.context(() => {});
  const add = (fn) => (off ? undefined : ctx.add(fn));
  if (off) return { gsap, ScrollTrigger, ctx, add, refresh() {} };
  let timer = 0, height = -1;
  const refresh = () => {
    clearTimeout(timer); timer = 0;
    ScrollTrigger.refresh();
    height = document.body.offsetHeight;
  };
  const soon = (ms) => { clearTimeout(timer); timer = setTimeout(refresh, ms); };
  const onTab = () => requestAnimationFrame(refresh);
  const onAnim = (e) => { if (e.target.getAttribute && e.target.getAttribute('role') === 'tabpanel') soon(0); };
  document.addEventListener('tabchange', onTab);
  document.addEventListener('animationend', onAnim);
  const ro = new ResizeObserver(() => { if (document.body.offsetHeight !== height) soon(120); });
  ro.observe(document.body);
  undo.push(() => {
    ro.disconnect();
    clearTimeout(timer);
    document.removeEventListener('tabchange', onTab);
    document.removeEventListener('animationend', onAnim);
    ctx.revert();
    for (const t of ScrollTrigger.getAll()) t.kill();
  });
  return { gsap, ScrollTrigger, ctx, add, refresh };
}

export const ready = boot();
