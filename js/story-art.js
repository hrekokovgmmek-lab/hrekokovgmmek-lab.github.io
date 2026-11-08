// Живые иллюстрации глав: те же 0 и 1, что в поле на фоне, мерцают ~1,2 раза в секунду (у каждой клетки своя фаза);
// поверх — надписи на языке страницы. Без движения и без JS остаётся статичная картинка.

const hash = (n) => { let x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

export function initStoryArt(S, addTicker) {
  const frames = [...document.querySelectorAll('.frame[data-art]')];
  if (!frames.length || !S.motion) return;
  const items = [];
  const io = 'IntersectionObserver' in window
    ? new IntersectionObserver((es) => es.forEach((e) => { const it = items.find((x) => x.el === e.target); if (it) it.vis = e.isIntersecting; }),
      { rootMargin: '120px' })
    : null;
  for (const el of frames) {
    const cv = document.createElement('canvas');
    cv.className = 'art-cv'; cv.setAttribute('aria-hidden', 'true');
    el.insertBefore(cv, el.querySelector('.curtain'));
    const it = { el, cv, g: cv.getContext('2d'), data: null, ov: {}, vis: !io, w: 0, h: 0, dpr: 1, last: -1 };
    items.push(it);
    io?.observe(el);
    fetch(el.dataset.art).then((r) => r.json()).then((d) => {
      it.data = d;
      it.phase = d.cells.map((_, i) => hash(i + 1));
      it.salt = d.cells.map((_, i) => Math.floor(hash(i + 77) * 1000));
    }).catch(() => {});
    for (const l of S.cfg.langs) {
      const u = el.dataset['ov' + l[0].toUpperCase() + l.slice(1)];
      if (u) { const im = new Image(); im.decoding = 'async'; im.src = u; it.ov[l] = im; }
    }
  }

  function size(it) {
    const r = it.el.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
    if (w !== it.cv.width || h !== it.cv.height) { it.cv.width = w; it.cv.height = h; }
    it.w = w; it.h = h;
  }

  function draw(it, t) {
    const d = it.data, g = it.g;
    size(it);
    const s = it.w / d.w;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = `rgb(${d.ink.join(',')})`;
    g.fillRect(0, 0, it.w, it.h);
    // клетка 28 px, как в тёмном режиме сайта
    g.strokeStyle = `rgb(${d.grid.join(',')})`; g.lineWidth = Math.max(1, s);
    g.beginPath();
    for (let x = 0; x <= d.w; x += 28) { g.moveTo(x * s + 0.5, 0); g.lineTo(x * s + 0.5, it.h); }
    for (let y = 0; y <= d.h; y += 28) { g.moveTo(0, y * s + 0.5); g.lineTo(it.w, y * s + 0.5); }
    g.stroke();
    g.font = `500 ${(17 * s).toFixed(2)}px "Geist Mono", ui-monospace, monospace`;
    g.textBaseline = 'top';
    const cells = d.cells;
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i];
      const step = Math.floor(t * 1.2 + it.phase[i] * 17);
      const bit = hash(step * 31 + it.salt[i]) < 0.5 ? '0' : '1';
      g.fillStyle = `rgb(${c[2]},${c[3]},${c[4]})`;
      g.fillText(bit, (c[0] + 1) * s, (c[1] + 2) * s);
    }
    const ov = it.ov[document.documentElement.dataset.lang] || Object.values(it.ov)[0];
    if (ov && ov.complete && ov.naturalWidth) g.drawImage(ov, 0, 0, it.w, it.h);
    if (!it.el.classList.contains('live')) it.el.classList.add('live');
  }

  let lastT = 0;
  addTicker((t) => {
    if (t - lastT < 1 / 12) return; // биты меняются дискретно — 12 кадров в секунду хватает
    lastT = t;
    for (const it of items) if (it.vis && it.data) draw(it, t);
  });
  addEventListener('langchange', () => { lastT = 0; });
}
