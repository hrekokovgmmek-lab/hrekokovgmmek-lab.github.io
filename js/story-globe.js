// Глава 2023 (магазин одежды): глобус из точек суши крутится, Китай и Россия отмечены, между ними летит самолётик,
// фон тёмный. Суша — Natural Earth 1:110m (tools/globe_land.py). Крутится медленно, пока маршрут смотрит на
// зрителя, и быстро — пока он сзади; самолётик вылетает, когда маршрут виден. Без движения и без JS — статичная картинка.
// ?still=<lon>,<s> — один неподвижный кадр (так снята статичная картинка главы).

const D2R = Math.PI / 180;
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const vec = (lat, lon) => [Math.cos(lat * D2R) * Math.cos(lon * D2R), Math.cos(lat * D2R) * Math.sin(lon * D2R), Math.sin(lat * D2R)];

const C = {
  ink: '#100F0D', grid: '#181714', dot: [238, 138, 60], from: '#F2B84B', to: '#FF6B3D', plane: '#F3EFE6',
  label: 'rgba(243,239,230,', tag: 'rgba(143,138,127,.9)',
};
const TILT = 33;              // широта центра вида: Россия и Китай целиком на виду
const W_MIN = 7, W_MAX = 70;  // градусов в секунду: у маршрута и на обратной стороне
const FLIGHT = 3.6, REST = 1.4;

// самолётик сверху, нос вправо (+x), в единицах ~1 px при размере 1
const PLANE = [[8, 0], [4, -1.1], [0.5, -1.2], [-2.5, -7], [-4.5, -7], [-2.2, -1.3], [-6, -1.2], [-8, -3.6], [-9.3, -3.6],
  [-8.2, 0], [-9.3, 3.6], [-8, 3.6], [-6, 1.2], [-2.2, 1.3], [-4.5, 7], [-2.5, 7], [0.5, 1.2], [4, 1.1]];

export function initStoryGlobe(S, addTicker) {
  const frames = [...document.querySelectorAll('.frame[data-globe]')];
  const still = new URLSearchParams(location.search).get('still');
  if (!frames.length || (!S.motion && !still)) return;
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
    try { cfg = JSON.parse(el.dataset.globeCfg || '{}'); } catch { /* без подписей */ }
    const A = vec(cfg.from.lat, cfg.from.lon), B = vec(cfg.to.lat, cfg.to.lon);
    const omega = Math.acos(Math.min(1, A[0] * B[0] + A[1] * B[1] + A[2] * B[2]));
    const route = [];
    for (let i = 0; i <= 96; i++) {                       // дуга большого круга, приподнятая над поверхностью
      const s = i / 96, a = Math.sin((1 - s) * omega) / Math.sin(omega), b = Math.sin(s * omega) / Math.sin(omega);
      const lift = 1 + 0.28 * Math.sin(Math.PI * s);
      route.push([(a * A[0] + b * B[0]) * lift, (a * A[1] + b * B[1]) * lift, (a * A[2] + b * B[2]) * lift]);
    }
    const mid = Math.atan2(A[1] + B[1], A[0] + B[0]) / D2R;
    const it = { el, cv, g: cv.getContext('2d'), cfg, A, B, route, mid, pts: null, vis: !io, w: 0, h: 0,
      lon: mid + 75, fly: -1, rest: 0, pulse: -9 };
    if (still) { const [lo, s] = still.split(',').map(Number); it.lon = lo; it.fixed = s; it.vis = true; }
    items.push(it);
    io?.observe(el);
    fetch(el.dataset.globe).then((r) => r.json()).then((d) => {
      const p = d.pts, n = p.length / 2, v = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { const q = vec(p[2 * i] / 10, p[2 * i + 1] / 10); v.set(q, i * 3); }
      it.pts = v;
      if (still) { draw(it, 0); document.fonts?.ready.then(() => draw(it, 0)); }
    }).catch(() => {});
  }

  function size(it) {
    const r = it.el.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
    if (w !== it.cv.width || h !== it.cv.height) { it.cv.width = w; it.cv.height = h; }
    it.w = w; it.h = h; it.dpr = dpr;
  }

  function draw(it, t) {
    size(it);
    const { g, w, h } = it, s = w / 1280, dp = it.dpr || 1;
    // размеры знаков: от ширины рисунка, но не мельче нескольких пикселей экрана (на телефоне рисунок маленький)
    const fsL = Math.max(22 * s, 9.5 * dp), mr = Math.max(4.2 * s, 1.7 * dp), mu = Math.max(s, 0.45 * dp);
    const R = h * 0.4, cx = w * 0.5, cy = h * 0.5;
    const l0 = it.lon * D2R, t0 = TILT * D2R;
    const cl = Math.cos(l0), sl = Math.sin(l0), ct = Math.cos(t0), st = Math.sin(t0);
    // мир -> экран: x2 — к зрителю, y2 — вправо, z2 — вверх
    const proj = (x, y, z) => {
      const x1 = x * cl + y * sl, y1 = -x * sl + y * cl;
      return [x1 * ct + z * st, y1, -x1 * st + z * ct];
    };
    const hidden = (p) => p[0] < 0 && p[1] * p[1] + p[2] * p[2] < 1;
    const X = (p) => cx + p[1] * R, Y = (p) => cy - p[2] * R;

    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = C.ink; g.fillRect(0, 0, w, h);
    g.strokeStyle = C.grid; g.lineWidth = Math.max(1, s);
    g.beginPath();
    for (let x = 0; x <= 1280; x += 28) { g.moveTo(Math.round(x * s) + 0.5, 0); g.lineTo(Math.round(x * s) + 0.5, h); }
    for (let y = 0; y <= 720; y += 28) { g.moveTo(0, Math.round(y * s) + 0.5); g.lineTo(w, Math.round(y * s) + 0.5); }
    g.stroke();

    // атмосфера и сам шар
    let gr = g.createRadialGradient(cx, cy, R * 0.92, cx, cy, R * 1.28);
    gr.addColorStop(0, 'rgba(255,138,61,.16)'); gr.addColorStop(1, 'rgba(255,138,61,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, R * 1.28, 0, Math.PI * 2); g.fill();
    gr = g.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R);
    gr.addColorStop(0, '#1d1a15'); gr.addColorStop(1, '#0b0a09');
    g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(255,138,61,.28)'; g.lineWidth = Math.max(1, 1.2 * s); g.stroke();

    // суша: сначала обратная сторона (едва видна сквозь шар), потом лицевая
    const v = it.pts, n = v ? v.length / 3 : 0, [dr, dg, db] = C.dot, base = 2.3 * s;
    if (n) {
      g.fillStyle = `rgba(${dr},${dg},${db},.07)`;
      for (let i = 0; i < n; i++) {
        const p = proj(v[3 * i], v[3 * i + 1], v[3 * i + 2]);
        if (p[0] < 0) g.fillRect(X(p) - base * 0.35, Y(p) - base * 0.35, base * 0.7, base * 0.7);
      }
      for (let i = 0; i < n; i++) {
        const p = proj(v[3 * i], v[3 * i + 1], v[3 * i + 2]);
        if (p[0] <= 0) continue;
        const k = p[0], sz = base * (0.55 + 0.45 * k);
        g.fillStyle = `rgba(${dr},${dg},${db},${(0.22 + 0.78 * k).toFixed(3)})`;
        g.fillRect(X(p) - sz / 2, Y(p) - sz / 2, sz, sz);
      }
    }

    // маршрут: пунктир целиком, пройденная часть — ярко
    const S2 = it.fixed ?? (it.fly >= 0 ? ease(clamp01(it.fly / FLIGHT)) : (it.rest > 0 ? 1 : 0));
    const rp = it.route.map((q) => proj(q[0], q[1], q[2]));
    const seg = (a, b, style, width, dash) => {
      g.strokeStyle = style; g.lineWidth = width; g.setLineDash(dash);
      g.beginPath();
      let pen = false;
      for (let i = a; i <= b; i++) {
        const p = rp[i];
        if (hidden(p)) { pen = false; continue; }
        if (pen) g.lineTo(X(p), Y(p)); else { g.moveTo(X(p), Y(p)); pen = true; }
      }
      g.stroke(); g.setLineDash([]);
    };
    const N = rp.length - 1, at = Math.round(S2 * N);
    seg(0, N, 'rgba(242,184,75,.35)', Math.max(1, 1.3 * s), [5 * s, 6 * s]);
    if (at > 0) {
      const lg = g.createLinearGradient(X(rp[0]), Y(rp[0]), X(rp[N]), Y(rp[N]));
      lg.addColorStop(0, C.from); lg.addColorStop(1, C.to);
      seg(0, at, lg, Math.max(1.5, 2.2 * s), []);
    }

    // точки и подписи
    const lang = document.documentElement.dataset.lang || 'en';
    const mark = (V, col, label, side, pulse) => {
      const p = proj(V[0], V[1], V[2]);
      if (p[0] <= 0.02) return;
      const a = clamp01((p[0] - 0.05) / 0.3), x = X(p), y = Y(p);
      g.globalAlpha = a;
      const ph = ((t * 0.7) % 1);
      g.strokeStyle = col; g.lineWidth = Math.max(1, 1.4 * s);
      g.globalAlpha = a * (1 - ph) * 0.9; g.beginPath(); g.arc(x, y, (5 + 16 * ph) * mu, 0, Math.PI * 2); g.stroke();
      if (pulse > 0) { g.globalAlpha = a * pulse; g.beginPath(); g.arc(x, y, (6 + 30 * (1 - pulse)) * mu, 0, Math.PI * 2); g.stroke(); }
      g.globalAlpha = a;
      g.fillStyle = col; g.beginPath(); g.arc(x, y, mr, 0, Math.PI * 2); g.fill();
      g.fillStyle = C.ink; g.beginPath(); g.arc(x, y, mr * 0.38, 0, Math.PI * 2); g.fill();
      if (label) {
        g.font = `600 ${fsL.toFixed(1)}px "Geist Mono", ui-monospace, monospace`;
        g.textBaseline = 'middle'; g.textAlign = side > 0 ? 'left' : 'right';
        g.fillStyle = C.label + a.toFixed(3) + ')';
        g.fillText(label.toUpperCase(), x + side * (mr + fsL * 0.55), y);
      }
      g.globalAlpha = 1;
    };
    const L = (o) => (o && (o[lang] || o.en)) || '';
    const arrive = clamp01(1 - (t - it.pulse) / 1.2);
    mark(it.A, C.from, L(it.cfg.from.label), 1, 0);
    mark(it.B, C.to, L(it.cfg.to.label), -1, arrive);

    // самолётик: по дуге, носом по ходу
    if (it.fixed != null || it.fly >= 0) {
      const f = S2 * N, i0 = Math.min(N - 1, Math.floor(f)), fr = f - i0;
      const a0 = rp[i0], a1 = rp[i0 + 1];
      const p = [a0[0] + (a1[0] - a0[0]) * fr, a0[1] + (a1[1] - a0[1]) * fr, a0[2] + (a1[2] - a0[2]) * fr];
      if (!hidden(p)) {
        const ang = Math.atan2(Y(a1) - Y(a0), X(a1) - X(a0)), k = Math.max(1.5 * s, 0.6 * dp) * (0.85 + 0.15 * clamp01(p[0]));
        g.save();
        g.translate(X(p), Y(p)); g.rotate(ang);
        g.shadowColor = 'rgba(255,138,61,.75)'; g.shadowBlur = 10 * s;
        g.fillStyle = C.plane; g.beginPath();
        PLANE.forEach(([px, py], j) => (j ? g.lineTo(px * k, py * k) : g.moveTo(px * k, py * k)));
        g.closePath(); g.fill();
        g.restore();
      }
    }

    // пометка, как у остальных рисунков
    g.font = `500 ${Math.max(13 * s, 7 * dp).toFixed(1)}px "Geist Mono", ui-monospace, monospace`;
    g.textAlign = 'right'; g.textBaseline = 'alphabetic'; g.fillStyle = C.tag;
    g.fillText(L(it.cfg.tag).toUpperCase(), w - 40 * s, h - 32 * s);
    g.textAlign = 'left';

    if (!it.el.classList.contains('live')) it.el.classList.add('live');
  }

  if (still) return;
  addTicker((t, dt) => {
    dt = Math.min(dt || 0, 0.1);
    for (const it of items) {
      if (!it.vis || !it.pts) continue;
      // вращение: медленно у маршрута, быстро сзади; долгота центра убывает — земля идёт слева направо, как на самом деле
      let d = ((it.lon - it.mid) % 360 + 540) % 360 - 180;
      it.lon -= (W_MIN + (W_MAX - W_MIN) * (1 - Math.cos(d * D2R)) / 2) * dt;
      d = ((it.lon - it.mid) % 360 + 540) % 360 - 180;
      const facing = Math.cos(d * D2R);
      if (it.fly >= 0) {
        it.fly += dt;
        if (it.fly >= FLIGHT) { it.fly = -1; it.rest = REST; it.pulse = t; }
      } else if (it.rest > 0) it.rest -= dt;
      else if (facing > 0.45 && d > -10) it.fly = 0;    // вылет, пока маршрут на виду и ещё не ушёл за край
      draw(it, t);
    }
  });
}
