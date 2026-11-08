// История: горизонтальная лента от вертикальной прокрутки (1:1), заголовок по чернилам на первую карточку,
// цвет у текущей (переход на 30 % пути), линия времени, видео по видимости; телефон — свайп со snap.

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const lerp = (a, b, t) => a + (b - a) * t;

export function initStory(S, addTicker) {
  const sec = document.getElementById('story');
  if (!sec) return;
  const track = sec.querySelector('#track'), title = sec.querySelector('.story-title');
  const cards = [...track.querySelectorAll('.card')];
  const tl = sec.querySelector('#timeline');
  const steps = tl ? [...tl.querySelectorAll('li')] : [];
  const fill = tl?.querySelector('.t-fill');
  let mode = 'h', len = 0, top = 0, centers = [], cur = -1, W = innerWidth, X = [], seg = 1;
  const HOLD = 0.18;                                        // доля прокрутки, пока слайд стоит
  const ease = (u) => 0.5 - 0.5 * Math.cos(Math.PI * u);     // мягкий разгон и торможение
  let xs = null, gs = 0;                                     // сглаженные по времени положение и доля переезда

  // Высота заглавных у шрифта заголовка — по букве E на холсте.
  function capH(el) {
    const cs = getComputedStyle(el), c = document.createElement('canvas').getContext('2d');
    c.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    if ('fontStretch' in c) c.fontStretch = 'condensed';
    const m = c.measureText('E');
    return m.actualBoundingBoxAscent || parseFloat(cs.fontSize) * 0.71;
  }
  // Базовые линии строк — нулевым маркером в начале каждой строки.
  function baselines(el) {
    const out = [];
    for (const line of el.querySelectorAll('.ls:not([style*="none"]) > span')) {
      if (!line.offsetParent && line.getClientRects().length === 0) continue;
      const mk = document.createElement('i'); mk.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline';
      line.firstElementChild ? line.firstElementChild.prepend(mk) : line.prepend(mk);
      out.push(mk.getBoundingClientRect().top); mk.remove();
    }
    return out;
  }

  function layout() {
    W = innerWidth;
    const H = S.H;
    mode = W <= 760 ? 'swipe' : 'h';
    // узкое или высокое окно: первая карточка тоже по центру, заголовок над ней
    const narrow = mode === 'h' && (W < 1100 || matchMedia('(orientation: portrait)').matches);
    sec.classList.toggle('narrow', narrow);
    track.style.transform = ''; track.style.paddingLeft = '';
    sec.style.height = ''; title.style.top = ''; title.style.transform = '';
    // подпись у вертикальных карточек: колонка по самой длинной строке, не шире 230 px
    for (const c of cards) if (c.classList.contains('tall')) {
      const cap = c.querySelector('.cap'); cap.style.setProperty('--capw', '230px');
      let maxw = 0;
      for (const el of cap.querySelectorAll('.cap-line, .cap-title, .cap-plat')) {
        const r = document.createRange(); r.selectNodeContents(el);
        for (const rc of r.getClientRects()) maxw = Math.max(maxw, rc.width);
      }
      cap.style.setProperty('--capw', Math.min(230, Math.ceil(maxw) + 2) + 'px');
    }
    track.style.gap = ''; cards.forEach((c) => { c.style.marginRight = ''; c.style.opacity = ''; c.style.visibility = ''; });
    if (mode !== 'h') { centers = []; return; }
    // слайды: соседние карточки стоят за краями экрана, пока текущая на месте — следующую не видно, пока до неё не долистал
    const tr = title.getBoundingClientRect();
    const start = Math.max(tr.right + 0.035 * W, W * 0.36);
    track.style.paddingLeft = start + 'px';
    track.style.gap = '0px';
    const ws = cards.map((c) => c.offsetWidth), M = 28, base = 48;
    cards.forEach((c, i) => {
      if (i === cards.length - 1) return;
      let g = Math.max(base, W / 2 + M - ws[i] / 2, W / 2 + M - ws[i + 1] / 2);
      if (i === 0 && !sec.classList.contains('narrow')) g = Math.max(g, W + M - (start + ws[0]));
      c.style.marginRight = g + 'px';
    });
    centers = cards.map((c) => c.offsetLeft + c.offsetWidth / 2);
    X = centers.map((c, k) => (k === 0 && !sec.classList.contains('narrow') ? 0 : W / 2 - c));
    seg = 1.15 * H;   // на переезд — почти экран прокрутки
    xs = null;
    len = Math.max(1, (cards.length - 1) * seg);
    sec.style.height = (H + len) + 'px';
    top = sec.getBoundingClientRect().top + scrollY;
    // заголовок — по центру картинки первой карточки, по настоящим чернилам
    const fr = cards[0]?.querySelector('.frame');
    if (fr && !sec.classList.contains('narrow')) {
      title.style.top = '0px';
      const b = baselines(title), tTop = title.getBoundingClientRect().top;
      if (b.length) {
        const ink0 = b[0] - capH(title), ink1 = b[b.length - 1];
        const fb = fr.getBoundingClientRect();
        const pinTop = sec.querySelector('.story-pin').getBoundingClientRect().top;
        const want = (fb.top + fb.bottom) / 2 - pinTop;
        title.style.top = (want - ((ink0 + ink1) / 2 - tTop)) + 'px';
      }
    }
  }

  function setCur(i) {
    if (i === cur) return;
    cur = i;
    // карточка, ставшая текущей, «расшифровывается»: шторка из 0 и 1 уходит слева направо
    const c = cards[i];
    if (c && S.motion) { c.classList.remove('decoding'); void c.offsetWidth; c.classList.add('decoding'); }
    cards.forEach((c, k) => c.classList.toggle('cur', k === i));
    steps.forEach((s, k) => { s.classList.toggle('cur', k === i); s.classList.toggle('past', k < i); });
    S.storyYear = cards[i]?.dataset.year;
  }

  function frameH(dt = 1 / 60) {
    const n = cards.length;
    const p = clamp01((scrollY - top) / Math.max(1, len));
    // каждый слайд: сначала стоит (HOLD доли своего отрезка прокрутки), потом плавно уступает место следующему
    const s = p * (n - 1), k = Math.min(n - 2, Math.floor(s)), f = s - k;
    const g = n > 1 ? (f < HOLD ? 0 : ease((f - HOLD) / (1 - HOLD))) : 0;
    const xt = n > 1 ? lerp(X[k], X[k + 1], g) : 0;
    // сглаживание по времени: шаги колеса и рывки тачпада не дёргают слайды
    const e = 1 - Math.pow(0.9, Math.min(4, dt * 60));
    xs = xs === null ? xt : lerp(xs, xt, e);
    const x = xs;
    const gt = k + g; gs = Math.abs(gs - gt) > 1.5 ? gt : lerp(gs, gt, e);
    track.style.transform = `translate3d(${x.toFixed(2)}px,0,0)`;
    const tx = x - (X[0] || 0); // заголовок стоит, пока на месте первый слайд, и уезжает вместе с ним
    title.style.transform = `translate3d(${tx.toFixed(2)}px,0,0)`;
    const pos = Math.max(0, gs), kk = Math.min(n - 1, Math.floor(pos + 0.5));
    setCur(n > 1 ? kk : 0);                       // текущей карточка становится, только доехав до середины
    if (fill) fill.style.setProperty('--prog', String(n > 1 ? pos / (n - 1) : 1));
    // видна только одна карточка: уходящая гаснет на первой половине переезда, приходящая проявляется на второй
    for (let q = 0; q < n; q++) {
      const d = Math.abs(pos - q);
      const t = Math.min(1, Math.max(0, (d - 0.3) / 0.2));
      const op = 1 - t * t * (3 - 2 * t);
      const st = cards[q].style;
      st.opacity = op.toFixed(3);
      st.visibility = op < 0.002 ? 'hidden' : '';
    }
    // глубина: картинка внутри карточки чуть против движения
    for (let q = 0; q < n; q++) {
      const m = cards[q].querySelector('.media'); if (!m) continue;
      const d = centers[q] + x - W / 2;
      m.style.transform = `translate3d(${Math.max(-5, Math.min(5, -d * 0.01)).toFixed(2)}px,0,0)`;
    }
    // история на экране: поле тускнеет, из клеток набирается год (смена года идёт вместе с переездом слайда)
    const r = sec.getBoundingClientRect();
    const vis = clamp01((S.H - r.top) / S.H) * clamp01(r.bottom / S.H);
    S.storyDim = 0.45 * vis;
    S.storyVis = vis;
    S.storyPos = n > 1 ? pos : 0;
  }

  function frameSwipe() {
    const max = track.scrollWidth - track.clientWidth;
    const p = max > 0 ? track.scrollLeft / max : 0;
    if (fill) fill.style.setProperty('--prog', String(p));
    const mid = track.scrollLeft + track.clientWidth / 2;
    let best = 0, bd = Infinity;
    cards.forEach((c, k) => { const d = Math.abs(c.offsetLeft + c.offsetWidth / 2 - mid); if (d < bd) { bd = d; best = k; } });
    setCur(best);
    S.storyDim = 0; S.storyVis = 0;
  }

  S.storyYears = cards.map((c) => c.dataset.year);
  layout();
  setCur(0);
  addEventListener('resize', layout);
  document.fonts?.ready.then(layout);
  addEventListener('langchange', () => requestAnimationFrame(layout));
  addTicker((t, dt) => { if (mode === 'h') frameH(dt); else if (mode === 'swipe') frameSwipe(); else S.storyDim = 0; });

  // видео — только пока в кадре
  const vids = sec.querySelectorAll('video');
  if (vids.length && 'IntersectionObserver' in window) {
    const o = new IntersectionObserver((es) => es.forEach((e) => {
      const v = e.target;
      if (e.isIntersecting && S.motion) v.play().catch(() => {}); else v.pause();
    }), { threshold: 0.2 });
    vids.forEach((v) => o.observe(v));
  }
  window.__goStory = (p) => { if (mode === 'h') window.__goY(top + p * len); };
}
