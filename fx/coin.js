// artemvartanov.com — the coin page's effects (demo/site/fx/coin.js; plan demo/site/docs/fx-plan.md, stage 5).
// The coin page is a tool: what the chain and the market say never shows later than it would without effects.
//   verdict   while the chain is read, a window of three letters runs across "Checking the coin…": small patches in
//             the verdict's own colour lie over those letters and show other letters in their place. The page's text
//             is never touched — not its markup, not its style, not what a screen reader hears. The moment the page
//             writes the answer, the patches go in the same task (a MutationObserver runs before the frame is drawn),
//             so the answer is painted in the very frame it would be painted without effects. "Dangerous" — from the
//             chain or a GeckoTerminal honeypot — then gets two jolts in 240 ms: shifted 2–3 px with an edge of
//             another colour, the text whole and readable throughout (Web Animations: no markup changes either).
//   market cap  an odometer. With this module on, the page writes the new market cap at once (its own count-up
//             stands aside, as on About); over each digit that changed lies a patch whose strip of digits rolls from
//             the old digit to the new one in 700 ms, as long as the count-up took — up when the cap grew, down when it
//             fell. A number that changed its shape ($9.9K → $10.1K, K → M) slides: the old one up, the new one in from
//             below. The first value, a new coin and the other language appear at once. Patches only: no layout moves,
//             nothing outside the number changes, the chart is not drawn again.
//   holders   the four groups of "Who holds the coin" as spheres: area ∝ share, the groups' own colours, shaded from
//             the paper and ink tokens, standing on a floor; they take the bar's place, the list under them stays. They
//             grow to their size once per coin (0.78 s, never past it), starting as the card's own rise makes it
//             visible. A card already on screen when this module arrives keeps its bar until the next coin: swapping
//             it then would move the page.
//   trades    the page sends 'coin:trade' with the chart's coordinates of the newest trade of a batch (one batch every
//             5 s); a ring flashes there for about half a second, green for a buy, brick for a sell — never more than
//             three a second. The ring is DOM over the chart; the chart itself is not drawn again for it.
// No gsap and no three: the page is a tool, and 80+ KB of libraries on a phone would compete with the APIs' answers.
// The page loads this when a coin opens (FX.use('coin')). 'fx:off' stops everything and takes every trace away.
const FX = window.FX || { on: false };
const root = document.documentElement;
const CSS = 'html.fx-coin #verdict{position:relative}'
  + 'fx-scan{position:absolute;left:0;top:0;width:0;height:0;pointer-events:none}'
  + 'fx-glyph{position:absolute;display:block;overflow:hidden;text-align:center;white-space:nowrap;visibility:hidden}'
  + 'fx-odo{position:absolute;display:block;overflow:hidden;pointer-events:none;color:inherit}'
  + 'fx-strip{display:block;will-change:transform}fx-line{display:block;white-space:nowrap;text-align:left}'
  + '#spread .stack.fx-hid{display:none}svg.fx-spheres{display:block;width:100%;overflow:visible}'
  + 'fx-ping{position:absolute;width:0;height:0;z-index:2;pointer-events:none}'
  + 'fx-ring,fx-dot{position:absolute;left:0;top:0;display:block;border-radius:50%}'
  + 'fx-ring{width:18px;height:18px;margin:-9px 0 0 -9px;border:2px solid currentColor;box-sizing:border-box}'
  + 'fx-dot{width:6px;height:6px;margin:-3px 0 0 -3px;background:currentColor}';
const ALPHA = { latin: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', cyr: 'АБВГДЕЖЗИКЛМНОПРСТУФХЦЧШЭЮЯ' };
const SCAN = { width: 3, step: 65, tick: 50, rest: 520 };   // letters in the window; ms a letter; ms a glyph; ms between passes
const JOLT = 240;
const ROLL = 700, SLIDE = 450, EASE_OUT = 'cubic-bezier(.33,1,.68,1)';   // the page's count-up: 700 ms, cubic ease-out
const GROW = 600, STAGGER = 60, EASE = 'cubic-bezier(.2,.7,.2,1)';      // the page's --ease: it never passes 1
const PING = 560, PING_GAP = 340;                                       // under three a second

let off = !FX.on, style = null;
const stops = [];
const state = { scanning: false, passes: 0, jolts: 0, glyphs: 0, rolls: 0, slides: 0, spheres: 0, grown: 0, flashes: 0 };

const token = (name, fallback) => getComputedStyle(root).getPropertyValue(name).trim() || fallback;
const pick = (s) => s[(Math.random() * s.length) | 0];

// ---------- 1. the verdict ----------

function verdict() {
  const v = document.getElementById('verdict'), b = document.getElementById('vText');
  if (!v || !b) return;
  const levelOf = () => (/\bverdict\s+(\w+)/.exec(v.className) || [])[1] || '';
  let level = levelOf(), layer = null, cells = [], timer = 0, t0 = 0, text = '';

  // one patch per letter, fixed over it; the window only shows and hides them, so nothing ever moves
  function build() {
    unbuild();
    const node = b.firstChild;
    if (!node || node.nodeType !== 3 || !b.getClientRects().length) return;
    text = node.data;
    const vr = v.getBoundingClientRect(), cs = getComputedStyle(b), bg = getComputedStyle(v).backgroundColor;
    const range = document.createRange();
    layer = document.createElement('fx-scan');
    layer.setAttribute('aria-hidden', 'true');
    layer.inert = true;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (!/[0-9A-Za-zЀ-ӿ]/.test(ch)) continue;
      range.setStart(node, i);
      range.setEnd(node, i + 1);
      const r = range.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const g = document.createElement('fx-glyph');
      // the font shorthand first: it resets line-height, which must be the letter's own box so the glyph sits on
      // the same baseline as the letter it covers
      g.style.cssText = `font:${cs.font};line-height:${r.height.toFixed(2)}px;letter-spacing:normal;`
        + `left:${(r.left - vr.left - v.clientLeft).toFixed(2)}px;top:${(r.top - vr.top - v.clientTop).toFixed(2)}px;`
        + `width:${r.width.toFixed(2)}px;height:${r.height.toFixed(2)}px;background:${bg};color:${cs.color}`;
      layer.appendChild(g);
      cells.push({ g, set: /[A-Za-z]/.test(ch) ? ALPHA.latin : ALPHA.cyr, on: false });
    }
    v.appendChild(layer);
  }

  function unbuild() {
    if (layer) layer.remove();
    layer = null;
    cells = [];
  }

  function tick() {
    if (document.hidden || !cells.length) return;
    const n = cells.length, span = n + SCAN.width;
    const pass = span * SCAN.step + SCAN.rest;
    const t = performance.now() - t0, k = t % pass;
    state.passes = Math.floor(t / pass);
    const head = Math.floor(k / SCAN.step);                  // the window's front letter; past the end: resting
    cells.forEach((c, i) => {
      const on = k < span * SCAN.step && i <= head && i > head - SCAN.width;
      if (on) { c.g.textContent = pick(c.set); state.glyphs++; }
      if (on !== c.on) { c.on = on; c.g.style.visibility = on ? 'visible' : 'hidden'; }
    });
  }

  function scan() {
    stopScan();
    build();
    if (!cells.length) return;
    t0 = performance.now();
    state.scanning = true;
    timer = setInterval(tick, SCAN.tick);
  }

  function stopScan() {
    clearInterval(timer);
    timer = 0;
    state.scanning = false;
    unbuild();
  }

  function jolt() {
    state.jolts++;
    const ink = token('--ink', '#1f1f1f'), sand = token('--sand', '#cdbf9f');
    b.animate([
      { transform: 'translateX(-3px)', textShadow: `3px 0 ${ink}`, easing: 'step-end', offset: 0 },
      { transform: 'translateX(2px)', textShadow: `-2px 0 ${sand}`, easing: 'step-end', offset: 0.375 },
      { transform: 'none', textShadow: 'none', offset: 0.75 },
      { transform: 'none', textShadow: 'none', offset: 1 },
    ], { duration: JOLT });
  }

  // every change of the verdict's class or text: the answer (patches off at once), the other language, a new coin
  const seen = () => {
    if (off) return;
    const now = levelOf();
    if (now === 'checking') { if (!state.scanning || b.textContent !== text) scan(); }
    else if (state.scanning) stopScan();
    if (now === 'danger' && level !== 'danger') jolt();
    level = now;
  };
  const mo = new MutationObserver(seen);
  mo.observe(v, { attributes: true, attributeFilter: ['class'] });
  mo.observe(b, { childList: true, characterData: true, subtree: true });
  const ro = new ResizeObserver(() => { if (state.scanning) scan(); });
  ro.observe(v);
  stops.push(() => { mo.disconnect(); ro.disconnect(); stopScan(); for (const a of b.getAnimations()) a.cancel(); });
  if (level === 'checking') scan();
}

// ---------- 2. the market cap: an odometer ----------

function odometer() {
  const price = document.getElementById('price');
  if (!price) return;
  // the page's own text is the first child; the patches come after it and are not part of it
  const own = () => { const n = price.firstChild; return n && n.nodeType === 3 ? n.data : ''; };
  let last = own(), lastLang = root.getAttribute('data-lang'), lastV = Number(price.dataset.v), patches = [];
  const shape = (s) => s.replace(/[0-9]/g, '0');
  // the patches need the number positioned, but only while they are there: a number positioned at rest counts as one
  // more thing that moves when the blocks above it grow, and that shift scored 3× higher on a phone (docs/stage-5.md)
  const clear = () => { for (const p of patches) p.remove(); patches = []; price.removeAttribute('style'); };

  // the window a strip shows through: the band where the ink of `text` lies (a counter's window), not the whole
  // height of the line — so mid-roll only the digits coming and going show, nothing above or below the number
  let pen = null;
  function band(text) {
    pen = pen || document.createElement('canvas').getContext('2d');
    // from the longhands: with tabular-nums on, Chrome gives the font shorthand as an empty string
    const cs = getComputedStyle(price);
    pen.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const m = pen.measureText(text);
    return { base: m.fontBoundingBoxAscent, up: m.actualBoundingBoxAscent, down: m.actualBoundingBoxDescent };
  }

  // a patch over the text from character i to j, its strip showing `lines` top to bottom
  function patch(node, pr, bg, i, j, lines, ink) {
    const range = document.createRange();
    range.setStart(node, i);
    range.setEnd(node, j);
    const r = range.getBoundingClientRect(), h = r.height;
    const top = Math.max(0, ink.base - ink.up - 2), bottom = Math.max(0, h - ink.base - ink.down - 2);
    const p = document.createElement('fx-odo');
    p.setAttribute('aria-hidden', 'true');
    p.style.cssText = `left:${(r.left - pr.left).toFixed(2)}px;top:${(r.top - pr.top).toFixed(2)}px;`
      + `width:${r.width.toFixed(2)}px;height:${h.toFixed(2)}px;background:${bg};`
      + `clip-path:inset(${top.toFixed(2)}px 0 ${bottom.toFixed(2)}px 0)`;
    const strip = document.createElement('fx-strip');
    for (const t of lines) {
      const l = document.createElement('fx-line');
      l.style.cssText = `height:${h.toFixed(2)}px;line-height:${h.toFixed(2)}px`;
      l.textContent = t;
      strip.appendChild(l);
    }
    p.appendChild(strip);
    price.appendChild(p);
    patches.push(p);
    return { strip, h };
  }

  function roll(from, to, up) {
    clear();
    const node = price.firstChild;
    if (!node || node.nodeType !== 3 || !price.getClientRects().length) return;
    price.setAttribute('style', 'position:relative');
    const pr = price.getBoundingClientRect(), bg = getComputedStyle(document.body).backgroundColor;
    const runs = [];
    if (shape(from) === shape(to)) {
      state.rolls++;
      const digits = band('0123456789');
      for (let i = 0; i < to.length; i++) {
        if (from[i] === to[i] || !/[0-9]/.test(to[i])) continue;
        const seq = [+from[i]];
        for (let d = +from[i]; d !== +to[i]; ) { d = (d + (up ? 1 : 9)) % 10; seq.push(d); }
        // the strip runs top to bottom in the direction the digits go: up — old on top, new at the bottom
        const lines = (up ? seq : seq.slice().reverse()).map(String);
        const { strip, h } = patch(node, pr, bg, i, i + 1, lines, digits);
        const end = -(lines.length - 1) * h;
        runs.push(strip.animate(up ? [{ transform: 'translateY(0)' }, { transform: `translateY(${end}px)` }]
          : [{ transform: `translateY(${end}px)` }, { transform: 'translateY(0)' }], { duration: ROLL, easing: EASE_OUT, fill: 'both' }));
      }
    } else {
      state.slides++;
      const { strip, h } = patch(node, pr, bg, 0, to.length, [from, to], band(from + to));
      runs.push(strip.animate([{ transform: 'translateY(0)' }, { transform: `translateY(${-h}px)` }], { duration: SLIDE, easing: EASE_OUT, fill: 'both' }));
    }
    const mine = patches.slice();
    Promise.all(runs.map((a) => a.finished)).then(() => { if (patches[0] === mine[0]) clear(); }, () => {});
  }

  const mo = new MutationObserver((records) => {
    if (off) return;
    // only the page's writes: the patches coming and going are this module's own
    const foreign = records.some((r) => r.type === 'characterData'
      || [...r.addedNodes, ...r.removedNodes].some((n) => !(n.nodeType === 1 && n.tagName === 'FX-ODO')));
    if (!foreign) return;
    const now = own(), lang = root.getAttribute('data-lang'), v = Number(price.dataset.v);
    if (now !== last) {
      const plain = !last || /^[…?]$/.test(last) || /^[…?]$/.test(now) || lang !== lastLang || !Number.isFinite(v) || !Number.isFinite(lastV) || v === lastV;
      if (plain) clear(); else roll(last, now, v > lastV);
    }
    last = now; lastLang = lang; lastV = v;
  });
  mo.observe(price, { childList: true, characterData: true, subtree: true });
  stops.push(() => { mo.disconnect(); clear(); });
}

// ---------- 3. who holds: spheres ----------

const mix = (a, b, k) => `rgb(${a.map((x, i) => Math.round(x + (b[i] - x) * k)).join(',')})`;
function rgb(css) {
  const m = /rgba?\(([^)]+)\)/.exec(css);
  if (m) return m[1].split(',').slice(0, 3).map(Number);
  const h = css.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}
let ids = 0;

function spheres() {
  const card = document.getElementById('spreadCard'), box = document.getElementById('spread');
  if (!card || !box) return;
  let allowed = card.hidden, shown = false, frame = 0;   // a card already on screen when this arrives keeps its bar

  function draw(grow) {
    const stack = box.querySelector('.stack:not(.fx-hid)') || box.querySelector('.stack');
    if (!stack) return;
    for (const old of box.querySelectorAll('svg.fx-spheres')) old.remove();
    const parts = [...stack.children].map((i) => ({ w: parseFloat(i.style.width), c: rgb(getComputedStyle(i).backgroundColor) }))
      .filter((p) => p.w > 0);
    if (!parts.length) return;
    stack.classList.add('fx-hid');
    const W = Math.max(120, box.clientWidth), H = W < 420 ? 96 : 120, floor = H - 8, gap = 10;
    const paper = rgb(token('--paper', '#f4f2ec')), ink = rgb(token('--ink', '#1f1f1f'));
    const top = Math.max(...parts.map((p) => p.w)), k = parts.map((p) => Math.sqrt(p.w / top));   // area ∝ share
    const R = Math.min((floor - 4) / 2, (W - gap * (parts.length - 1)) / (2 * k.reduce((a, b) => a + b, 0)));
    const id = `fx-sph-${++ids}`;
    let x = 0, defs = `<radialGradient id="${id}-floor"><stop offset="0" stop-color="rgb(${ink})" stop-opacity=".2"/><stop offset="1" stop-color="rgb(${ink})" stop-opacity="0"/></radialGradient>`, body = '';
    parts.forEach((p, i) => {
      const r = R * k[i], cx = x + r;
      x += 2 * r + gap;
      defs += `<radialGradient id="${id}-${i}" cx=".5" cy=".5" r=".5" fx=".34" fy=".28">`
        + `<stop offset="0" stop-color="${mix(p.c, paper, 0.62)}"/><stop offset=".48" stop-color="rgb(${p.c})"/>`
        + `<stop offset="1" stop-color="${mix(p.c, ink, 0.38)}"/></radialGradient>`;
      body += `<g class="fx-sph" style="transform-box:view-box;transform-origin:${cx.toFixed(2)}px ${floor}px">`
        + `<ellipse cx="${cx.toFixed(2)}" cy="${floor}" rx="${(r * 0.95).toFixed(2)}" ry="${Math.max(1.2, r * 0.16).toFixed(2)}" fill="url(#${id}-floor)"/>`
        + `<circle cx="${cx.toFixed(2)}" cy="${(floor - r).toFixed(3)}" r="${r.toFixed(3)}" fill="url(#${id}-${i})" data-share="${p.w}"/></g>`;
    });
    const t = document.createElement('template');
    t.innerHTML = `<svg class="fx-spheres" data-fx-own aria-hidden="true" focusable="false" viewBox="0 0 ${W} ${H}" height="${H}"><defs>${defs}</defs>${body}</svg>`;
    const svg = t.content.firstChild;
    stack.before(svg);
    state.spheres = parts.length;
    if (grow) {
      state.grown++;
      // the card comes in with the page's own rise (opacity 0 → 1 after a delay): grow once it starts to show, or
      // most of the growing would happen out of sight
      const rise = card.getAnimations().find((a) => a.animationName === 'rise' && a.playState === 'running');
      const t = rise ? rise.effect.getComputedTiming() : null;
      const wait = t ? Math.max(0, (t.delay || 0) - (t.localTime || 0)) + 120 : 0;
      svg.querySelectorAll('g.fx-sph').forEach((g, i) => g.animate([{ transform: 'scale(0)' }, { transform: 'scale(1)' }],
        { duration: GROW, delay: wait + i * STAGGER, easing: EASE, fill: 'backwards' }));
    }
    shown = true;
  }

  const mo = new MutationObserver((records) => {
    if (off) return;
    if (card.hidden) { allowed = true; shown = false; return; }      // a new coin: its card may get spheres
    if (!allowed) return;
    const fresh = records.some((r) => r.target === box && [...r.addedNodes].some((n) => n.nodeType === 1 && !n.classList.contains('fx-spheres')));
    if (fresh) draw(!shown);
  });
  mo.observe(card, { attributes: true, attributeFilter: ['hidden'] });
  mo.observe(box, { childList: true });
  const ro = new ResizeObserver(() => {
    if (!shown || off) return;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => { const svg = box.querySelector('svg.fx-spheres'); if (svg && Math.abs(svg.viewBox.baseVal.width - box.clientWidth) > 1) draw(false); });
  });
  ro.observe(box);
  stops.push(() => {
    mo.disconnect(); ro.disconnect(); cancelAnimationFrame(frame);
    for (const svg of box.querySelectorAll('svg.fx-spheres')) svg.remove();
    for (const s of box.querySelectorAll('.stack.fx-hid')) s.classList.remove('fx-hid');
  });
}

// ---------- 4. a new trade: a flash on the chart ----------

function trades() {
  const wrap = document.querySelector('.chartwrap');
  if (!wrap) return;
  let lastAt = -Infinity;
  const onTrade = (e) => {
    if (off || document.hidden) return;
    const d = e.detail || {}, now = performance.now();
    if (now - lastAt < PING_GAP) return;
    const r = wrap.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) return;                     // the chart is off screen
    if (!(d.x >= 0 && d.y >= 0 && d.x <= wrap.clientWidth && d.y <= wrap.clientHeight)) return;
    lastAt = now;
    state.flashes++;
    const ping = document.createElement('fx-ping');
    ping.setAttribute('aria-hidden', 'true');
    ping.style.cssText = `left:${d.x.toFixed(1)}px;top:${d.y.toFixed(1)}px;color:${token(d.side === 'buy' ? '--moss' : '--brick', d.side === 'buy' ? '#4d6b3c' : '#a84b36')}`;
    const ring = document.createElement('fx-ring'), dot = document.createElement('fx-dot');
    ping.append(ring, dot);
    wrap.appendChild(ping);
    ring.animate([{ transform: 'scale(.35)', opacity: 0.95 }, { transform: 'scale(2.6)', opacity: 0 }], { duration: PING, easing: EASE });
    dot.animate([{ opacity: 1 }, { opacity: 0 }], { duration: PING, easing: 'ease-in', fill: 'forwards' })
      .finished.then(() => ping.remove(), () => ping.remove());
  };
  document.addEventListener('coin:trade', onTrade);
  stops.push(() => { document.removeEventListener('coin:trade', onTrade); for (const p of wrap.querySelectorAll('fx-ping')) p.remove(); });
}

// ---------- start and stop ----------

document.addEventListener('fx:off', () => {
  off = true;
  for (const f of stops.splice(0)) f();
  root.classList.remove('fx-coin');
  if (style) style.remove();
}, { once: true });

function init() {
  if (off) return;
  style = document.createElement('style');
  style.id = 'fx-coin-style';
  style.textContent = CSS;
  document.head.appendChild(style);
  root.classList.add('fx-coin');
  verdict();
  odometer();
  spheres();
  trades();
}

init();
FX.coin = { state: () => ({ ...state, on: !off }) };
