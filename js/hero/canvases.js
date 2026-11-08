// Скрытые 2D-холсты, которые становятся текстурами: атлас 0/1, заголовок, год за лентой.

const DISPLAY = '"Roboto Flex", "Arial Narrow", sans-serif';
const MONO = '"Geist Mono", ui-monospace, monospace';

/** Атлас «0 | 1» ровно в размер клетки в пикселях устройства — символ чёткий, без мип-уровней. */
export function glyphAtlas(dpr, cell) {
  const w = Math.max(4, Math.round(cell[0] * dpr)), h = Math.max(8, Math.round(cell[1] * dpr));
  const c = document.createElement('canvas');
  c.width = w * 2; c.height = h;
  const g = c.getContext('2d');
  g.clearRect(0, 0, c.width, c.height);
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `500 ${(11.5 * dpr).toFixed(2)}px ${MONO}`;
  g.fillText('0', w * 0.5, h * 0.53);
  g.fillText('1', w * 1.5, h * 0.53);
  return c;
}

function setFont(g, px, weight, stretch) {
  g.font = `${weight} ${px.toFixed(2)}px ${DISPLAY}`;
  if ('fontStretch' in g) g.fontStretch = stretch;
}

/** Высота заглавных в долях размера шрифта (по букве E на холсте). */
export function capRatio(weight = 850, stretch = 'expanded') {
  const c = document.createElement('canvas'); c.width = c.height = 8;
  const g = c.getContext('2d');
  setFont(g, 100, weight, stretch);
  const m = g.measureText('E');
  return (m.actualBoundingBoxAscent || 71) / 100;
}

/**
 * Заголовок двух половин: левая — красный канал, правая — зелёный.
 * o: { W, H, dpr, seamX, eyeY, faceHalf, left[], right[], phone, hairTopY, gutter }
 * Координаты — CSS px, y сверху.
 */
export function drawHeadline(cv, o) {
  const { W, H, dpr } = o;
  cv.width = Math.max(2, Math.round(W * dpr)); cv.height = Math.max(2, Math.round(H * dpr));
  const g = cv.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, W, H);
  g.textBaseline = 'alphabetic';
  const stretch = 'expanded', weight = 850;
  const widest = (arr) => Math.max(1, ...arr.map((s) => g.measureText(s).width));
  const cap = capRatio(weight, stretch);
  const L = o.left.map((s) => s.toUpperCase()), R = o.right.map((s) => s.toUpperCase());
  let layout;
  if (!o.phone) {
    const off = o.faceHalf + Math.max(28, 0.035 * W);
    const availL = o.seamX - off - o.gutter, availR = W - (o.seamX + off) - o.gutter;
    let fs = 0.16 * H;
    setFont(g, fs, weight, stretch);
    fs = Math.max(10, Math.min(fs, fs * availL / widest(L), fs * availR / widest(R)));
    setFont(g, fs, weight, stretch);
    const top = o.eyeY - 0.35 * fs;
    const b1 = top + cap * fs, b2 = b1 + 0.9 * fs;
    layout = { fs, xl: o.seamX - off, xr: o.seamX + off, b1, b2, al: 'right', ar: 'left' };
  } else {
    const gap = 16, avail = (W - 2 * o.gutter - gap) / 2;
    let fs = 44;
    setFont(g, fs, weight, stretch);
    fs = Math.max(10, Math.min(fs, fs * avail / widest(L), fs * avail / widest(R)));
    setFont(g, fs, weight, stretch);
    const b2 = o.hairTopY - 0.18 * fs, b1 = b2 - 0.9 * fs;
    layout = { fs, xl: o.gutter, xr: W - o.gutter, b1, b2, al: 'left', ar: 'right' };
  }
  g.globalCompositeOperation = 'lighter';
  g.fillStyle = 'rgb(255,0,0)'; g.textAlign = layout.al;
  g.fillText(L[0] || '', layout.xl, layout.b1); g.fillText(L[1] || '', layout.xl, layout.b2);
  g.fillStyle = 'rgb(0,255,0)'; g.textAlign = layout.ar;
  g.fillText(R[0] || '', layout.xr, layout.b1); g.fillText(R[1] || '', layout.xr, layout.b2);
  g.globalCompositeOperation = 'source-over';
  return layout;
}

/**
 * Год за лентой: год A — обводкой в красном канале, год B — в зелёном. Цифры в 4 одинаковых «слота»,
 * чтобы общие цифры соседних лет совпадали пиксель в пиксель.
 */
export function drawYears(cv, o) {
  const { W, H, dpr } = o;
  cv.width = Math.max(2, Math.round(W * dpr)); cv.height = Math.max(2, Math.round(H * dpr));
  const g = cv.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, W, H);
  const stretch = 'extra-condensed', weight = 850;
  const cap = capRatio(weight, stretch);
  let fs = 0.86 * H / cap;
  setFont(g, fs, weight, stretch);
  let slot = Math.max(...'0123456789'.split('').map((d) => g.measureText(d).width));
  const maxW = W * 0.92;
  if (slot * 4 > maxW) { fs *= maxW / (slot * 4); setFont(g, fs, weight, stretch); slot = maxW / 4; }
  const total = slot * 4, x0 = (W - total) / 2, base = (H + cap * fs) / 2;
  g.lineWidth = Math.max(6, 18 * (H / 900));
  g.lineJoin = 'round';
  g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  g.globalCompositeOperation = 'lighter';
  const put = (yr, color) => {
    if (!yr) return;
    g.strokeStyle = color;
    String(yr).slice(0, 4).split('').forEach((d, i) => g.strokeText(d, x0 + slot * (i + 0.5), base));
  };
  put(o.a, 'rgb(255,0,0)');
  put(o.b, 'rgb(0,255,0)');
  g.globalCompositeOperation = 'source-over';
}

/** Надпись для входа на сайт (домен): красный канал — маска букв; клетки 0/1 под буквами горят ярче. */
export function drawIntroText(cv, o) {
  const { W, H, text } = o;
  cv.width = Math.max(2, Math.round(W)); cv.height = Math.max(2, Math.round(H));
  const g = cv.getContext('2d');
  g.clearRect(0, 0, W, H);
  const weight = 850, stretch = 'condensed';
  const cap = capRatio(weight, stretch);
  let fs = Math.min(H * 0.2 / cap, 400);
  setFont(g, fs, weight, stretch);
  const w = g.measureText(text).width;
  const maxW = W * 0.88;
  if (w > maxW) { fs *= maxW / w; setFont(g, fs, weight, stretch); }
  g.fillStyle = 'rgb(255,0,0)'; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  g.fillText(text, W / 2, H * 0.5 + cap * fs / 2);
}
