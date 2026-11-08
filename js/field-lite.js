// Облегчённое поле для внутренних страниц: чистый WebGL1 без three.js, один треугольник на экран,
// те же линии из 0 и 1 (тёмный режим), закрутка у курсора. Без движения — один кадр.
const cv = document.getElementById('gl');
const gl = cv && (cv.getContext('webgl', { antialias: false, alpha: false }) || null);
const cfgEl = document.getElementById('site-config');
const cfg = cfgEl ? JSON.parse(cfgEl.textContent) : {};
const hex = (h, d) => { const n = parseInt((h || d).slice(1), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };

if (gl) {
  const t = cfg.theme || {};
  const ink = hex(t.ink, '#100F0D');
  const stops = (t.fieldStops || ['#F2B84B', '#EE8A3C', '#D9573B', '#B8456A', '#8E5BA8', '#B8456A', '#D9573B', '#EE8A3C']).map((s) => hex(s));
  const N = stops.length;
  const vs = 'attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }';
  const fs = `precision highp float;
uniform vec2 uRes; uniform float uDpr; uniform float uTime; uniform vec3 uSwirl; uniform vec3 uInk; uniform vec3 uStops[${N}];
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.-2.*f);
  return mix(mix(hash12(i), hash12(i+vec2(1,0)), u.x), mix(hash12(i+vec2(0,1)), hash12(i+vec2(1,1)), u.x), u.y); }
float fbm(vec2 p){ float s = 0., w = .5; for (int i = 0; i < 4; i++){ s += w*vnoise(p); p = p*2.03 + 11.7; w *= .5; } return s; }
float fieldN(vec2 css){ vec2 uv = css / 560.; vec2 d = css - uSwirl.xy; float r2 = dot(d,d);
  uv += vec2(-d.y, d.x) / (sqrt(r2) + 1e-3) * exp(-r2 / 40000.) * uSwirl.z * .15;
  return fbm(uv + vec2(uTime*.018, -uTime*.012)) + .45*fbm(uv*1.8 - uTime*.01); }
vec3 pal(float s){ s = fract(s) * ${N}.0; vec3 c = uStops[0];
  for (int i = 0; i < ${N}; i++) { float f = clamp(s - float(i), 0., 1.); c = mix(c, uStops[i == ${N - 1} ? 0 : i + 1], f * f * (3. - 2. * f) * step(float(i), s)); }
  return c; }
float glyph(vec2 local, float bit){
  // 0 — овал, 1 — палочка: простые формы, без атласа
  vec2 q = (local - .5) * vec2(1., 2.);
  float o = abs(length(q * vec2(1.25, .62)) - .42) < .1 ? 1. : 0.;
  float l = abs(q.x) < .1 && abs(q.y) < .62 ? 1. : 0.;
  return mix(o, l, bit) * step(abs(q.y), .66);
}
void main(){
  vec2 css = gl_FragCoord.xy / uDpr; vec2 cs = vec2(7., 14.);
  vec2 cell = floor(css / cs), local = fract(css / cs), c = (cell + .5) * cs;
  float k0 = fieldN(c) * 13., kx = fieldN(c + vec2(7., 0.)) * 13., ky = fieldN(c + vec2(0., 14.)) * 13.;
  float d = abs(fract(k0) - .5) / max(length(vec2(kx - k0, ky - k0)), 1e-4);
  float line = 1. - smoothstep(.3, .6, d);
  float h = hash12(cell);
  float bit = step(.5, hash12(cell + floor(uTime * 1.2 + h * 17.)));
  vec2 gp = mod(css, 28.); float grid = min(1., step(gp.x, 1.) + step(gp.y, 1.));
  vec3 col = pal(1.6 * k0 / 13. + .025 * uTime + css.x / 2400.);
  vec3 o = uInk + grid * .05 + glyph(local, bit) * line * col * .46;
  gl_FragColor = vec4(o, 1.);
}`;
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
  const pr = gl.createProgram();
  gl.attachShader(pr, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(pr);
  if (gl.getProgramParameter(pr, gl.LINK_STATUS)) {
    gl.useProgram(pr);
    const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const U = (n) => gl.getUniformLocation(pr, n);
    gl.uniform3fv(U('uInk'), ink);
    gl.uniform3fv(U('uStops'), new Float32Array(stops.flat()));
    const motion = !matchMedia('(prefers-reduced-motion: reduce)').matches;
    const sw = { x: 0, y: 0, k: 0, tx: 0, ty: 0, tk: 0 };
    addEventListener('pointermove', (e) => { sw.tx = e.clientX; sw.ty = innerHeight - e.clientY; sw.tk = 1; }, { passive: true });
    let W = 0, H = 0, dpr = 1;
    const resize = () => {
      dpr = Math.min(devicePixelRatio || 1, 1.5); W = innerWidth; H = innerHeight;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); gl.viewport(0, 0, cv.width, cv.height);
    };
    resize(); addEventListener('resize', () => { resize(); if (!motion) draw(30); });
    const draw = (t) => {
      sw.x += (sw.tx - sw.x) * 0.12; sw.y += (sw.ty - sw.y) * 0.12; sw.k += (sw.tk - sw.k) * 0.12;
      gl.uniform2f(U('uRes'), W, H); gl.uniform1f(U('uDpr'), dpr); gl.uniform1f(U('uTime'), t);
      gl.uniform3f(U('uSwirl'), sw.x, sw.y, sw.k);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    if (motion) { const loop = (now) => { requestAnimationFrame(loop); draw(now / 1000); }; requestAnimationFrame(loop); }
    else draw(30);
    document.documentElement.classList.add('gl');
  }
}
