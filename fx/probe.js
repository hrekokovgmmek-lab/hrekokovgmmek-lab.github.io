// artemvartanov.com — the ?fx=test self-check (demo/site/fx/probe.js; plan demo/site/docs/fx-plan.md, stage 1).
// No page uses it: only the address flag loads it, through policy.js. A small square turns in the corner of the page
// head and another in the footer, both drawn by stage.js, so two scenes share the one renderer. A note in the bottom
// corner shows, on any device, phones included:
//   fx    on, or off and why
//   gl    the context · device pixels per CSS pixel · scenes on screen / scenes
//   loop  running or stopped (and why) · frames drawn · contexts lost
//   st    ScrollTrigger: the open tab's trigger, start–end in px and progress
import * as stage from './stage.js';
import { ready } from './scroll.js';

const FX = window.FX;
const first = (...sel) => { for (const s of sel) { const el = document.querySelector(s); if (el) return el; } return document.body; };
const head = first('.hero', '.frame', 'main');
const foot = document.querySelector('footer');

const note = document.createElement('pre');
note.id = 'fx-probe';
note.setAttribute('aria-hidden', 'true');
note.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:40;margin:0;padding:6px 8px;max-width:calc(100vw - 16px);'
  + 'font:11px/1.45 ui-monospace,"SF Mono",Menlo,Consolas,monospace;white-space:pre-wrap;background:var(--paper,#f4f2ec);'
  + 'color:var(--ink,#1f1f1f);border:1px solid var(--rule,#dedad1);pointer-events:none';
document.body.appendChild(note);

function square(el, token) {
  return stage.add({
    el,
    setup({ THREE, color }) {
      const s = 9, corners = [[-s, -s], [s, -s], [s, s], [-s, s]].map(([x, y]) => new THREE.Vector3(x, y, 0));
      this.scene = new THREE.Scene();
      this.camera = new THREE.OrthographicCamera(0, 1, 1, 0, -1, 1);     // the element's box in CSS pixels
      this.mark = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(corners),
        new THREE.LineBasicMaterial({ color: color(token) }));
      this.scene.add(this.mark);
    },
    frame(t, dt, w, h, renderer) {
      this.camera.right = w; this.camera.top = h; this.camera.updateProjectionMatrix();
      this.mark.position.set(w - 20, h - 20, 0);
      this.mark.rotation.z = t * 0.9;
      renderer.render(this.scene, this.camera);
    },
    dispose() { this.mark.geometry.dispose(); this.mark.material.dispose(); },
  });
}
square(head, '--brick');
if (foot) square(foot, '--ink');

let st = null;
ready.then(({ ScrollTrigger, add }) => {
  add(() => {
    const panels = document.querySelectorAll('[role=tabpanel]');
    for (const p of panels) ScrollTrigger.create({ id: 'fx-probe-' + p.id, trigger: p, start: 'top bottom', end: 'bottom top' });
    if (!panels.length) ScrollTrigger.create({ id: 'fx-probe-head', trigger: head, start: 'top bottom', end: 'bottom top' });
  });
  st = ScrollTrigger;
}, (e) => { st = { error: String(e) }; });

function write() {
  const s = stage.state();
  const why = s.hidden ? ' (page hidden)' : s.lost ? ' (context lost)' : s.scenes && !s.seen ? ' (nothing on screen)' : '';
  const out = [
    'fx    ' + (FX.on ? 'on' : 'off · ' + FX.why.join(', ')),
    'gl    ' + s.gl + ' · dpr ' + s.dpr + ' · scenes ' + s.seen + '/' + s.scenes,
    'loop  ' + (s.running ? 'running' : 'stopped' + why) + ' · frames ' + s.frames + ' · lost ' + s.losses,
  ];
  if (st && st.error) out.push('st    ' + st.error);
  else if (st && st.getById) {
    const open = document.querySelector('[role=tabpanel]:not([hidden])');
    const t = st.getById('fx-probe-' + (open ? open.id : 'head'));
    if (t) out.push('st    ' + (open ? open.id + ' ' : '') + Math.round(t.start) + '–' + Math.round(t.end) + ' · ' + t.progress.toFixed(2));
  }
  note.textContent = out.join('\n');
}
write();
setInterval(write, 400);
FX.probe = { stage, ready };
