// Живые рисунки ещё четырёх глав (как глобус, код и график): memesniper, 1 263 живых сделки, пулы-витрины, открытый код.
// Только то, что уже сказано в подписях глав: «меньше 1 с от сигнала до транзакции», 1 263 сделки 3–19.09.2026, 682 автотеста
// и 32 опыта, 16 монет и один концентратор, шесть проектов под MIT. Монет, адресов, цен и результатов нет — это рисунки,
// подписаны «иллюстрация». Узкий рисунок (телефон) — крупнее и проще. Без движения и без JS — статичная картинка;
// ?still — один неподвижный кадр (так сняты статичные картинки).

const C = {
  ink: '#100F0D', grid: '#181714', panel: '#14130f', edge: 'rgba(255,138,61,.16)', paper: '#F3EFE6', soft: 'rgba(143,138,127,.9)',
  dim: '#4a453c', gold: '#F2B84B', amber: '#EE8A3C', brick: '#D9573B', sig: '#FF6B3D', green: '#7FB069',
};
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const ease = (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const MONO = '"Geist Mono", ui-monospace, monospace';
const DISP = '"Roboto Flex", "Arial Narrow", sans-serif';

function rr(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
function windowBox(g, x, y, w, h, title, big) {
  rr(g, x, y, w, h, 12); g.fillStyle = C.panel; g.fill(); g.strokeStyle = C.edge; g.lineWidth = 1.2; g.stroke();
  [0, 1, 2].forEach((i) => { g.fillStyle = '#3a352d'; g.beginPath(); g.arc(x + 22 + i * (big ? 24 : 18), y + 22, big ? 7 : 5, 0, Math.PI * 2); g.fill(); });
  if (title) { g.font = `500 ${big ? 22 : 13}px ${MONO}`; g.fillStyle = C.soft; g.textBaseline = 'middle'; g.textAlign = 'left'; g.fillText(title, x + (big ? 100 : 80), y + 23); }
}
const fmt = (n, lang) => Math.round(n).toLocaleString(lang === 'ru' ? 'ru-RU' : 'en-US');

// ---------------- memesniper: миграции сыплются, одна проходит путь «сигнал → пул → транзакция» быстрее секунды ----------------
const sniper = {
  period: 4.2,
  draw(g, it, t, cp, L, lang) {
    const k = cp ? 1.75 : 1;
    const wx = cp ? 36 : 56, wy = cp ? 36 : 64, ww = cp ? 1208 : 740, wh = cp ? 648 : 592;
    windowBox(g, wx, wy, ww, wh, 'memesniper · ' + L(it.cfg.tab), cp);
    // строки: новая каждые 0.7 с сверху; токен и цена — размытые полосы (как на снимке приложения)
    const rowH = 30 * k, top = wy + 50 * (cp ? 1.4 : 1), rows = Math.floor((wh - (top - wy) - 14) / rowH);
    const step = 0.7, n = Math.floor(t / step), frac = (t / step) % 1;
    const cyc = Math.floor(t / this.period), sel = cyc * Math.round(this.period / step) + 2;  // строка, которую «ловит» бот
    g.save(); rr(g, wx + 1, top - 4, ww - 2, wh - (top - wy) - 10, 10); g.clip();
    for (let r = 0; r <= rows + 1; r++) {                      // новая строка въезжает сверху, остальные сдвигаются вниз
      const id = n - r, y = top + (r - 1 + ease(Math.min(1, frac * 2))) * rowH;
      if (id < 0) continue;
      const hot = id === sel && t - sel * step < this.period - 0.2;
      if (hot) { g.fillStyle = 'rgba(255,107,61,.16)'; g.fillRect(wx + 1, y, ww - 2, rowH); g.fillStyle = C.sig; g.fillRect(wx + 1, y, 3, rowH); }
      const sec = 13 * 3600 + 22 * 60 + id * 7 + Math.floor(hash(id) * 6);
      const hh = String(Math.floor(sec / 3600) % 24).padStart(2, '0'), mm = String(Math.floor(sec / 60) % 60).padStart(2, '0'), ss = String(sec % 60).padStart(2, '0');
      g.font = `500 ${13 * k}px ${MONO}`; g.textBaseline = 'middle'; g.textAlign = 'left';
      g.fillStyle = hot ? C.paper : '#8f8a7f'; g.fillText(`${hh}:${mm}:${ss}`, wx + 22 * k, y + rowH / 2);
      const bar = (x, w, a) => { g.globalAlpha = a; rr(g, x, y + rowH / 2 - 5 * k, w, 10 * k, 5 * k); g.fill(); g.globalAlpha = 1; };
      g.fillStyle = hot ? C.gold : '#6d675d';
      bar(wx + 130 * k, (70 + hash(id + 3) * 90) * k, hot ? 0.9 : 0.45);
      bar(wx + (cp ? 420 : 330) * k * (cp ? 0.62 : 1), (40 + hash(id + 9) * 40) * k, hot ? 0.8 : 0.3);
      if (!cp) bar(wx + 470, 60 + hash(id + 11) * 60, 0.25);
      g.font = `600 ${12 * k}px ${MONO}`; g.textAlign = 'right';
      g.fillStyle = hot ? C.sig : C.dim; g.fillText(hot ? '● ' + L(it.cfg.caught) : '·', wx + ww - 22 * k, y + rowH / 2);
      g.textAlign = 'left';
    }
    g.restore();
    // путь пойманной строки: три шага и шкала до 1 секунды
    const tc = t - Math.max(0, sel * step), done = (x) => tc >= x;
    const ms = Math.min(0.42 + hash(cyc) * 0.4, tc * 0.6);       // рисунок: бегущая шкала, итог всегда меньше секунды
    const steps = [[L(it.cfg.s1), 0.15], [L(it.cfg.s2), 0.55], [L(it.cfg.s3), 1.0]];
    if (!cp) {
      const px = 836, py = 150, pw = 388, ph = 420;
      windowBox(g, px, py, pw, ph, L(it.cfg.path), false);
      steps.forEach(([txt, at], i) => {
        const y = py + 92 + i * 74, on = done(at);
        g.strokeStyle = on ? C.gold : C.dim; g.lineWidth = 2;
        if (i) { g.beginPath(); g.moveTo(px + 40, y - 74 + 14); g.lineTo(px + 40, y - 14); g.stroke(); }
        g.beginPath(); g.arc(px + 40, y, 11, 0, Math.PI * 2); g.fillStyle = on ? C.gold : '#0b0a08'; g.fill(); g.stroke();
        g.font = `600 16px ${MONO}`; g.fillStyle = on ? C.paper : '#6d675d'; g.textBaseline = 'middle'; g.fillText(txt, px + 66, y);
      });
      const bx = px + 30, by = py + 330, bw = pw - 60;
      g.fillStyle = '#0b0a08'; rr(g, bx, by, bw, 14, 7); g.fill();
      g.fillStyle = C.gold; rr(g, bx, by, Math.max(14, bw * Math.min(1, ms)), 14, 7); g.fill();
      g.strokeStyle = C.sig; g.lineWidth = 2; g.beginPath(); g.moveTo(bx + bw, by - 8); g.lineTo(bx + bw, by + 22); g.stroke();
      g.font = `500 13px ${MONO}`; g.fillStyle = C.soft; g.textAlign = 'right'; g.fillText('1 s', bx + bw, by + 38); g.textAlign = 'left';
      g.font = `700 22px ${MONO}`; g.fillStyle = done(1.0) ? C.gold : C.paper;
      g.fillText((done(1.0) ? '< 1 s' : ms.toFixed(2) + ' s'), bx, by - 26);
    } else if (done(1.0)) {
      const txt = `${L(it.cfg.s1)} → ${L(it.cfg.s3)} < 1 s`;
      g.font = `600 30px ${MONO}`; const w = g.measureText(txt).width + 44;
      rr(g, 60, 600, w, 64, 12); g.fillStyle = '#0b0a08'; g.fill(); g.strokeStyle = C.sig; g.lineWidth = 2; g.stroke();
      g.fillStyle = C.gold; g.textBaseline = 'middle'; g.fillText(txt, 82, 633);
    }
  },
};

// ---------------- 1 263 живых сделки: ровно 1 263 клетки, рядом 682 автотеста и 32 опыта ----------------
const trades = {
  N: 1263, fill: 5.5, hold: 3.2, fadeT: 0.6,
  get period() { return this.fill + this.hold + this.fadeT; },
  draw(g, it, t, cp, L, lang) {
    const tt = it.still ? this.fill + 1 : t % this.period;
    const fade = 1 - clamp01((tt - this.fill - this.hold) / this.fadeT);
    const k = clamp01(tt / this.fill), shown = Math.round(ease(k) * this.N);
    // 1 263 клетки должны влезть в кадр: на телефоне 55 × 23 по 21, на широком 47 × 27 по 17.6
    const cols = cp ? 55 : 47, x0 = cp ? 60 : 60, y0 = cp ? 196 : 190, cell = cp ? 21 : 17.6, sz = cell * 0.7;
    g.globalAlpha = fade;
    for (let i = 0; i < shown; i++) {
      const c = i % cols, r = Math.floor(i / cols);
      const q = i / this.N;                                     // цвет по времени: от первых сделок к последним
      g.fillStyle = i > shown - 12 && shown < this.N ? C.paper : q < 0.5 ? C.gold : q < 0.85 ? C.amber : C.brick;  // свежие — вспышкой
      g.globalAlpha = fade * 0.9;
      g.fillRect(x0 + c * cell, y0 + r * cell, sz, sz);
    }
    g.globalAlpha = fade;
    g.font = `850 ${cp ? 96 : 64}px ${DISP}`; g.fillStyle = C.paper; g.textBaseline = 'alphabetic'; g.textAlign = 'left';
    g.fillText(fmt(shown, lang), x0, y0 - (cp ? 50 : 44));
    g.font = `500 ${cp ? 26 : 15}px ${MONO}`; g.fillStyle = C.soft;
    g.fillText(L(it.cfg.live).toUpperCase(), x0 + (cp ? 270 : 200), y0 - (cp ? 56 : 50));
    if (shown >= this.N) {
      const r = Math.ceil(this.N / cols), y = y0 + r * cell + (cp ? 40 : 30);
      g.font = `600 ${cp ? 26 : 15}px ${MONO}`; g.fillStyle = C.gold; g.fillText('→ ' + L(it.cfg.paper), x0, y);
    }
    if (!cp) {
      const tile = (y, val, label, at) => {
        const v = Math.round(val * ease(clamp01((tt - at) / 1.6)));
        rr(g, 950, y, 270, 150, 12); g.fillStyle = C.panel; g.fill(); g.strokeStyle = C.edge; g.lineWidth = 1.2; g.stroke();
        g.font = `850 56px ${DISP}`; g.fillStyle = C.paper; g.fillText(fmt(v, lang), 976, y + 78);
        g.font = `500 14px ${MONO}`; g.fillStyle = C.soft;
        L(label).split('\n').forEach((s, i) => g.fillText(s.toUpperCase(), 978, y + 108 + i * 20));
      };
      tile(190, 682, it.cfg.tests, 0.6);
      tile(370, 32, it.cfg.exps, 1.2);
    }
    g.globalAlpha = 1;
  },
};

// ---------------- пулы-витрины: 16 монет по кругу, у каждой цена падает почти до нуля; один концентратор платит всем ----------------
const pools = {
  N: 16, period: 9,
  draw(g, it, t, cp, L) {
    const tt = it.still ? 7 : t % this.period;
    const cx = 640, cy = cp ? 380 : 372, rx = cp ? 470 : 470, ry = cp ? 250 : 240;
    const pos = (i) => { const a = -Math.PI / 2 + (i / this.N) * Math.PI * 2; return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, a]; };
    const fade = 1 - clamp01((tt - this.period + 0.6) / 0.6);
    g.globalAlpha = fade;
    // рёбра: концентратор → создатель → монета и концентратор → покупатель → монета; бегут импульсы денег
    for (let i = 0; i < this.N; i++) {
      const app = clamp01((tt - i * 0.18) / 0.5); if (app <= 0) continue;
      const [x, y, a] = pos(i), off = 0.075;
      const mid = (s) => [cx + Math.cos(a + s) * rx * 0.55, cy + Math.sin(a + s) * ry * 0.55];
      for (const [sgn, col] of [[-1, C.gold], [1, C.sig]]) {
        const [mx, my] = mid(sgn * off);
        g.strokeStyle = col; g.globalAlpha = fade * 0.32 * app; g.lineWidth = cp ? 2.4 : 1.4;
        g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + (mx - cx) * app, cy + (my - cy) * app);
        if (app >= 1) g.lineTo(x, y); g.stroke();
        g.globalAlpha = fade * app;
        g.fillStyle = col; g.beginPath(); g.arc(mx, my, cp ? 6 : 4, 0, Math.PI * 2); g.fill();
        if (app >= 1 && !it.still) {                               // импульс: от концентратора к узлу
          const p = ((t * 0.55 + i * 0.13 + (sgn > 0 ? 0.5 : 0)) % 1);
          const px = cx + (mx - cx) * p, py = cy + (my - cy) * p;
          g.globalAlpha = fade * (1 - p); g.beginPath(); g.arc(px, py, cp ? 5 : 3.2, 0, Math.PI * 2); g.fill();
        }
      }
      // монета: плитка с ценой, которая обрывается почти до нуля
      g.globalAlpha = fade * app;
      const w = cp ? 110 : 74, h = cp ? 66 : 44;
      rr(g, x - w / 2, y - h / 2, w, h, 8); g.fillStyle = C.panel; g.fill(); g.strokeStyle = C.edge; g.lineWidth = 1; g.stroke();
      const crash = clamp01((tt - i * 0.18 - 0.6 - hash(i) * 2.2) / 0.5);
      g.strokeStyle = crash > 0 ? C.sig : C.green; g.lineWidth = cp ? 2.6 : 1.8; g.beginPath();
      for (let j = 0; j <= 16; j++) {
        const fx = j / 16, before = fx < 0.45 + hash(i + 5) * 0.2;
        const v = before ? 0.75 + Math.sin(j * 1.7 + i) * 0.08 : 0.75 - (0.68 * crash);
        const px = x - w / 2 + 6 + fx * (w - 12), py = y + h / 2 - 6 - v * (h - 12);
        j ? g.lineTo(px, py) : g.moveTo(px, py);
      }
      g.stroke();
    }
    // концентратор
    g.globalAlpha = fade;
    const pr = (cp ? 26 : 18) * (1 + 0.08 * Math.sin(t * 3));
    const gr = g.createRadialGradient(cx, cy, 0, cx, cy, pr * 3); gr.addColorStop(0, 'rgba(255,107,61,.35)'); gr.addColorStop(1, 'rgba(255,107,61,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, pr * 3, 0, Math.PI * 2); g.fill();
    g.fillStyle = C.sig; g.beginPath(); g.arc(cx, cy, pr, 0, Math.PI * 2); g.fill();
    g.font = `700 ${cp ? 28 : 16}px ${MONO}`; g.textAlign = 'center'; g.fillStyle = C.paper; g.textBaseline = 'top';
    g.fillText(L(it.cfg.hub).toUpperCase(), cx, cy + pr + (cp ? 12 : 8));
    g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    // подписи
    g.font = `850 ${cp ? 46 : 30}px ${DISP}`; g.fillStyle = C.paper; g.fillText(L(it.cfg.title).toUpperCase(), 40, cp ? 72 : 56);
    if (!cp) {
      g.font = `500 14px ${MONO}`;
      g.fillStyle = C.gold; g.fillText('● ' + L(it.cfg.creator), 40, 86);
      g.fillStyle = C.sig; g.fillText('● ' + L(it.cfg.buyer), 40, 108);
    }
    g.globalAlpha = 1;
  },
};

// ---------------- открытый код: шесть проектов под MIT появляются по одному ----------------
const repos = {
  period: 9,
  draw(g, it, t, cp, L) {
    const list = it.cfg.repos || [];
    const tt = it.still ? 7.2 : t % this.period;
    const fade = 1 - clamp01((tt - this.period + 0.6) / 0.6);
    g.globalAlpha = fade;
    g.font = `500 ${cp ? 26 : 15}px ${MONO}`; g.fillStyle = C.soft; g.textBaseline = 'alphabetic'; g.textAlign = 'left';
    g.fillText('github.com/' + (it.cfg.user || ''), cp ? 48 : 60, cp ? 70 : 64);
    const cols = cp ? 1 : 2, cw = cp ? 1184 : 566, chh = cp ? 84 : 130, gx = cp ? 48 : 60, gy = cp ? 96 : 92, gap = cp ? 8 : 18;
    list.forEach((r, i) => {
      const at = 0.3 + i * 0.75, a = clamp01((tt - at) / 0.4);
      if (a <= 0) return;
      const c = i % cols, row = Math.floor(i / cols), x = gx + c * (cw + gap), y = gy + row * (chh + gap) + (1 - ease(a)) * 16;
      g.globalAlpha = fade * a;
      rr(g, x, y, cw, chh, 12); g.fillStyle = C.panel; g.fill(); g.strokeStyle = C.edge; g.lineWidth = 1.2; g.stroke();
      const typed = r.name.slice(0, Math.max(1, Math.floor(r.name.length * clamp01((tt - at) / 0.7))));
      g.font = `700 ${cp ? 30 : 20}px ${MONO}`; g.fillStyle = C.gold; g.fillText(typed, x + 22, y + (cp ? 44 : 42));
      if (!cp) { g.font = `400 15px ${MONO}`; g.fillStyle = '#cfcac0'; g.fillText(L(r.desc), x + 22, y + 76); }
      // значок MIT
      g.font = `600 ${cp ? 20 : 12}px ${MONO}`;
      const bw = g.measureText('MIT').width + (cp ? 24 : 16), bx = x + cw - bw - 18, by = y + (cp ? 22 : 22);
      rr(g, bx, by, bw, cp ? 34 : 24, cp ? 17 : 12); g.strokeStyle = C.green; g.lineWidth = 1.4; g.stroke();
      g.fillStyle = C.green; g.textAlign = 'center'; g.fillText('MIT', bx + bw / 2, by + (cp ? 24 : 16.5)); g.textAlign = 'left';
      // полоса «коммитов» — просто отметки, без чисел
      if (!cp) for (let j = 0; j < 26; j++) {
        const on = hash(i * 31 + j) > 0.45; g.fillStyle = on ? (hash(j + i) > 0.7 ? C.amber : '#5c4a33') : '#1f1d19';
        g.fillRect(x + 22 + j * 20, y + chh - 26, 14, 10);
      }
    });
    g.globalAlpha = fade;
    if (tt > 0.3 + list.length * 0.75) {
      const txt = '✓ ' + L(it.cfg.done);
      g.font = `600 ${cp ? 28 : 16}px ${MONO}`; g.fillStyle = C.gold;
      g.fillText(txt, cp ? 48 : 60, cp ? 686 : 676);
    }
    g.globalAlpha = 1;
  },
};

const KINDS = { sniper, trades, pools, repos };

export function initStoryLive(S, addTicker) {
  const frames = [...document.querySelectorAll('.frame[data-live]')];
  const still = new URLSearchParams(location.search).has('still');
  if (!frames.length || (!S.motion && !still)) return;
  const lang = () => document.documentElement.dataset.lang || 'en';
  const L = (o) => (o && (typeof o === 'string' ? o : (o[lang()] || o.en))) || '';
  const items = [];
  const io = 'IntersectionObserver' in window
    ? new IntersectionObserver((es) => es.forEach((e) => { const it = items.find((x) => x.el === e.target); if (it) it.vis = e.isIntersecting; }),
      { rootMargin: '120px' })
    : null;

  function draw(it) {
    const r = it.el.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
    if (w !== it.cv.width || h !== it.cv.height) { it.cv.width = w; it.cv.height = h; }
    const g = it.g, s = w / 1280, cp = r.width < 560;
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1;
    g.fillStyle = C.ink; g.fillRect(0, 0, w, h);
    g.setTransform(s, 0, 0, s, 0, 0);
    g.strokeStyle = C.grid; g.lineWidth = 1 / s; g.beginPath();
    for (let x = 0; x <= 1280; x += 28) { g.moveTo(x, 0); g.lineTo(x, 720); }
    for (let y = 0; y <= 720; y += 28) { g.moveTo(0, y); g.lineTo(1280, y); }
    g.stroke();
    it.kind.draw(g, it, it.t, cp, L, lang());
    g.globalAlpha = 1;
    g.font = `500 ${cp ? 22 : 13}px ${MONO}`; g.textAlign = 'right'; g.textBaseline = 'alphabetic'; g.fillStyle = C.soft;
    g.fillText(L(it.cfg.tag).toUpperCase(), 1240, 704);
    g.textAlign = 'left';
    if (!it.el.classList.contains('live')) it.el.classList.add('live');
  }

  for (const el of frames) {
    const kind = KINDS[el.dataset.live]; if (!kind) continue;
    const cv = document.createElement('canvas');
    cv.className = 'art-cv'; cv.setAttribute('aria-hidden', 'true');
    el.insertBefore(cv, el.querySelector('.curtain'));
    let cfg = {};
    try { cfg = JSON.parse(el.dataset.liveCfg || '{}'); } catch { /* без подписей */ }
    const it = { el, cv, g: cv.getContext('2d'), cfg, kind, vis: !io, t: 0, still };
    items.push(it);
    io?.observe(el);
    if (still) { it.vis = true; it.t = kind === sniper ? 6.9 : 6; const d0 = () => draw(it); document.fonts?.ready.then(d0); d0(); }
  }
  if (still) return;
  addTicker((t, dt) => {
    dt = Math.min(dt || 0, 0.1);
    for (const it of items) { if (!it.vis) continue; it.t += dt; draw(it); }
  });
  addEventListener('langchange', () => items.forEach((it) => it.vis && draw(it)));
}
