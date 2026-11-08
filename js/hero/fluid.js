// Жидкость под курсором: stable fluids на целях half-float .
// Время — в долях 1/60 с (f = min(2, dt·60)); чернила кладутся max'ом, скорость — суммой; сон после N шагов без мазков.
import * as THREE from '/vendor/three-0.185.1/three.module.min.js';

const VERT = /* glsl */`
uniform vec2 uTexel;
varying vec2 vUv; varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  vL = vUv - vec2(uTexel.x, 0.0); vR = vUv + vec2(uTexel.x, 0.0);
  vT = vUv + vec2(0.0, uTexel.y); vB = vUv - vec2(0.0, uTexel.y);
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;
const HEAD = 'precision highp float; varying vec2 vUv; varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB;\n';

const FRAG = {
  splatVel: `uniform sampler2D uTarget; uniform float uAspect; uniform vec2 uPoint; uniform vec3 uColor; uniform float uRadius;
    void main() { vec2 p = vUv - uPoint; p.x *= uAspect; vec3 s = exp(-dot(p, p) / uRadius) * uColor;
      gl_FragColor = vec4(texture2D(uTarget, vUv).xyz + s, 1.0); }`,
  splatDye: `uniform sampler2D uTarget; uniform float uAspect; uniform vec2 uPoint; uniform vec2 uDir; uniform float uRadius; uniform float uInk; uniform float uSquash;
    void main() { vec2 p = vUv - uPoint; p.x *= uAspect; vec2 d = uDir; float a = dot(p, d), c = dot(p, vec2(-d.y, d.x));
      float e = exp(-(a * a / uSquash + c * c) / uRadius) * uInk;
      vec4 b = texture2D(uTarget, vUv); gl_FragColor = vec4(max(b.r, e), 0.0, 0.0, 1.0); }`,
  curl: `uniform sampler2D uVelocity;
    void main() { float L = texture2D(uVelocity, vL).y, R = texture2D(uVelocity, vR).y, T = texture2D(uVelocity, vT).x, B = texture2D(uVelocity, vB).x;
      gl_FragColor = vec4(0.5 * (R - L - T + B), 0.0, 0.0, 1.0); }`,
  vorticity: `uniform sampler2D uVelocity; uniform sampler2D uCurl; uniform float uCurlK; uniform float uDt;
    void main() { float L = texture2D(uCurl, vL).x, R = texture2D(uCurl, vR).x, T = texture2D(uCurl, vT).x, B = texture2D(uCurl, vB).x, C = texture2D(uCurl, vUv).x;
      vec2 f = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L)); f /= length(f) + 0.0001; f *= uCurlK * C; f.y *= -1.0;
      vec2 v = texture2D(uVelocity, vUv).xy + f * uDt; gl_FragColor = vec4(clamp(v, -1000.0, 1000.0), 0.0, 1.0); }`,
  divergence: `uniform sampler2D uVelocity;
    void main() { float L = texture2D(uVelocity, vL).x, R = texture2D(uVelocity, vR).x, T = texture2D(uVelocity, vT).y, B = texture2D(uVelocity, vB).y;
      vec2 C = texture2D(uVelocity, vUv).xy;
      if (vL.x < 0.0) L = -C.x; if (vR.x > 1.0) R = -C.x; if (vT.y > 1.0) T = -C.y; if (vB.y < 0.0) B = -C.y;
      gl_FragColor = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0); }`,
  clear: `uniform sampler2D uTexture; uniform float uValue; void main() { gl_FragColor = uValue * texture2D(uTexture, vUv); }`,
  pressure: `uniform sampler2D uPressure; uniform sampler2D uDivergence;
    void main() { float L = texture2D(uPressure, vL).x, R = texture2D(uPressure, vR).x, T = texture2D(uPressure, vT).x, B = texture2D(uPressure, vB).x;
      float div = texture2D(uDivergence, vUv).x; gl_FragColor = vec4((L + R + B + T - div) * 0.25, 0.0, 0.0, 1.0); }`,
  gradient: `uniform sampler2D uPressure; uniform sampler2D uVelocity;
    void main() { float L = texture2D(uPressure, vL).x, R = texture2D(uPressure, vR).x, T = texture2D(uPressure, vT).x, B = texture2D(uPressure, vB).x;
      vec2 v = texture2D(uVelocity, vUv).xy - vec2(R - L, T - B); gl_FragColor = vec4(v, 0.0, 1.0); }`,
  advect: `uniform sampler2D uVelocity; uniform sampler2D uSource; uniform vec2 uSimTexel; uniform float uDt; uniform float uDissipation;
    void main() { vec2 coord = vUv - uDt * texture2D(uVelocity, vUv).xy * uSimTexel; gl_FragColor = uDissipation * texture2D(uSource, coord); }`,
  blur: `uniform sampler2D uSource;
    void main() { vec4 s = texture2D(uSource, vUv) * 0.4 + (texture2D(uSource, vL) + texture2D(uSource, vR) + texture2D(uSource, vT) + texture2D(uSource, vB)) * 0.15;
      gl_FragColor = s; }`,
};

function target(w, h) {
  return new THREE.WebGLRenderTarget(w, h, {
    type: THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
    wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping, depthBuffer: false, stencilBuffer: false,
  });
}
function pair(w, h) {
  const p = { read: target(w, h), write: target(w, h), swap() { const t = p.read; p.read = p.write; p.write = t; } };
  return p;
}
function grid(W, H, short) {
  const a = W / H;
  return a >= 1 ? [Math.round(short * a), short] : [short, Math.round(short / a)];
}

export class Fluid {
  constructor(renderer, opts) {
    this.r = renderer;
    this.o = opts; // hero.tuning.fluid
    this.scene = new THREE.Scene();
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);
    this.m = {};
    for (const [k, src] of Object.entries(FRAG)) {
      this.m[k] = new THREE.ShaderMaterial({
        vertexShader: VERT, fragmentShader: HEAD + src, depthTest: false, depthWrite: false,
        uniforms: { uTexel: { value: new THREE.Vector2() } },
      });
    }
    this.asleep = true;
    this.idle = 0;
    this.passes = 0;
  }

  resize(W, H) {
    const [sw, sh] = grid(W, H, this.o.simRes), [dw, dh] = grid(W, H, this.o.dyeRes);
    if (this.sim && this.sim[0] === sw && this.sim[1] === sh && this.dyeSize[0] === dw && this.dyeSize[1] === dh) return;
    for (const t of [this.vel, this.dye, this.prs]) if (t) { t.read.dispose(); t.write.dispose(); }
    if (this.div) { this.div.dispose(); this.curlT.dispose(); }
    this.sim = [sw, sh]; this.dyeSize = [dw, dh];
    this.vel = pair(sw, sh); this.prs = pair(sw, sh); this.dye = pair(dw, dh);
    this.div = target(sw, sh); this.curlT = target(sw, sh);
    this.simTexel = new THREE.Vector2(1 / sw, 1 / sh);
    this.dyeTexel = new THREE.Vector2(1 / dw, 1 / dh);
    this.aspect = W / H;
    this.clearAll();
  }

  get texture() { return this.dye.read.texture; }

  run(name, out, uniforms, texel) {
    const mat = this.m[name];
    for (const k in uniforms) {
      if (!mat.uniforms[k]) mat.uniforms[k] = { value: uniforms[k] }; else mat.uniforms[k].value = uniforms[k];
    }
    mat.uniforms.uTexel.value.copy(texel || this.simTexel);
    this.quad.material = mat;
    this.r.setRenderTarget(out);
    this.r.render(this.scene, this.cam);
    this.passes++;
  }

  clearAll() {
    const prev = this.r.getRenderTarget(), c = new THREE.Color(), a = this.r.getClearAlpha();
    this.r.getClearColor(c);
    this.r.setClearColor(0x000000, 0);
    for (const t of [this.vel.read, this.vel.write, this.prs.read, this.prs.write, this.dye.read, this.dye.write, this.div, this.curlT]) {
      this.r.setRenderTarget(t); this.r.clear(true, false, false);
    }
    this.r.setRenderTarget(prev);
    this.r.setClearColor(c, a);
  }

  /** Мазок: x, y — доли экрана (0..1, y снизу), dx, dy — сила, dir — направление (норм.), thick — толщина. */
  splat(x, y, dx, dy, dir, thick, ink) {
    const o = this.o, a = this.aspect;
    const ra = a > 1 ? a : 1;
    this.run('splatVel', this.vel.write, {
      uTarget: this.vel.read.texture, uAspect: a, uPoint: new THREE.Vector2(x, y),
      uColor: new THREE.Vector3(dx, dy, 0), uRadius: o.pushRadius * ra * thick,
    });
    this.vel.swap();
    this.run('splatDye', this.dye.write, {
      uTarget: this.dye.read.texture, uAspect: a, uPoint: new THREE.Vector2(x, y), uDir: new THREE.Vector2(dir[0], dir[1]),
      uRadius: o.inkRadius * ra * thick, uInk: ink ?? o.ink, uSquash: o.squash,
    }, this.dyeTexel);
    this.dye.swap();
    this.asleep = false;
    this.idle = 0;
  }

  /** Шаг симуляции. f — время в долях 1/60 с; fade — затухание за 1/60 с. */
  step(f, fade) {
    if (this.asleep) return;
    const o = this.o, dt = f / 60;
    this.run('curl', this.curlT, { uVelocity: this.vel.read.texture });
    this.run('vorticity', this.vel.write, { uVelocity: this.vel.read.texture, uCurl: this.curlT.texture, uCurlK: o.curl, uDt: dt });
    this.vel.swap();
    this.run('divergence', this.div, { uVelocity: this.vel.read.texture });
    this.run('clear', this.prs.write, { uTexture: this.prs.read.texture, uValue: 0.8 });
    this.prs.swap();
    for (let i = 0; i < o.pressureIters; i++) {
      this.run('pressure', this.prs.write, { uPressure: this.prs.read.texture, uDivergence: this.div.texture });
      this.prs.swap();
    }
    this.run('gradient', this.vel.write, { uPressure: this.prs.read.texture, uVelocity: this.vel.read.texture });
    this.vel.swap();
    const dis = Math.pow(fade, f);
    this.run('advect', this.vel.write, { uVelocity: this.vel.read.texture, uSource: this.vel.read.texture, uSimTexel: this.simTexel, uDt: dt, uDissipation: dis });
    this.vel.swap();
    this.run('advect', this.dye.write, { uVelocity: this.vel.read.texture, uSource: this.dye.read.texture, uSimTexel: this.simTexel, uDt: dt, uDissipation: dis }, this.dyeTexel);
    this.dye.swap();
    for (let i = 0; i < o.blurPasses; i++) {
      this.run('blur', this.dye.write, { uSource: this.dye.read.texture }, this.dyeTexel);
      this.dye.swap();
    }
    this.idle += f;
    if (this.idle >= o.sleepSteps) { this.clearAll(); this.asleep = true; }
  }
}
