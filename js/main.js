// Запуск: язык, плавная прокрутка, общий цикл кадров, герой (WebGL — модулем, не блокирует отрисовку), история, эффекты.
import Lenis from '/vendor/lenis-1.1.13/lenis.mjs';
import { initFx } from '/js/fx.js';
import { initStory } from '/js/story.js';
import { initStoryArt } from '/js/story-art.js';

const root = document.documentElement;
const cfg = JSON.parse(document.getElementById('site-config').textContent);
const T = cfg.hero.tuning;
const clamp01 = (x) => Math.min(1, Math.max(0, x));

const S = {
  cfg,
  motion: root.classList.contains('anim'),
  fine: matchMedia('(hover: hover) and (pointer: fine)').matches,
  W: innerWidth, H: innerHeight, svh: innerHeight, P: 0, y: 0,
  stageTop: 0, stageH: 1, storyDim: 0, stage: null, lenis: null,
};
window.__S = S;

// ---------- язык ----------
function setLang(l) {
  if (!cfg.langs.includes(l)) return;
  root.lang = l; root.dataset.lang = l;
  try { localStorage.setItem('lang', l); } catch { /* приватный режим */ }
  for (const el of document.querySelectorAll('[data-' + l + ']')) {
    const v = el.getAttribute('data-' + l);
    if (el.tagName === 'IMG' || el.tagName === 'VIDEO') el.setAttribute(el.tagName === 'IMG' ? 'alt' : 'aria-label', v);
    else el.setAttribute('aria-label', v);
  }
  for (const b of document.querySelectorAll('[data-set-lang]')) b.setAttribute('aria-pressed', String(b.dataset.setLang === l));
  dispatchEvent(new Event('langchange'));
}
for (const b of document.querySelectorAll('[data-set-lang]')) b.addEventListener('click', () => setLang(b.dataset.setLang));
setLang(root.dataset.lang || cfg.langs[0]);

// ---------- размеры ----------
const probe = document.querySelector('.svh-probe');
const stageEl = document.getElementById('stage');
function measure() {
  S.W = innerWidth; S.H = innerHeight;
  S.svh = probe ? probe.offsetHeight || innerHeight : innerHeight;
  S.phone = S.W <= T.phone.breakpoint;
  if (stageEl) {
    const r = stageEl.getBoundingClientRect();
    S.stageTop = r.top + scrollY; S.stageH = r.height;
  }
}
measure();
addEventListener('resize', measure);

// ---------- плавная прокрутка ----------
if (S.motion) {
  S.lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
  root.classList.add('lenis', 'lenis-smooth');
}

// ---------- общий цикл кадров ----------
const tickers = [];
const errors = new Map();
function addTicker(fn) { tickers.push(fn); }
let last = performance.now();
function loop(now) {
  requestAnimationFrame(loop); // первой строкой: одна ошибка не морозит страницу
  const dt = Math.min(0.1, Math.max(0, (now - last) / 1000)); last = now;
  S.lenis?.raf(now);
  S.y = scrollY;
  S.P = clamp01((S.y - S.stageTop) / Math.max(1, S.stageH - S.H));
  for (const fn of tickers) {
    try { fn(now / 1000, dt); } catch (e) {
      const n = (errors.get(fn) || 0) + 1; errors.set(fn, n);
      if (n <= 3) console.error(e);
    }
  }
}
requestAnimationFrame(loop);

// Прыжок по P — для проверок снимками.
window.__goP = (p) => {
  const y = S.stageTop + p * (S.stageH - S.H);
  if (S.lenis) S.lenis.scrollTo(y, { immediate: true, force: true }); else scrollTo(0, y);
};
window.__goY = (y) => { if (S.lenis) S.lenis.scrollTo(y, { immediate: true, force: true }); else scrollTo(0, y); };

// ---------- герой ----------
let heroUp = null;
const heroReady = new Promise((r) => { heroUp = r; });
async function initHero() {
  const canvas = document.getElementById('gl');
  let ok = false;
  try {
    const c = document.createElement('canvas');
    const g = c.getContext('webgl2');
    ok = !!g && !!g.getExtension('EXT_color_buffer_float');
    g?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch { ok = false; }
  if (!ok || new URLSearchParams(location.search).has('nogl')) { heroUp(false); return; }
  try {
    const { createStage } = await import('/js/hero/stage.js');
    const stage = await createStage(canvas, S);
    S.stage = stage;
    const wait = stage.introMs; // имя расшифровывается, когда при входе раскрывается светлый круг
    stage.onFirstFrame = () => { root.classList.add('gl'); setTimeout(() => heroUp(true), wait); };
    addTicker((t, dt) => stage.frame(t, dt));
  } catch (e) {
    console.error('WebGL не поднялся, остаётся статичный герой', e);
    heroUp(false);
  }
}
initHero();
setTimeout(() => heroUp(false), 5000);
// вход без WebGL или без портрета — меню и подписи сразу; страховка — через 6 с в любом случае
heroReady.then((ok) => { if (!ok) root.classList.remove('intro'); });
setTimeout(() => root.classList.remove('intro'), 6000);

initFx(S, addTicker, heroReady);
initStory(S, addTicker);
initStoryArt(S, addTicker);
