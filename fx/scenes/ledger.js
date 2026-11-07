// The About hero: one bevelled block per preregistered experiment, with an ambient field of ledger glyphs.
const GLYPHS = "0123456789ABCDEF{}[]<>+-=/:#%$@";
const GLYPH_COUNT = 42;
const clamp = (v) => Math.min(1, Math.max(0, v));
const ease = (v) => 1 - Math.pow(1 - clamp(v), 5);
const random = (i, salt = 0) => {
  const n = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453123;
  return n - Math.floor(n);
};

function blockGeometry(THREE) {
  const shape = new THREE.Shape();
  const x = -0.48, y = -0.26, w = 0.96, h = 0.52, r = 0.075;
  shape.moveTo(x + r, y);
  shape.lineTo(x + w - r, y); shape.quadraticCurveTo(x + w, y, x + w, y + r);
  shape.lineTo(x + w, y + h - r); shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  shape.lineTo(x + r, y + h); shape.quadraticCurveTo(x, y + h, x, y + h - r);
  shape.lineTo(x, y + r); shape.quadraticCurveTo(x, y, x + r, y);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.38, steps: 1, bevelEnabled: true, bevelThickness: 0.035,
    bevelSize: 0.035, bevelSegments: 2, curveSegments: 4,
  });
  geometry.center();
  return geometry;
}

function glyphTexture(THREE) {
  const cell = 64, cols = 8, rows = Math.ceil(GLYPHS.length / cols);
  const canvas = document.createElement('canvas');
  canvas.width = cols * cell; canvas.height = rows * cell;
  const ctx = canvas.getContext('2d');
  ctx.font = '34px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff';
  for (let i = 0; i < GLYPHS.length; i++) {
    ctx.fillText(GLYPHS[i], (i % cols + 0.5) * cell, (Math.floor(i / cols) + 0.52) * cell);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter; texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  return { texture, cols, rows };
}

export function mount({ el, stage, ScrollTrigger, add, data, undo }) {
  const count = Math.floor(Number(data?.experiments));
  if (!count) return;
  let started = 0, skipped = false, scroll = 0, viewW = 0, viewH = 0;
  let targetX = 0, targetY = 0, pointerX = 0, pointerY = 0;
  let group, mesh, links, glyphs, glyphCamera, dummy;
  let geometry, material, linkGeometry, linkMaterial, glyphGeometry, glyphMaterial, atlas;
  const final = Array.from({ length: count }, (_, i) => ({
    x: (i % 4 - 1.5) * 1.01,
    y: (Math.floor(i / 4) % 4 - 1.5) * 0.59,
    z: (Math.floor(i / 16) - 0.5) * 0.56,
  }));

  const def = {
    el,
    setup({ THREE, renderer, color }) {
      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(-4, 4, 3, -3, 0.1, 80);
      camera.position.set(5.2, 4.1, 7.5); camera.lookAt(0, 0, 0);
      group = new THREE.Group(); scene.add(group);
      const paper = color('--paper', '#f4f2ec'), ink = color('--ink', '#1f1f1f');
      const brick = color('--brick', '#a84b36'), rule = color('--rule', '#dedad1'), grey = color('--grey', '#6f6b62');

      geometry = blockGeometry(THREE);
      material = new THREE.MeshStandardMaterial({
        color: 0xffffff, roughness: 0.42, metalness: 0.03,
        transparent: true, opacity: 0.96, depthWrite: true,
      });
      mesh = new THREE.InstancedMesh(geometry, material, count);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      for (let i = 0; i < count; i++) {
        const c = paper.clone().lerp(rule, 0.32 + random(i, 2) * 0.42);
        if (i % 11 === 7) c.lerp(brick, 0.72);
        else if (i % 7 === 3) c.lerp(ink, 0.16);
        mesh.setColorAt(i, c);
      }
      group.add(mesh); dummy = new THREE.Object3D();

      const segments = [];
      const join = (a, b) => segments.push(final[a].x, final[a].y, final[a].z, final[b].x, final[b].y, final[b].z);
      for (let i = 0; i < count; i++) {
        if (i % 4 !== 3) join(i, i + 1);
        if (Math.floor(i / 4) % 4 !== 3) join(i, i + 4);
        if (i + 16 < count) join(i, i + 16);
      }
      linkGeometry = new THREE.BufferGeometry();
      linkGeometry.setAttribute('position', new THREE.Float32BufferAttribute(segments, 3));
      linkMaterial = new THREE.LineBasicMaterial({ color: brick, transparent: true, opacity: 0 });
      links = new THREE.LineSegments(linkGeometry, linkMaterial); group.add(links);

      scene.add(new THREE.HemisphereLight(paper, ink, 2.0));
      const key = new THREE.DirectionalLight(0xffffff, 2.8); key.position.set(-3, 6, 8); scene.add(key);
      const rim = new THREE.DirectionalLight(brick, 1.1); rim.position.set(5, 1, -4); scene.add(rim);

      atlas = glyphTexture(THREE);
      glyphGeometry = new THREE.BufferGeometry();
      glyphGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(GLYPH_COUNT * 3), 3).setUsage(THREE.DynamicDrawUsage));
      glyphGeometry.setAttribute('alpha', new THREE.BufferAttribute(new Float32Array(GLYPH_COUNT), 1).setUsage(THREE.DynamicDrawUsage));
      glyphGeometry.setAttribute('size', new THREE.BufferAttribute(new Float32Array(GLYPH_COUNT), 1));
      glyphGeometry.setAttribute('glyph', new THREE.BufferAttribute(new Float32Array(GLYPH_COUNT), 1));
      for (let i = 0; i < GLYPH_COUNT; i++) {
        glyphGeometry.attributes.size.setX(i, 12 + random(i, 5) * 11);
        glyphGeometry.attributes.glyph.setX(i, Math.floor(random(i, 6) * GLYPHS.length));
      }
      glyphMaterial = new THREE.ShaderMaterial({
        uniforms: {
          map: { value: atlas.texture }, dpr: { value: renderer.getPixelRatio() },
          tint: { value: grey }, grid: { value: new THREE.Vector2(atlas.cols, atlas.rows) },
        },
        vertexShader: 'attribute float size; attribute float alpha; attribute float glyph; uniform float dpr; varying float vAlpha; varying float vGlyph;'
          + 'void main(){vAlpha=alpha;vGlyph=glyph;gl_PointSize=size*dpr;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
        fragmentShader: 'uniform sampler2D map; uniform vec3 tint; uniform vec2 grid; varying float vAlpha; varying float vGlyph;'
          + 'void main(){float g=floor(vGlyph+0.5);vec2 cell=vec2(mod(g,grid.x),floor(g/grid.x));'
          + 'vec2 uv=(cell+vec2(gl_PointCoord.x,1.0-gl_PointCoord.y))/grid;float a=texture2D(map,uv).a*vAlpha;'
          + 'if(a<0.008)discard;gl_FragColor=vec4(tint,a);}',
        transparent: true, depthTest: false, depthWrite: false,
      });
      glyphs = new THREE.Points(glyphGeometry, glyphMaterial); glyphs.frustumCulled = false;
      const glyphScene = new THREE.Scene(); glyphScene.add(glyphs);
      glyphCamera = new THREE.OrthographicCamera(0, 1, 0, -1, -10, 10); glyphCamera.position.z = 1;
      def.glyphScene = glyphScene; def.scene = scene; def.camera = camera;
    },
    frame(t, dt, w, h, renderer) {
      if (!started) started = t;
      if (w !== viewW || h !== viewH) {
        viewW = w; viewH = h;
        const aspect = w / h;
        const view = w < 600 ? 3.3 : 3.0;
        def.camera.left = -view * aspect; def.camera.right = view * aspect;
        def.camera.top = view; def.camera.bottom = -view; def.camera.updateProjectionMatrix();
        glyphCamera.right = w; glyphCamera.bottom = -h; glyphCamera.updateProjectionMatrix();
        glyphGeometry.setDrawRange(0, w < 600 ? 28 : GLYPH_COUNT);
        mesh.visible = links.visible = w >= 760;
        group.scale.setScalar(Math.min(0.62, w / 1350));
      }
      const elapsed = skipped ? 4 : t - started;
      pointerX += (targetX - pointerX) * Math.min(1, dt * 3.5);
      pointerY += (targetY - pointerY) * Math.min(1, dt * 3.5);
      group.position.set(4, -0.65 - scroll * 0.65, 0);
      group.rotation.set(0.08 + pointerY * 0.09 + scroll * 0.12, -0.12 + pointerX * 0.18 + scroll * 0.45, -0.035);
      let built = 0;
      for (let i = 0; i < count; i++) {
        const q = ease((elapsed - i * 0.022) / 1.15); built += q;
        const angle = random(i, 10) * Math.PI * 2, radius = 3.2 + random(i, 11) * 3.0;
        const spread = scroll * (0.5 + random(i, 12) * 0.6);
        dummy.position.set(
          Math.cos(angle) * radius * (1 - q) + final[i].x * q + final[i].x * spread,
          (random(i, 13) - 0.5) * 6 * (1 - q) + final[i].y * q + Math.sin(t * 0.72 + i) * 0.025 * q + final[i].y * spread,
          (random(i, 14) - 0.5) * 5 * (1 - q) + final[i].z * q,
        );
        dummy.rotation.set((1 - q) * random(i, 15) * 2.5, (1 - q) * random(i, 16) * 3.5, (1 - q) * (random(i, 17) - 0.5) * 2);
        dummy.scale.setScalar((0.35 + q * 0.65) * (1 - scroll * 0.16));
        dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
      material.opacity = 0.96 * (1 - scroll);
      linkMaterial.opacity = 0.15 * built / count * (1 - scroll);
      const pos = glyphGeometry.attributes.position, alpha = glyphGeometry.attributes.alpha;
      for (let i = 0; i < GLYPH_COUNT; i++) {
        const spanX = w + 80, spanY = h + 60;
        const x = ((random(i, 20) * spanX + t * (2 + random(i, 21) * 3)) % spanX) - 40 + Math.sin(t * 0.22 + i) * 14;
        const y = ((random(i, 22) * spanY + Math.sin(t * 0.16 + i * 0.7) * 20 + spanY) % spanY) - 30;
        pos.setXYZ(i, x, -y, 0);
        alpha.setX(i, (0.08 + random(i, 23) * 0.18) * (1 - scroll));
      }
      pos.needsUpdate = true; alpha.needsUpdate = true;
      glyphMaterial.uniforms.dpr.value = renderer.getPixelRatio();
      renderer.render(def.scene, def.camera);
      renderer.clearDepth(); renderer.render(def.glyphScene, glyphCamera);
    },
    dispose() {
      for (const g of [geometry, linkGeometry, glyphGeometry]) if (g) g.dispose();
      for (const m of [material, linkMaterial, glyphMaterial]) if (m) m.dispose();
      if (atlas) atlas.texture.dispose();
    },
  };

  const handle = stage.add(def);
  if (!window.FX || !window.FX.on) return;
  el.classList.add('fx-ledger');
  const skip = () => { skipped = true; };
  const move = (e) => {
    if (e.pointerType === 'touch') return;
    targetX = e.clientX / innerWidth - 0.5; targetY = e.clientY / innerHeight - 0.5;
  };
  const leave = () => { targetX = targetY = 0; };
  add(() => ScrollTrigger.create({
    trigger: el, start: 'top top', end: 'bottom top',
    onUpdate: (self) => { scroll = self.progress; },
    onLeave: () => { scroll = 1; }, onLeaveBack: () => { scroll = 0; },
  }));
  addEventListener('scroll', skip, { passive: true, once: true });
  el.addEventListener('pointerdown', skip, { once: true });
  el.addEventListener('pointermove', move, { passive: true });
  el.addEventListener('pointerleave', leave, { passive: true });
  undo(() => {
    removeEventListener('scroll', skip); el.removeEventListener('pointerdown', skip);
    el.removeEventListener('pointermove', move); el.removeEventListener('pointerleave', leave);
    el.classList.remove('fx-ledger'); handle.remove();
  });
}
