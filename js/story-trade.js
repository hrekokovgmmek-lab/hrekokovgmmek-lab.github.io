// Глава 2025 «Торговля руками»: свечи цены рисуются слева направо, курсор сам жмёт «Купить» на провале и «Продать»
// на вершине; на графике появляются метки входа и выхода, между ними — зона сделки. Цифр цены и результата нет — это
// рисунок, не отчёт. Каждый круг — новый случайный график той же формы. На узком рисунке (телефон) — только график.
// Без движения и без JS остаётся статичная картинка. ?still — один неподвижный кадр (так снята статичная картинка).

const COL = {
  ink: '#100F0D', grid: '#181714', panel: '#14130f', edge: 'rgba(255,138,61,.16)', up: '#F2B84B', down: '#D9573B',
  buy: '#F2B84B', sell: '#FF6B3D', paper: '#F3EFE6', soft: 'rgba(143,138,127,.9)', zone: 'rgba(242,184,75,.10)',
};
const N = 46, E = 15, X = 35;            // свечей в круге, свеча входа, свеча выхода
const RATE = 7, HOLD = 2.6, FADE = 0.6;  // свечей в секунду, пауза в конце, затухание

const ease = (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
const clamp01 = (x) => Math.min(1, Math.max(0, x));

function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

function series(seed) {
  const r = rng(seed), out = [];
  // форма: спуск к провалу у входа, подъём к вершине у выхода, лёгкий откат; поверх — шум
  const shape = (i) => (i <= E ? 0.58 - 0.34 * Math.sin((i / E) * Math.PI / 2)
    : i <= X ? 0.24 + 0.62 * (1 - Math.cos(((i - E) / (X - E)) * Math.PI)) / 2
      : 0.86 - 0.16 * Math.sin(((i - X) / (N - 1 - X)) * Math.PI / 2));
  let prev = shape(0);
  for (let i = 0; i < N; i++) {
    const c = shape(i) + (r() - 0.5) * 0.07;
    const o = prev, hi = Math.max(o, c) + r() * 0.035, lo = Math.min(o, c) - r() * 0.035;
    out.push({ o, c, hi, lo });
    prev = c;
  }
  // вход и выход — на самых низкой и высокой свечах около задуманных мест
  return out;
}

export function initStoryTrade(S, addTicker) {
  const frames = [...document.querySelectorAll('.frame[data-trade]')];
  const still = new URLSearchParams(location.search).has('still');
  if (!frames.length || (!S.motion && !still)) return;
  const lang = () => document.documentElement.dataset.lang || 'en';
  const L = (o) => (o && (o[lang()] || o.en)) || '';
  const items = [];
  const io = 'IntersectionObserver' in window
    ? new IntersectionObserver((es) => es.forEach((e) => { const it = items.find((x) => x.el === e.target); if (it) it.vis = e.isIntersecting; }),
      { rootMargin: '120px' })
    : null;
  for (const el of frames) {
    const cv = document.createElement('canvas');
    cv.className = 'art-cv'; cv.setAttribute('aria-hidden', 'true');
    el.insertBefore(cv, el.querySelector('.curtain'));
    let cfg = {};
    try { cfg = JSON.parse(el.dataset.tradeCfg || '{}'); } catch { /* без подписей */ }
    const it = { el, cv, g: cv.getContext('2d'), cfg, vis: !io, t: 0, seed: 7, data: series(7) };
    items.push(it);
    io?.observe(el);
    if (still) {
      it.vis = true; it.t = N / RATE + 0.8;
      const d0 = () => draw(it, 0);
      document.fonts?.ready.then(d0); d0();
    }
  }

  function size(it) {
    const r = it.el.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
    if (w !== it.cv.width || h !== it.cv.height) { it.cv.width = w; it.cv.height = h; }
    it.w = w; it.h = h; it.cssW = r.width;
  }

  function rr(g, x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }

  function pill(g, x, y, text, col, fs, left) {
    g.font = `600 ${fs}px "Geist Mono", ui-monospace, monospace`;
    const w = g.measureText(text).width + fs * 1.1, h = fs * 1.8, px = left ? x - w - fs * 0.6 : x + fs * 0.6;
    rr(g, px, y - h / 2, w, h, h / 2); g.fillStyle = '#0b0a08'; g.fill(); g.strokeStyle = col; g.lineWidth = 1.5; g.stroke();
    g.fillStyle = col; g.textBaseline = 'middle'; g.textAlign = 'left'; g.fillText(text, px + fs * 0.55, y + 1);
  }

  function draw(it) {
    size(it);
    const { g, w } = it, s = w / 1280, compact = it.cssW < 560, t = it.t;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = COL.ink; g.fillRect(0, 0, it.w, it.h);
    g.setTransform(s, 0, 0, s, 0, 0);
    g.strokeStyle = COL.grid; g.lineWidth = 1 / s;
    g.beginPath();
    for (let x = 0; x <= 1280; x += 28) { g.moveTo(x, 0); g.lineTo(x, 720); }
    for (let y = 0; y <= 720; y += 28) { g.moveTo(0, y); g.lineTo(1280, y); }
    g.stroke();

    const fade = 1 - clamp01((t - (N / RATE + HOLD)) / FADE);
    g.globalAlpha = fade;
    // ---- график ----
    const cx0 = compact ? 60 : 60, cx1 = compact ? 1220 : 880, cy0 = 90, cy1 = 620;
    const step = (cx1 - cx0) / N, bw = step * 0.56, d = it.data;
    const Y = (v) => cy1 - (v - 0.08) / 0.92 * (cy1 - cy0);
    const shown = Math.min(N, t * RATE), full = Math.floor(shown);
    for (let i = 0; i < Math.min(N, full + 1); i++) {
      const k = i < full ? 1 : shown - full;                 // текущая свеча растёт
      if (k <= 0) continue;
      const c = d[i], x = cx0 + i * step + step / 2;
      const cc = c.o + (c.c - c.o) * k, up = cc >= c.o, col = up ? COL.up : COL.down;
      g.strokeStyle = col; g.lineWidth = compact ? 3 : 1.6;
      g.beginPath(); g.moveTo(x, Y(Math.max(c.hi * k + c.o * (1 - k), cc))); g.lineTo(x, Y(Math.min(c.lo * k + c.o * (1 - k), cc))); g.stroke();
      g.fillStyle = col;
      const y0 = Y(Math.max(c.o, cc)), y1 = Y(Math.min(c.o, cc));
      g.fillRect(x - bw / 2, y0, bw, Math.max(compact ? 3 : 1.5, y1 - y0));
    }
    // текущая цена: пунктир
    if (full > 0 && full < N) {
      const last = d[Math.min(N - 1, full)], v = last.o + (last.c - last.o) * (shown - full);
      g.setLineDash([6, 6]); g.strokeStyle = 'rgba(243,239,230,.35)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(cx0, Y(v)); g.lineTo(cx1, Y(v)); g.stroke(); g.setLineDash([]);
    }

    // ---- вход и выход ----
    const fs = compact ? 30 : 17;
    const tE = (E + 1) / RATE + 0.35, tX = (X + 1) / RATE + 0.35;
    const xE = cx0 + E * step + step / 2, xX = cx0 + X * step + step / 2, yE = Y(d[E].c), yX = Y(d[X].c);
    if (t >= tX) {                                            // зона сделки
      g.fillStyle = COL.zone; g.fillRect(xE, yX, xX - xE, yE - yX);
    }
    const mark = (tm, x, y, col, text, left, below) => {  // вход: подпись под точкой (там свечей нет), выход — над
      if (t < tm) return;
      const a = clamp01((t - tm) / 0.25);
      g.save(); g.globalAlpha *= a;
      g.setLineDash([5, 6]); g.strokeStyle = col; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(cx0, y); g.lineTo(cx1, y); g.stroke(); g.setLineDash([]);
      const pr = 1 + 0.9 * (1 - a);
      g.fillStyle = col; g.beginPath(); g.arc(x, y, (compact ? 11 : 7) * pr, 0, Math.PI * 2); g.fill();
      g.fillStyle = COL.ink; g.beginPath(); g.arc(x, y, compact ? 4 : 2.6, 0, Math.PI * 2); g.fill();
      pill(g, x + (left ? -(compact ? 16 : 10) : (compact ? 16 : 10)), y + (below ? 1 : -1) * (compact ? 46 : 26), text.toUpperCase(), col, fs, left);
      g.restore();
    };
    mark(tE, xE, yE, COL.buy, L(it.cfg.entry), false, true);
    mark(tX, xX, yX, COL.sell, L(it.cfg.exit), true, false);

    // ---- панель «ручная сделка» и курсор ----
    if (!compact) {
      const px = 940, py = 170, pw = 280, ph = 380;
      rr(g, px, py, pw, ph, 14); g.fillStyle = COL.panel; g.fill(); g.strokeStyle = COL.edge; g.lineWidth = 1.2; g.stroke();
      g.font = '500 13px "Geist Mono", ui-monospace, monospace'; g.fillStyle = COL.soft; g.textBaseline = 'middle'; g.textAlign = 'left';
      g.fillText(L(it.cfg.title).toUpperCase(), px + 22, py + 30);
      const btn = (y, label, col, tm) => {
        const hit = t >= tm && t < tm + 0.35, done = t >= tm;
        const k = hit ? 1 - Math.sin(((t - tm) / 0.35) * Math.PI) * 0.06 : 1;
        const bw2 = (pw - 44) * k, bh = 58 * k, bx = px + 22 + (pw - 44 - bw2) / 2, by = y + (58 - bh) / 2;
        rr(g, bx, by, bw2, bh, 10);
        g.fillStyle = hit ? col : done ? 'rgba(242,184,75,.06)' : '#0b0a08'; g.fill();
        g.strokeStyle = col; g.lineWidth = 1.6; g.stroke();
        g.font = '700 19px "Geist Mono", ui-monospace, monospace'; g.textAlign = 'center';
        g.fillStyle = hit ? COL.ink : col; g.fillText(label.toUpperCase(), px + pw / 2, y + 30);
        g.textAlign = 'left';
        return [px + pw / 2, y + 29];
      };
      const bBuy = btn(py + 70, L(it.cfg.buy), COL.buy, tE);
      const bSell = btn(py + 146, L(it.cfg.sell), COL.sell, tX);
      // журнал
      g.font = '500 14px "Geist Mono", ui-monospace, monospace';
      const logY = py + 252;
      g.fillStyle = 'rgba(243,239,230,.12)'; g.fillRect(px + 22, logY - 22, pw - 44, 1);
      if (t >= tE) { g.fillStyle = COL.buy; g.fillText('✓ ' + L(it.cfg.entry), px + 22, logY); }
      if (t >= tX) { g.fillStyle = COL.sell; g.fillText('✓ ' + L(it.cfg.exit), px + 22, logY + 28); }
      // курсор: подъезжает к кнопке к моменту нажатия
      const rest = [px + pw - 40, py + ph - 40];
      const leg = (from, to, t0, t1) => { const k = ease(clamp01((t - t0) / (t1 - t0))); return [from[0] + (to[0] - from[0]) * k, from[1] + (to[1] - from[1]) * k]; };
      let cp = rest;
      if (t < tE) cp = leg(rest, bBuy, tE - 1.1, tE);
      else if (t < tX - 1.1) cp = leg(bBuy, rest, tE + 0.4, tE + 1.4);
      else if (t < tX + 0.4) cp = leg(rest, bSell, tX - 1.1, tX);
      else cp = leg(bSell, rest, tX + 0.4, tX + 1.4);
      g.save(); g.translate(cp[0] + 6, cp[1] + 8);
      g.beginPath(); g.moveTo(0, 0); g.lineTo(0, 22); g.lineTo(6, 16.5); g.lineTo(10.5, 26); g.lineTo(14, 24.5); g.lineTo(9.6, 15.4); g.lineTo(17, 15.4); g.closePath();
      g.fillStyle = COL.paper; g.fill(); g.strokeStyle = COL.ink; g.lineWidth = 1.4; g.stroke();
      g.restore();
    }
    g.globalAlpha = 1;

    // пометка, как у остальных рисунков
    g.font = `500 ${compact ? 22 : 13}px "Geist Mono", ui-monospace, monospace`;
    g.textAlign = 'right'; g.textBaseline = 'alphabetic'; g.fillStyle = COL.soft;
    g.fillText(L(it.cfg.tag).toUpperCase(), 1240, 688);
    g.textAlign = 'left';
    if (!it.el.classList.contains('live')) it.el.classList.add('live');
  }

  if (still) return;
  addTicker((t, dt) => {
    dt = Math.min(dt || 0, 0.1);
    for (const it of items) {
      if (!it.vis) continue;
      it.t += dt;
      if (it.t > N / RATE + HOLD + FADE) { it.t = 0; it.seed++; it.data = series(it.seed); }   // новый круг — новый график
      draw(it);
    }
  });
}
