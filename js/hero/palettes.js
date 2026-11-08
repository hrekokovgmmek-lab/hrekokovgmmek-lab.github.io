// Палитры поля 0/1 и токены страницы. Какую взять — config theme.palette.
// Палитра поля — циклическая полоса 256×1: шейдер берёт цвет по fract(частота·n + дрейф·t + x/2400).

export const PALETTES = {
  // Полный спектр: косинусная радуга (0.5 + 0.5·cos 2π(s + (0, .33, .67))).
  spectrum: {
    label: 'Спектр',
    studio: '#F8F8F6', ink: '#0B0B0B', paper: '#F2F2F2', soft: '#8A8A85', line: '#262624', signal: '#FAF600',
    cos: { a: [0.5, 0.5, 0.5], b: [0.5, 0.5, 0.5], c: [1, 1, 1], d: [0, 0.33, 0.67] },
  },
  // Solana: фиолетовый → синий → бирюза → зелёный и обратно; сигнал — зелёный.
  solana: {
    label: 'Solana',
    studio: '#F6F6F3', ink: '#08080C', paper: '#F1F1F4', soft: '#8A8A93', line: '#24242B', signal: '#14F195',
    stops: ['#9945FF', '#6A5CFF', '#2F8BFF', '#19D3C5', '#14F195', '#19D3C5', '#2F8BFF', '#6A5CFF'],
  },
  // Бумага и янтарь: тёплые тона нынешнего сайта, сигнал — яркий кирпич.
  amber: {
    label: 'Бумага и янтарь',
    studio: '#F4F2EC', ink: '#100F0D', paper: '#F3EFE6', soft: '#8F8A7F', line: '#2A2723', signal: '#FF6B3D',
    stops: ['#F2B84B', '#EE8A3C', '#D9573B', '#B8456A', '#8E5BA8', '#B8456A', '#D9573B', '#EE8A3C'],
    // атмосфера: зерно, виньетка, тёплый свет у курсора, края «старой бумаги»; яркость линий на тёмном чуть выше
    atmo: { grain: 0.028, vignette: 0.42, glow: 0.11, glowR: 420, glowCol: '#FF8A3D', paperEdge: '#E9DCC4', lineDark: 0.46 },
  },
};
const NO_ATMO = { grain: 0, vignette: 0, glow: 0, glowR: 400, glowCol: '#000000', paperEdge: '#FFFFFF', lineDark: 0.36 };

/** Атмосфера палитры; ?atmo=0 выключает (для сравнения снимками). */
export function atmoOf(p) {
  let off = false;
  try { off = new URLSearchParams(location.search).get('atmo') === '0'; } catch { /* нет адреса */ }
  return off || !p.atmo ? NO_ATMO : { ...NO_ATMO, ...p.atmo };
}

function hex(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** RGBA8 256×1, циклическая. */
export function paletteBytes(p) {
  const N = 256, out = new Uint8Array(N * 4);
  for (let i = 0; i < N; i++) {
    const s = i / N;
    let rgb;
    if (p.cos) {
      const { a, b, c, d } = p.cos;
      rgb = [0, 1, 2].map((k) => 255 * Math.min(1, Math.max(0, a[k] + b[k] * Math.cos(2 * Math.PI * (c[k] * s + d[k])))));
    } else {
      const st = p.stops, x = s * st.length, j = Math.floor(x) % st.length, f = x - Math.floor(x);
      const t = f * f * (3 - 2 * f);
      const A = hex(st[j]), B = hex(st[(j + 1) % st.length]);
      rgb = [0, 1, 2].map((k) => A[k] + (B[k] - A[k]) * t);
    }
    out.set([rgb[0], rgb[1], rgb[2], 255].map((v) => Math.round(v)), i * 4);
  }
  return out;
}

export function rgb01(h) { return hex(h).map((v) => v / 255); }

/** Имя палитры: ?pal= (для снимков) → config theme.palette → spectrum. */
export function pickPalette(theme) {
  let name = null;
  try { name = new URLSearchParams(location.search).get('pal'); } catch { /* нет адреса */ }
  if (!PALETTES[name]) name = theme && PALETTES[theme.palette] ? theme.palette : null;
  if (!name) return { name: 'config', ...PALETTES.spectrum, ...pickTokens(theme) };
  return { name, ...PALETTES[name] };
}

function pickTokens(theme) {
  const t = {};
  for (const k of ['studio', 'ink', 'paper', 'soft', 'line', 'signal']) if (theme && theme[k]) t[k] = theme[k];
  return t;
}
