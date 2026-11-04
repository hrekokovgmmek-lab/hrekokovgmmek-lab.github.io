// artemvartanov.com — numbers, the tape and headings decode (demo/site/fx/text.js; plan demo/site/docs/fx-plan.md,
// stage 2). GSAP ScrambleTextPlugin, but never on the page's own text: the real text stays where it is, made
// transparent, so the layout and what a screen reader hears never change, and an aria-hidden, inert copy laid exactly
// over it does the scrambling. When the copy settles it goes, and the page is again exactly its markup.
//   numbers   [data-scramble] — the bot's figures and three investigation tiles — when they come into view; digits
//             only, and the ▲ ▼ in front gives a short jolt when the number lands
//   glitch    [data-glitch] — "near zero" — two jolts, under 300 ms
//   tape      each fact as it enters the strip. The strip moves on the compositor, where observers do not see it,
//             so its items are polled five times a second while it is on screen
//   headings  h2 as they come into view; on a change of language every heading and number on screen (the h1 too)
//             runs from the old language's text to the new one
// Only digits and letters change, each from its own alphabet; spaces, signs and units stay. What is on screen when
// this starts has been seen already and is left alone. 'fx:off' stops everything and removes every copy.
// The page's own count-up (about.html, data-count) stands aside while the class fx-text is on <html>.
import { load } from './gsap.js';

const FX = window.FX || { on: false };
const root = document.documentElement;
const DIGITS = '0123456789';
const LATIN = 'abcdefghijklmnopqrstuvwxyz', CYR = 'абвгдежзийклмнопрстуфхцчшщыьэюя';
const RUN = /[0-9]+|[A-Za-z]+|[Ѐ-ӿ]+/g;
const DUR = { number: 0.9, heading: 0.7, tape: 0.75, swap: 0.55 };
const DELAY = { number: 0.1, glitch: 0.35, heading: 0, tape: 0, swap: 0 };
const CSS = 'fx-twin{display:block;position:absolute;left:0;top:0;margin:0;padding:0;border:0;pointer-events:none;'
  + 'user-select:none;-webkit-user-select:none}fx-twin .fx-arrow{display:inline-block}';

let gsap = null, off = !FX.on, brick = '#a84b36', style = null;
const active = new Map();        // host → { tl, undo }
const seen = new WeakSet();      // animated once, or on screen when this started
const observers = [], stops = [];

// ---------- the copy ----------

function firstBox(node) {
  const walk = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
  for (let t = walk.nextNode(); t; t = walk.nextNode()) {
    if (!t.data.trim()) continue;
    const range = document.createRange();
    range.selectNodeContents(t);
    const box = range.getClientRects()[0];
    if (box) return box;
  }
  return null;
}

// lay an aria-hidden copy of `real` over it, inside `host`, and make the real one transparent
// one inline property on, and back to exactly the attribute that was there. Through the attribute, not el.style:
// Chrome writes el.style into the attribute lazily, and a cleared one could come back as style="" in the markup
function restyle(el, prop, value) {
  const had = el.getAttribute('style');
  el.setAttribute('style', (had ? had.replace(/;?\s*$/, ';') : '') + `${prop}:${value}`);
  return () => { if (had === null) el.removeAttribute('style'); else el.setAttribute('style', had); };
}

function cover(host, real, width) {
  const undo = [];
  if (getComputedStyle(host).position === 'static') undo.push(restyle(host, 'position', 'relative'));
  const twin = document.createElement('fx-twin');
  twin.setAttribute('aria-hidden', 'true');
  twin.inert = true;
  const copy = real.cloneNode(true);
  for (const el of [copy, ...copy.querySelectorAll('*')])
    for (const a of ['id', 'data-count', 'data-scramble', 'data-glitch', 'tabindex']) el.removeAttribute(a);
  twin.appendChild(copy);
  if (width) twin.style.width = width + 'px'; else twin.style.whiteSpace = 'nowrap';
  host.appendChild(twin);
  const a = firstBox(real), b = firstBox(copy);
  if (a && b) { twin.style.left = a.left - b.left + 'px'; twin.style.top = a.top - b.top + 'px'; }
  undo.push(restyle(real, 'opacity', '0'));
  return { twin, copy, undo() { twin.remove(); while (undo.length) undo.pop()(); } };
}

function alphabet(word) {
  if (word.charCodeAt(0) < 58) return DIGITS;
  const set = /[A-Za-z]/.test(word) ? LATIN : CYR;
  return word.length > 1 && word === word.toUpperCase() ? set.toUpperCase() : set;
}

// split the copy's visible text into runs of digits or letters, each in an element of its own
function runs(copy, digitsOnly) {
  const nodes = [], out = [];
  const walk = document.createTreeWalker(copy, NodeFilter.SHOW_TEXT);
  for (let t = walk.nextNode(); t; t = walk.nextNode()) if (t.parentElement.getClientRects().length) nodes.push(t);
  for (const t of nodes) {
    const s = t.data, frag = document.createDocumentFragment();
    let last = 0;
    for (const m of s.matchAll(RUN)) {
      const word = m[0];
      if (digitsOnly && word.charCodeAt(0) > 57) continue;
      if (m.index > last) frag.append(s.slice(last, m.index));
      const run = document.createElement('fx-r');     // an element of its own: no rule of the page's matches it
      run.textContent = word;
      frag.append(run);
      out.push({ el: run, text: word, chars: alphabet(word) });
      last = m.index + word.length;
    }
    if (last) { if (last < s.length) frag.append(s.slice(last)); t.replaceWith(frag); }
  }
  // each run keeps the width of its final text: letters differ in width, and anything that moved inside the copy
  // would count as layout shift too (CLS counts every visible box, absolute ones included). So nothing moves, and
  // the copy breaks its lines exactly where the real text does
  const widths = out.map((r) => r.el.getBoundingClientRect().width);
  out.forEach((r, i) => { r.el.style.cssText = `display:inline-block;width:${widths[i]}px;white-space:nowrap`; });
  return out;
}

function noise(n, chars) {
  let s = '';
  while (n-- > 0) s += chars[(Math.random() * chars.length) | 0];
  return s;
}

// from: the old language's text. Its letters and digits, in order, fill the runs at the start, so the old words
// visibly turn into the new ones; with no from, each run starts as noise
function scramble(list, dur, from) {
  const tl = gsap.timeline();
  const total = list.reduce((n, r) => n + r.text.length, 0) || 1;
  const pool = (from || '').replace(/[^0-9A-Za-z\u0400-\u04FF]+/g, '');
  let done = 0, taken = 0;
  for (const r of list) {
    const old = pool.substr(taken, r.text.length);
    taken += r.text.length;
    r.el.textContent = old + noise(r.text.length - old.length, r.chars);
    const d = Math.min(dur * 0.7, 0.2 + 0.035 * r.text.length);
    tl.to(r.el, { duration: d, ease: 'none',
      scrambleText: { text: r.text, chars: r.chars, speed: 0.7, revealDelay: Math.min(0.15, d * 0.4) } },
    (done / total) * (dur - d));
    done += r.text.length;
  }
  return tl;
}

// a jolt: shifted with a brick edge, then a slice, then still; 180 ms
function jolt(tl, el, at) {
  tl.set(el, { x: -3, textShadow: `2px 0 ${brick}` }, at)
    .set(el, { x: 2, textShadow: `-2px 0 ${brick}`, clipPath: 'inset(0 0 46% 0)' }, at + 0.09)
    .set(el, { x: 0, textShadow: 'none', clipPath: 'none' }, at + 0.18);
}

function arrowOf(copy) {
  const walk = document.createTreeWalker(copy, NodeFilter.SHOW_TEXT);
  for (let t = walk.nextNode(); t; t = walk.nextNode()) {
    const i = t.data.search(/[▲▼]/);
    if (i < 0) continue;
    const mark = t.splitText(i), arrow = document.createElement('fx-r');
    mark.splitText(1);
    arrow.className = 'fx-arrow';
    arrow.textContent = mark.data;
    mark.replaceWith(arrow);
    return arrow;
  }
  return null;
}

// ---------- one animation per host ----------

function finish(host) {
  const a = active.get(host);
  if (!a) return;
  active.delete(host);
  a.undo();
}

function stop(host) {
  const a = active.get(host);
  if (a) { a.tl.kill(); finish(host); }
}

function contentWidth(el) {
  const cs = getComputedStyle(el);
  return el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
}

function play(host, real, kind, from, unwrap) {
  stop(host);
  const block = kind === 'heading' || getComputedStyle(real).display === 'block';
  const width = kind === 'heading' ? contentWidth(host) : block ? real.getBoundingClientRect().width : 0;
  const c = cover(host, real, width);
  const tl = gsap.timeline({ delay: from ? 0 : DELAY[kind], onComplete: () => finish(host) });
  if (kind === 'glitch') {
    jolt(tl, c.copy, 0);
    tl.to({}, { duration: 0.24 }, 0);            // 240 ms in all, then the real text again
  } else {
    tl.add(scramble(runs(c.copy, kind === 'number'), from ? DUR.swap : DUR[kind], from));
    const arrow = kind === 'number' && arrowOf(c.copy);
    if (arrow) jolt(tl, arrow, tl.duration());
  }
  active.set(host, { tl, undo: () => { c.undo(); if (unwrap) unwrap(); } });
}

const lang = () => root.getAttribute('data-lang');

function ownLang(el, l = lang()) {
  return [...el.children].find((c) => c.getAttribute('data-l') === l) || null;
}

function start(el, kind, from = '') {
  if (off) return;
  if (kind === 'heading') {
    const own = ownLang(el);
    if (own) { play(el, own, kind, from); return; }
    const wrap = document.createElement('fx-wrap');   // an h2 of one language: its text goes into a wrapper for the time
    while (el.firstChild) wrap.appendChild(el.firstChild);
    el.appendChild(wrap);
    play(el, wrap, kind, from, () => { while (wrap.firstChild) el.insertBefore(wrap.firstChild, wrap); wrap.remove(); });
  } else if (kind === 'tape') {
    const own = ownLang(el);
    if (own) play(el, own, kind, from);
  } else {
    play(el.parentElement, el, kind, from);
  }
}

// ---------- when ----------

function watch(list, kind, ratio) {
  const first = new Set(list);
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const el = e.target;
      if (first.delete(el) && e.isIntersecting) { seen.add(el); io.unobserve(el); continue; }   // on screen already
      if (seen.has(el)) { io.unobserve(el); continue; }
      if (e.intersectionRatio < ratio) continue;
      seen.add(el);
      io.unobserve(el);
      start(el, kind);
    }
  }, { threshold: [0, ratio] });
  for (const el of list) io.observe(el);
  observers.push(io);
}

function tape() {
  const strip = document.querySelector('.tape'), win = strip && strip.querySelector('.tape-win');
  if (!win) return;
  const items = [...win.querySelectorAll('.tape-item')], left = new Map();
  let timer = 0;
  const tick = () => {
    if (off || document.hidden) return;
    const edge = win.getBoundingClientRect().right - 2;
    for (const it of items) {
      const x = it.getBoundingClientRect().left, was = left.get(it);
      left.set(it, x);
      if (was !== undefined && was >= edge && x < edge && !active.has(it)) start(it, 'tape');   // coming in on the right
    }
  };
  const io = new IntersectionObserver(([e]) => {
    clearInterval(timer);
    left.clear();
    if (e.isIntersecting) { tick(); timer = setInterval(tick, 200); }
  });
  io.observe(strip);
  observers.push(io);
  stops.push(() => clearInterval(timer));
}

function onScreen(el) {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
}

function flat(node, l) {
  let s = '';
  for (const n of node.childNodes) {
    if (n.nodeType === 3) s += n.data;
    else if (n.nodeType === 1 && !(n.hasAttribute('data-l') && n.getAttribute('data-l') !== l)) s += flat(n, l);
  }
  return s;
}

function counterpart(el, l) {
  for (const s of [el.previousElementSibling, el.nextElementSibling]) if (s && s.getAttribute('data-l') === l) return s;
  return null;
}

function oldText(el, kind, was) {
  if (kind === 'heading' || kind === 'tape') {
    const own = ownLang(el, was);
    if (own) return flat(own, was);
  }
  const pair = el.hasAttribute('data-l') ? counterpart(el, was) : null;
  return pair ? flat(pair, was) : flat(el, was);
}

function languages() {
  const mo = new MutationObserver((records) => {
    const was = records[0].oldValue, now = lang();
    if (off || !was || was === now) return;
    const items = [...document.querySelectorAll('h1'), ...document.querySelectorAll(`main h2[data-l="${now}"]`)]
      .map((el) => [el, 'heading'])
      .concat([...document.querySelectorAll('[data-scramble], [data-glitch]')]
        .map((el) => [el, el.hasAttribute('data-glitch') ? 'glitch' : 'number']))
      .concat([...document.querySelectorAll('.tape-item')].map((el) => [el, 'tape']));
    for (const [el, kind] of items) {
      if (!onScreen(el)) continue;
      seen.add(el);
      start(el, kind, kind === 'glitch' ? '' : oldText(el, kind, was) || ' ');
    }
  });
  mo.observe(root, { attributes: true, attributeFilter: ['data-lang'], attributeOldValue: true });
  observers.push(mo);
}

// ---------- start and stop ----------

document.addEventListener('fx:off', () => {
  off = true;
  for (const host of [...active.keys()]) stop(host);
  for (const o of observers.splice(0)) o.disconnect();
  for (const f of stops.splice(0)) f();
  root.classList.remove('fx-text');
  if (style) style.remove();
}, { once: true });

async function init() {
  if (off) return;
  gsap = await load('ScrambleTextPlugin');
  if (off) return;
  brick = getComputedStyle(root).getPropertyValue('--brick').trim() || brick;
  style = document.createElement('style');
  style.id = 'fx-text-style';
  style.textContent = CSS;
  document.head.appendChild(style);
  root.classList.add('fx-text');
  watch([...document.querySelectorAll('[data-scramble]')], 'number', 0.35);
  watch([...document.querySelectorAll('[data-glitch]')], 'glitch', 0.35);
  watch([...document.querySelectorAll('main h2')], 'heading', 0.6);
  tape();
  languages();
}

export const ready = init();
FX.text = { busy: () => active.size, ready };
