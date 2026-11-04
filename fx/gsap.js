// artemvartanov.com — gsap and its plugins, each loaded once (demo/site/fx/gsap.js; plan demo/site/docs/fx-plan.md).
// The npm builds in fx/gsap-3.15.0/ are classic scripts that put gsap and each plugin on window. This loads the core
// once, then each plugin asked for once, in order, and registers them:
//   import { load } from './gsap.js';   const gsap = await load('ScrollTrigger', 'ScrambleTextPlugin');
const DIR = new URL('./gsap-3.15.0/', import.meta.url);
const files = new Map();

function script(name) {
  if (!files.has(name)) {
    files.set(name, new Promise((ok, fail) => {
      if (window[name]) { ok(); return; }
      const s = document.createElement('script');
      s.src = new URL(name + '.min.js', DIR).href;
      s.onload = ok;
      s.onerror = () => fail(new Error('fx: cannot load ' + s.src));
      document.head.appendChild(s);
    }));
  }
  return files.get(name);
}

export async function load(...plugins) {
  await script('gsap');
  for (const name of plugins) await script(name);
  const gsap = window.gsap;
  for (const name of plugins) gsap.registerPlugin(window[name]);
  return gsap;
}
