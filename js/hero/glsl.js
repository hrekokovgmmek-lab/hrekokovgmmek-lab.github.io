// Общий GLSL: шум, поле, маска, фон. Стиль GLSL1 (texture2D, gl_FragColor) — three подставляет совместимость с WebGL2.
// Числа — config hero.tuning.

export const FULL_VERT = /* glsl */`
varying vec2 vUv;
void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

// Фон рисуется в той же сцене, что и портрет: глубина 0.999, за плоскостью.
export const BG_VERT = /* glsl */`
void main() { gl_Position = vec4(position.xy, 0.999, 1.0); }
`;

export const NOISE = /* glsl */`
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x), mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) { float s = 0.0, w = 0.5; for (int i = 0; i < 4; i++) { s += w * vnoise(p); p = p * 2.03 + 11.7; w *= 0.5; } return s; }
`;

// Проход клеток: 1 тексель на клетку 7×14 CSS px. R = поле n, G = «клетка на линии», B = закрутка у курсора.
export const CELLS_FRAG = /* glsl */`
uniform vec2 uCellPx; uniform float uScale; uniform float uTime; uniform float uLevels;
uniform vec3 uSwirl; uniform float uSwirlSigma2; uniform float uSwirlAmt;
${NOISE}
float fieldN(vec2 css) {
  vec2 uv = css / uScale;
  vec2 d = css - uSwirl.xy; float r2 = dot(d, d);
  float s = exp(-r2 / uSwirlSigma2) * uSwirl.z;
  vec2 dir = d / (sqrt(r2) + 1e-3);
  uv += vec2(-dir.y, dir.x) * s * uSwirlAmt;
  return fbm(uv + vec2(uTime * 0.018, -uTime * 0.012)) + 0.45 * fbm(uv * 1.8 - uTime * 0.01);
}
void main() {
  vec2 c = (floor(gl_FragCoord.xy) + 0.5) * uCellPx;
  float k0 = fieldN(c) * uLevels;
  float kx = fieldN(c + vec2(uCellPx.x, 0.0)) * uLevels;
  float ky = fieldN(c + vec2(0.0, uCellPx.y)) * uLevels;
  float g = length(vec2(kx - k0, ky - k0));
  float dist = abs(fract(k0) - 0.5) / max(g, 1e-4);
  float line = 1.0 - smoothstep(0.3, 0.6, dist);
  vec2 dd = c - uSwirl.xy;
  float sw = exp(-dot(dd, dd) / uSwirlSigma2) * uSwirl.z;
  gl_FragColor = vec4(k0 / uLevels, line, sw, 1.0);
}
`;

// Маска «что видно»: 0 — светлое (фото), 1 — тёмное (машина). Одна функция на фон и на портрет — края совпадают.
export const MASK = /* glsl */`
uniform vec2 uRes; uniform float uDpr; uniform float uTime;
uniform sampler2D uDye; uniform float uDyeOn; uniform vec2 uInkCut;
uniform float uSeamX; uniform float uSplit;
uniform vec4 uBand; // x — верх полосы «Работы», y — низ (CSS px снизу), z — вкл.
uniform vec4 uIntro; // вход на сайт: xy — центр (лицо, CSS px снизу), z — радиус светлого круга, w — вкл.
float introDist(vec2 css) { return length(css - uIntro.xy) + (vnoise(css / 46.0 + uTime * 0.6) - 0.5) * 40.0; }
float introDark(vec2 css) { return uIntro.w < 0.5 ? 0.0 : smoothstep(uIntro.z - 1.5, uIntro.z + 1.5, introDist(css)); }
float introRim(vec2 css) {
  if (uIntro.w < 0.5 || uIntro.z < 1.0) return 0.0;
  float d = introDist(css) - uIntro.z;
  return 1.0 - smoothstep(3.0, 24.0, abs(d - 11.0));
}
float inkAt(vec2 suv) { return uDyeOn > 0.5 ? texture2D(uDye, suv).r : 0.0; }
float seamMask(vec2 css) {
  float yN = css.y / uRes.y;
  float w = (vnoise(vec2(yN * 5.0, uTime * 0.5)) - 0.5) * 22.0 + sin(yN * 13.0 + uTime * 1.2) * 4.0;
  float side = smoothstep(-0.75, 0.75, css.x - (uSeamX + w));
  float surf = uSplit * 1.3 - 0.04 + vnoise(vec2(css.x / uRes.x * 7.0, uTime * 0.7)) * 0.05;
  float lvl = 1.0 - smoothstep(surf - 0.0015, surf + 0.0015, yN);
  return side * lvl;
}
float bandMask(vec2 css) {
  if (uBand.z < 0.5) return 0.0;
  float xN = css.x / uRes.x;
  float wt = vnoise(vec2(xN * 4.0, uTime * 0.4)) * 30.0 + sin(xN * 9.0 + uTime) * 5.0;
  float wb = vnoise(vec2(xN * 4.0 + 7.3, uTime * 0.4)) * 30.0 + sin(xN * 9.0 + uTime + 2.0) * 5.0;
  return smoothstep(uBand.y - wb - 0.75, uBand.y - wb + 0.75, css.y) * (1.0 - smoothstep(uBand.x + wt - 0.75, uBand.x + wt + 0.75, css.y));
}
float fluidMask(vec2 css, vec2 suv) {
  return smoothstep(uInkCut.x, uInkCut.y, inkAt(suv) + vnoise(css / 38.0 + uTime * 0.4) * 0.05);
}
float maskAt(vec2 css, vec2 suv) {
  return max(max(fluidMask(css, suv), seamMask(css)), introDark(css)) * (1.0 - bandMask(css));
}
`;

// «Атмосфера» тёплой палитры: зерно плёнки, виньетка, тёплый свет у курсора (в тёмном), старая бумага по краям (в светлом).
// Все силы — в uAtmo; при нулях код не меняет картинку. Uniform-ы объявляет тот, кто включает этот кусок.
export const ATMO = /* glsl */`
float grain(vec2 css) { return hash12(floor(css * uDpr) + fract(uTime * 7.31) * vec2(113.7, 71.3)) - 0.5; }
void atmosphere(inout vec3 light, inout vec3 dark, vec2 css, vec2 suv) {
  if (uAtmo.y <= 0.0 && uAtmo.z <= 0.0) return;
  vec2 q = (suv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
  float r = length(q);
  dark *= 1.0 - uAtmo.y * smoothstep(0.35, 1.05, r);
  light = mix(light, light * uPaperEdge, uAtmo.y * 0.8 * smoothstep(0.45, 1.15, r));
  if (uGlowPos.z > 0.0) {
    vec2 d = css - uGlowPos.xy;
    dark += uGlowCol * uAtmo.z * uGlowPos.z * exp(-dot(d, d) / (uAtmo.w * uAtmo.w));
  }
}
`;

// Фон: поле из 0 и 1 (светлый/тёмный режим по маске), заголовок, кромка из кода.
export const BG_FRAG = /* glsl */`
uniform sampler2D uCells; uniform vec2 uCellsSize; uniform vec2 uCellPx;
uniform sampler2D uGlyph; uniform sampler2D uPal; uniform float uPalFreq; uniform float uPalDrift;
uniform vec3 uStudio; uniform vec3 uInk; uniform float uGridPx; uniform float uGridAmt;
uniform float uBitHz; uniform vec4 uLineK; // светлый: база, +закрутка; тёмный: база, +подсветка
uniform float uBoost; uniform float uDim;
uniform sampler2D uHead; uniform float uTextL; uniform float uTextR;
uniform vec4 uRim; uniform float uCodeHz; uniform float uCodeAmt;
uniform vec3 uBottomFill; // x — y низа портрета (CSS px снизу), y — вкл., z — тон футболки
uniform vec2 uBottomX;    // x-диапазон портрета
uniform vec4 uAtmo;       // x — зерно, y — виньетка, z — сила тёплого света, w — радиус света (CSS px)
uniform vec3 uGlowCol; uniform vec3 uGlowPos; // цвет света; центр (CSS px снизу) и вкл.
uniform vec3 uPaperEdge;  // цвет краёв светлого режима (старая бумага)
uniform sampler2D uYear; uniform float uYearMix; uniform float uYearOn; // год за лентой: A — красный, B — зелёный
uniform sampler2D uIntroText; uniform float uIntroTextAmt; // надпись при входе на сайт
${NOISE}
${MASK}
${ATMO}
vec3 pal(float n, float x) { return texture2D(uPal, vec2(fract(uPalFreq * n + uPalDrift * uTime + x / 2400.0), 0.5)).rgb; }
float glyphAt(vec2 cell, vec2 local, float hz, float seed) {
  float h = hash12(cell + seed);
  float bit = step(0.5, hash12(cell + seed * 1.7 + floor(uTime * hz + h * 17.0)));
  return texture2D(uGlyph, vec2((bit + local.x) * 0.5, local.y)).a;
}
void main() {
  vec2 css = gl_FragCoord.xy / uDpr;
  vec2 suv = gl_FragCoord.xy / (uRes * uDpr);
  vec2 cell = floor(css / uCellPx);
  vec2 local = fract(css / uCellPx);
  vec4 C = texture2D(uCells, (cell + 0.5) / uCellsSize);
  float n = C.r, line = C.g * (1.0 - uDim), sw = C.b;
  float g0 = glyphAt(cell, local, uBitHz, 0.0);
  vec3 col = pal(n, css.x);
  float m = maskAt(css, suv);
  vec3 light = mix(uStudio, col, g0 * line * (uLineK.x + uLineK.y * sw));
  vec2 gp = mod(css, uGridPx);
  float grid = min(1.0, step(gp.x, 1.0) + step(gp.y, 1.0));
  vec3 dark = uInk + grid * uGridAmt + g0 * line * col * (uLineK.z + uLineK.w * max(sw, uBoost));
  if (uYearOn > 0.001) {
    // год клетками кода. Смена года — волна сверху вниз с небольшим разбросом: старые цифры плавно гаснут,
    // новые плавно проявляются; общие цифры соседних лет не трогаются (совпадают пиксель в пиксель).
    vec2 cuv = (cell + 0.5) * uCellPx / uRes;
    vec4 Yt = texture2D(uYear, cuv);
    float th = 0.62 * (1.0 - cuv.y) + 0.38 * hash12(cell + 9.7);
    const float W = 0.16;
    float kB = smoothstep(th - W, th + W, uYearMix * (1.0 + 2.0 * W) - W);
    float v = mix(Yt.r, Yt.g, kB);
    dark += smoothstep(0.15, 0.85, v) * g0 * col * 0.62 * uYearOn;
  }
  if (uIntroTextAmt > 0.001) {
    // домен клетками 0/1: под буквами символы ярче и чаще; растворяется по клеткам в случайном порядке
    vec2 cuv = (cell + 0.5) * uCellPx / uRes;
    float tm = texture2D(uIntroText, cuv).r;
    float th = hash12(cell + 4.2);
    float k = smoothstep(th - 0.25, th + 0.25, uIntroTextAmt * 1.5 - 0.25) * step(0.5, tm);
    float gy = glyphAt(cell, local, 2.4, 7.7);
    light = mix(light, col * 0.78, gy * k * 0.92);
    dark += gy * k * col * 0.8;
  }
  atmosphere(light, dark, css, suv);
  vec3 c = mix(light, dark, m);
  if (uBottomFill.y > 0.5 && css.y < uBottomFill.x && css.x > uBottomX.x && css.x < uBottomX.y) c = vec3(uBottomFill.z);
  vec4 H = texture2D(uHead, suv);
  float ta = clamp(H.r * uTextL + H.g * uTextR * seamMask(css), 0.0, 1.0);
  c = mix(c, vec3(mix(0.07, 0.95, m)), ta);
  float ink = inkAt(suv);
  float rim = max(smoothstep(uRim.x, uRim.y, ink) * (1.0 - smoothstep(uRim.z, uRim.w, ink)) * uCodeAmt, introRim(css));
  if (rim > 0.001) {
    float g1 = glyphAt(cell, local, uCodeHz, 3.1);
    c = mix(c, col, rim * g1);
  }
  c += grain(css) * uAtmo.x;
  gl_FragColor = vec4(c, 1.0);
}
`;
