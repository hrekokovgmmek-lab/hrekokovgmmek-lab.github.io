const TAU = Math.PI * 2;
const KINDS = ['telegram', 'stories', 'coin', 'github', 'x', 'case', 'market', 'bot', 'method', 'code', 'work'];
const clamp = (v) => Math.min(1, Math.max(0, v));
const ease = (v) => 1 - Math.pow(1 - clamp(v), 4);

function build(THREE, kind, color) {
  const scene = new THREE.Scene();
  const root = new THREE.Group(), model = new THREE.Group(), orbit = new THREE.Group();
  root.add(model, orbit); scene.add(root);
  const paper = color('--paper', '#f4f2ec'), ink = color('--ink', '#1f1f1f');
  const brick = color('--brick', '#a84b36'), grey = color('--grey', '#6f6b62'), rule = color('--rule', '#dedad1');
  const M = {
    paper: new THREE.MeshStandardMaterial({ color: paper, roughness: 0.3, metalness: 0.12, side: THREE.DoubleSide }),
    ink: new THREE.MeshStandardMaterial({ color: ink, roughness: 0.3, metalness: 0.58, side: THREE.DoubleSide }),
    brick: new THREE.MeshStandardMaterial({ color: brick, emissive: brick, emissiveIntensity: 0.025, roughness: 0.32, metalness: 0.28, side: THREE.DoubleSide }),
    grey: new THREE.MeshStandardMaterial({ color: grey, roughness: 0.48, metalness: 0.38, side: THREE.DoubleSide }),
    pale: new THREE.MeshStandardMaterial({ color: rule, roughness: 0.52, metalness: 0.1, side: THREE.DoubleSide }),
    ghost: new THREE.MeshBasicMaterial({ color: grey, transparent: true, opacity: 0.26, depthWrite: false }),
  };
  const add = (geometry, material, parent = model, pos = [0, 0, 0], rot = [0, 0, 0]) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...pos); mesh.rotation.set(...rot); parent.add(mesh); return mesh;
  };
  const box = (w, h, d, material, pos, rot, parent) => add(new THREE.BoxGeometry(w, h, d), material, parent, pos, rot);
  const sphere = (r, material, pos, parent) => add(new THREE.SphereGeometry(r, 24, 16), material, parent, pos);
  const torus = (r, tube, material, pos, rot, parent, arc = TAU) => add(new THREE.TorusGeometry(r, tube, 12, 72, arc), material, parent, pos, rot);
  const link = (a, b, radius, material, parent = model) => {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), delta = B.clone().sub(A);
    const mesh = add(new THREE.CylinderGeometry(radius, radius, delta.length(), 12), material, parent);
    mesh.position.copy(A.add(B).multiplyScalar(0.5));
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
    return mesh;
  };
  const edges = (w, h, d, pos, parent = model) => {
    const geometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d));
    const line = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: grey, transparent: true, opacity: 0.28 }));
    line.position.set(...pos); parent.add(line);
  };
  let core = null;

  if (kind === 'telegram') {
    const nose = [1.5, 0.48, 0], tail = [-1.25, 0.85, 0], back = [-0.55, -0.98, 0], fold = [-0.18, -0.15, 0.38];
    for (const [points, material] of [
      [[nose, tail, fold], M.paper], [[nose, fold, back], M.brick], [[tail, [-0.52, 0.05, -0.06], back], M.ink],
    ]) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(points.flat(), 3)); g.computeVertexNormals(); add(g, material);
    }
    link([-1.5, -0.75, -0.15], [-0.7, -0.58, -0.05], 0.018, M.brick);
    link([-1.65, -0.95, -0.15], [-0.85, -0.78, -0.05], 0.012, M.grey);
  } else if (kind === 'stories') {
    for (let i = 0; i < 3; i++) {
      const panel = new THREE.Group(); model.add(panel);
      panel.position.set((i - 1) * 0.55, (i - 1) * 0.08, (i - 1) * 0.28); panel.rotation.y = (i - 1) * 0.25;
      box(1.0, 1.48, 0.12, i === 1 ? M.brick : M.paper, [0, 0, 0], [0, 0, 0], panel);
      box(0.66, 0.035, 0.02, M.ink, [0, 0.42, 0.075], [0, 0, 0], panel);
      box(0.46, 0.025, 0.02, M.grey, [-0.1, 0.3, 0.075], [0, 0, 0], panel);
      sphere(0.12, i === 1 ? M.paper : M.brick, [0, -0.28, 0.09], panel);
      edges(1.0, 1.48, 0.12, [0, 0, 0], panel);
    }
  } else if (kind === 'coin') {
    add(new THREE.CylinderGeometry(1, 1, 0.24, 64), M.paper, model, [0, 0, 0], [Math.PI / 2, 0, 0]);
    torus(0.82, 0.075, M.brick, [0, 0, 0.15]); torus(0.82, 0.075, M.brick, [0, 0, -0.15]);
    torus(0.61, 0.018, M.ink, [0, 0, 0.145]);
    core = add(new THREE.OctahedronGeometry(0.46, 0), M.ink, model, [0, 0, 0]);
    torus(1.2, 0.018, M.grey, [0, 0, 0], [0.55, 0.15, 0], orbit);
    sphere(0.08, M.brick, [1.12, 0.42, 0], orbit);
  } else if (kind === 'github') {
    const nodes = [[-0.8, 0.72, 0], [0, 0.05, 0], [0.8, -0.72, 0], [0.78, 0.7, 0.28]];
    for (const [a, b] of [[0, 1], [1, 2], [1, 3]]) link(nodes[a], nodes[b], 0.055, M.grey);
    nodes.forEach((p, i) => { sphere(i === 1 ? 0.28 : 0.22, i === 2 ? M.brick : i === 1 ? M.ink : M.paper, p); torus(0.31, 0.018, M.brick, p, [0, 0, 0]); });
    edges(2.25, 2.05, 0.7, [0, 0, -0.18]);
  } else if (kind === 'x') {
    box(0.43, 2.35, 0.46, M.ink, [0, 0, 0], [0.15, 0.2, Math.PI / 4]);
    box(0.43, 2.35, 0.46, M.brick, [0, 0, 0], [-0.15, -0.2, -Math.PI / 4]);
    for (const s of [-1, 1]) for (const t of [-1, 1]) sphere(0.09, M.paper, [s * 0.78, t * 0.78, 0.28]);
    torus(1.32, 0.012, M.grey, [0, 0, -0.3], [0.4, 0.3, 0], orbit);
  } else if (kind === 'case') {
    torus(0.77, 0.13, M.ink, [-0.22, 0.27, 0.1]);
    const lens = new THREE.MeshStandardMaterial({ color: brick, transparent: true, opacity: 0.19, roughness: 0.12, metalness: 0.22, depthWrite: false });
    add(new THREE.CylinderGeometry(0.69, 0.69, 0.06, 64), lens, model, [-0.22, 0.27, 0.08], [Math.PI / 2, 0, 0]);
    link([0.24, -0.26, 0.06], [0.95, -1.02, 0.06], 0.14, M.brick);
    const pts = [[-0.6, 0.48, 0.18], [-0.1, 0.04, 0.18], [0.22, 0.5, 0.18]];
    link(pts[0], pts[1], 0.022, M.brick); link(pts[1], pts[2], 0.022, M.brick);
    pts.forEach((p) => sphere(0.085, M.paper, p));
  } else if (kind === 'market') {
    const heights = [0.6, 1.05, 1.5, 1.12, 1.85], tops = [];
    heights.forEach((h, i) => {
      const x = (i - 2) * 0.43, y = h / 2 - 0.85;
      box(0.28, h, 0.38, i === 4 ? M.brick : i % 2 ? M.ink : M.paper, [x, y, 0]);
      link([x, y - h / 2 - 0.18, 0], [x, y + h / 2 + 0.18, 0], 0.025, M.grey);
      tops.push([x, h - 0.55, 0.24]); sphere(0.065, M.brick, tops[i]);
      if (i) link(tops[i - 1], tops[i], 0.025, M.brick);
    });
    box(2.15, 0.06, 0.75, M.pale, [0, -1.08, 0]);
  } else if (kind === 'bot') {
    box(1.38, 1.38, 1.38, M.ink, [0, 0, 0], [0.12, 0.2, 0]);
    core = add(new THREE.OctahedronGeometry(0.61, 1), M.brick);
    edges(1.52, 1.52, 1.52, [0, 0, 0]);
    torus(1.3, 0.022, M.paper, [0, 0, 0], [0.7, 0.1, 0], orbit);
    torus(1.14, 0.022, M.brick, [0, 0, 0], [-0.25, 0.7, 0], orbit);
    sphere(0.12, M.paper, [1.05, 0.55, 0], orbit); sphere(0.1, M.brick, [-0.8, -0.75, 0], orbit);
  } else if (kind === 'method') {
    for (let i = 0; i < 4; i++) {
      const x = i % 2 ? 0.12 : -0.12, y = (i - 1.5) * 0.43;
      box(1.85, 0.2, 1.22, i === 2 ? M.brick : i === 3 ? M.ink : M.paper, [x, y, 0], [0, (i - 1.5) * 0.08, 0]);
      box(0.48, 0.055, 0.025, i === 3 ? M.paper : M.ink, [x - 0.48, y, 0.625]);
    }
    link([-0.72, -0.85, 0.48], [-0.72, 0.95, 0.48], 0.028, M.grey);
    sphere(0.1, M.brick, [-0.72, 1.0, 0.48]);
  } else if (kind === 'code') {
    box(1.85, 1.3, 0.56, M.paper, [0, 0, 0]);
    box(1.48, 0.83, 0.04, M.ink, [0, 0.08, 0.3]);
    for (let i = 0; i < 3; i++) {
      box(0.82 - i * 0.16, 0.045, 0.025, i === 1 ? M.brick : M.pale, [-0.18, 0.32 - i * 0.23, 0.34]);
      sphere(0.06, M.brick, [0.53, 0.32 - i * 0.23, 0.36]);
    }
    box(0.72, 0.12, 0.65, M.grey, [0, -0.78, 0]);
    torus(0.31, 0.04, M.brick, [0.82, -0.42, 0], [Math.PI / 2, 0, 0], model, Math.PI * 1.5);
    edges(1.85, 1.3, 0.56, [0, 0, 0]);
  } else {
    box(1.95, 1.28, 0.2, M.paper, [0, -0.1, 0]);
    link([-0.87, 0.43, 0.14], [0, -0.2, 0.28], 0.035, M.brick);
    link([0.87, 0.43, 0.14], [0, -0.2, 0.28], 0.035, M.brick);
    link([-0.87, -0.62, 0.14], [-0.18, 0.02, 0.22], 0.022, M.grey);
    link([0.87, -0.62, 0.14], [0.18, 0.02, 0.22], 0.022, M.grey);
    sphere(0.13, M.brick, [0, 0.95, 0]);
    torus(0.4, 0.025, M.grey, [0, 0.87, 0], [0, 0, 0], model, Math.PI);
    torus(0.68, 0.018, M.brick, [0, 0.87, 0], [0, 0, 0], model, Math.PI);
  }

  torus(1.55, 0.009, M.ghost, [0, 0, -0.3], [0.62, 0.2, 0], orbit);
  const particles = new THREE.InstancedMesh(new THREE.TetrahedronGeometry(0.065), M.brick, 12);
  particles.frustumCulled = false; orbit.add(particles);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(1.18, 48), new THREE.MeshBasicMaterial({ color: ink, transparent: true, opacity: 0.065, depthWrite: false }));
  shadow.position.set(0, -1.35, -0.25); shadow.rotation.x = -Math.PI / 2; scene.add(shadow);
  scene.add(new THREE.HemisphereLight(paper, ink, 2.3));
  const key = new THREE.DirectionalLight(paper, 3.2); key.position.set(-3, 5, 6); scene.add(key);
  const rim = new THREE.DirectionalLight(brick, 1.8); rim.position.set(4, 1, -3); scene.add(rim);
  const fill = new THREE.DirectionalLight(rule, 1.1); fill.position.set(-4, -1, 3); scene.add(fill);
  return { scene, root, model, orbit, core, particles, materials: M, shadow };
}

export function mount({ el, stage, undo }) {
  const kind = el.dataset.object;
  if (!KINDS.includes(kind)) return;
  const host = el.closest('a,button') || el, phase = KINDS.indexOf(kind) * 0.73;
  let world, camera, started = 0, width = 0, height = 0, spin = 0, hover = 0, targetHover = 0, pulse = 0;
  let px = 0, py = 0, targetX = 0, targetY = 0;
  const dummy = { current: null };
  const def = {
    el,
    setup({ THREE, color }) {
      world = build(THREE, kind, color);
      camera = new THREE.OrthographicCamera(-3, 3, 2.4, -2.4, 0.1, 60);
      camera.position.set(4.4, 3.0, 7.4); camera.lookAt(0, 0, 0);
      dummy.current = new THREE.Object3D();
      def.scene = world.scene; def.camera = camera;
    },
    frame(t, dt, w, h, renderer) {
      if (!started) started = t;
      if (width !== w || height !== h) {
        width = w; height = h;
        const aspect = width / height, view = width < 220 ? 2.65 : 2.35;
        camera.left = -view * aspect; camera.right = view * aspect; camera.top = view; camera.bottom = -view;
        camera.updateProjectionMatrix();
      }
      const k = Math.min(1, dt * 6), q = ease((t - started) / 0.9);
      hover += (targetHover - hover) * k;
      px += (targetX - px) * k; py += (targetY - py) * k;
      pulse *= Math.exp(-dt * 4.5); spin += dt * (0.18 + hover * 0.65);
      world.root.scale.setScalar(q * (1 + hover * 0.11 + pulse * 0.08));
      world.root.position.y = Math.sin(t * 1.05 + phase) * 0.075 + hover * 0.16;
      world.root.rotation.set(-0.06 + py * 0.18, -0.24 + spin + px * 0.32, Math.sin(t * 0.7 + phase) * 0.025);
      world.orbit.rotation.set(Math.sin(t * 0.31 + phase) * 0.12, t * 0.24, t * 0.09);
      world.materials.brick.emissiveIntensity = 0.025 + hover * 0.24 + pulse * 0.25;
      if (world.core) { world.core.rotation.y = t * 0.48; world.core.rotation.z = t * 0.21; }
      for (let i = 0; i < 12; i++) {
        const a = i / 12 * TAU + t * (0.1 + (i % 3) * 0.025), r = 1.55 + (i % 4) * 0.11;
        dummy.current.position.set(Math.cos(a) * r, Math.sin(a * 1.7 + phase) * 0.88, Math.sin(a) * 0.62);
        dummy.current.rotation.set(a, a * 1.3, a * 0.7);
        dummy.current.scale.setScalar(q * (0.65 + hover * 0.6 + (i % 3) * 0.18));
        dummy.current.updateMatrix(); world.particles.setMatrixAt(i, dummy.current.matrix);
      }
      world.particles.instanceMatrix.needsUpdate = true;
      world.shadow.scale.setScalar(1 + hover * 0.15);
      renderer.render(world.scene, camera);
    },
    dispose() {
      if (!world) return;
      const geometries = new Set(), materials = new Set();
      world.scene.traverse((o) => {
        if (o.geometry) geometries.add(o.geometry);
        if (o.material) for (const m of Array.isArray(o.material) ? o.material : [o.material]) materials.add(m);
      });
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
    },
  };
  const handle = stage.add(def);
  if (!window.FX || !window.FX.on || !world) return;
  el.classList.add('fx-object-ready');
  const enter = () => { targetHover = 1; };
  const leave = () => {
    targetHover = 0; targetX = targetY = 0;
    host.style.setProperty('--mx', '50%'); host.style.setProperty('--my', '40%');
  };
  const move = (e) => {
    if (e.pointerType === 'touch') return;
    const r = host.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    targetX = x - 0.5; targetY = y - 0.5;
    host.style.setProperty('--mx', `${x * 100}%`); host.style.setProperty('--my', `${y * 100}%`);
  };
  const down = () => { pulse = 1; };
  host.addEventListener('pointerenter', enter); host.addEventListener('pointerleave', leave);
  host.addEventListener('pointermove', move, { passive: true }); host.addEventListener('pointerdown', down, { passive: true });
  host.addEventListener('focus', enter); host.addEventListener('blur', leave);
  undo(() => {
    host.removeEventListener('pointerenter', enter); host.removeEventListener('pointerleave', leave);
    host.removeEventListener('pointermove', move); host.removeEventListener('pointerdown', down);
    host.removeEventListener('focus', enter); host.removeEventListener('blur', leave);
    el.classList.remove('fx-object-ready'); handle.remove();
  });
}
