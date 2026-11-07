// A quiet field behind About: transaction routes, their nodes and moving packets. No addresses or measured data.
const ROUTES = [
  [[-0.10, 0.24], [0.06, 0.24], [0.14, 0.34], [0.34, 0.34], [0.43, 0.22], [0.61, 0.22], [0.72, 0.12], [1.10, 0.12]],
  [[-0.08, 0.78], [0.12, 0.78], [0.22, 0.66], [0.44, 0.66], [0.54, 0.76], [0.77, 0.76], [0.88, 0.88], [1.08, 0.88]],
  [[0.12, -0.08], [0.12, 0.16], [0.23, 0.27], [0.23, 0.52], [0.34, 0.63], [0.34, 1.08]],
  [[0.90, -0.10], [0.90, 0.14], [0.80, 0.24], [0.80, 0.49], [0.69, 0.60], [0.69, 1.08]],
  [[-0.10, 0.52], [0.05, 0.52], [0.15, 0.42], [0.28, 0.42], [0.40, 0.54], [0.62, 0.54], [0.73, 0.43], [1.10, 0.43]],
  [[-0.10, 0.94], [0.16, 0.94], [0.27, 0.84], [0.48, 0.84], [0.60, 0.95], [1.10, 0.95]],
  [[0.42, -0.10], [0.42, 0.10], [0.53, 0.20], [0.53, 0.36], [0.64, 0.46], [0.64, 0.66], [0.55, 0.75], [0.55, 1.10]],
];
const PACKETS = 18, CROSSES = 96;
const random = (i, salt = 0) => {
  const n = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453123;
  return n - Math.floor(n);
};

function pointMaterial(THREE, renderer, tint, ring) {
  return new THREE.ShaderMaterial({
    uniforms: { dpr: { value: renderer.getPixelRatio() }, tint: { value: tint }, ring: { value: ring } },
    vertexShader: 'attribute float size; attribute float alpha; uniform float dpr; varying float vAlpha;'
      + 'void main(){vAlpha=alpha;gl_PointSize=size*dpr;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: 'uniform vec3 tint; uniform float ring; varying float vAlpha;'
      + 'void main(){float d=length(gl_PointCoord-0.5)*2.0;float dot=1.0-smoothstep(0.55,1.0,d);'
      + 'float rim=1.0-smoothstep(0.08,0.2,abs(d-0.67));float a=mix(dot,rim,ring)*vAlpha;'
      + 'if(a<0.008)discard;gl_FragColor=vec4(tint,a);}',
    transparent: true, depthTest: false, depthWrite: false,
  });
}

export function mount({ el, stage, ScrollTrigger, add, undo }) {
  let width = 0, height = 0, scroll = 0, routeCount = ROUTES.length;
  let targetX = 0, targetY = 0, pointerX = 0, pointerY = 0;
  let group, camera, paths = [];
  const geometries = [], materials = [];
  let edgeGeometry, crossGeometry, nodeGeometry, packetGeometry, nodeMaterial, packetMaterial;

  const def = {
    el, full: true,
    setup({ THREE, renderer, color }) {
      const scene = new THREE.Scene();
      camera = new THREE.OrthographicCamera(0, 1, 0, -1, -10, 10); camera.position.z = 1;
      group = new THREE.Group(); scene.add(group);
      const grey = color('--grey', '#6f6b62'), brick = color('--brick', '#a84b36');

      const edges = [], nodes = [], nodeSizes = [], nodeAlpha = [];
      for (const route of ROUTES) {
        for (let i = 1; i < route.length; i++) edges.push(...route[i - 1], 0, ...route[i], 0);
        for (const point of route) {
          nodes.push(...point, 0); nodeSizes.push(7 + random(nodes.length, 2) * 3);
          nodeAlpha.push(0.15 + random(nodes.length, 3) * 0.10);
        }
      }
      edgeGeometry = new THREE.BufferGeometry();
      edgeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(edges, 3).setUsage(THREE.DynamicDrawUsage));
      geometries.push(edgeGeometry);
      const edgeMaterial = new THREE.LineBasicMaterial({ color: grey, transparent: true, opacity: 0.13, depthTest: false, depthWrite: false });
      materials.push(edgeMaterial); group.add(new THREE.LineSegments(edgeGeometry, edgeMaterial));

      crossGeometry = new THREE.BufferGeometry();
      crossGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(CROSSES * 12), 3));
      geometries.push(crossGeometry);
      const crossMaterial = new THREE.LineBasicMaterial({ color: grey, transparent: true, opacity: 0.12, depthTest: false, depthWrite: false });
      materials.push(crossMaterial); group.add(new THREE.LineSegments(crossGeometry, crossMaterial));

      nodeGeometry = new THREE.BufferGeometry();
      nodeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(nodes, 3).setUsage(THREE.DynamicDrawUsage));
      nodeGeometry.setAttribute('size', new THREE.Float32BufferAttribute(nodeSizes, 1));
      nodeGeometry.setAttribute('alpha', new THREE.Float32BufferAttribute(nodeAlpha, 1));
      nodeMaterial = pointMaterial(THREE, renderer, grey, 1);
      geometries.push(nodeGeometry); materials.push(nodeMaterial);
      const nodePoints = new THREE.Points(nodeGeometry, nodeMaterial); nodePoints.frustumCulled = false; group.add(nodePoints);

      packetGeometry = new THREE.BufferGeometry();
      packetGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(PACKETS * 3), 3).setUsage(THREE.DynamicDrawUsage));
      packetGeometry.setAttribute('size', new THREE.Float32BufferAttribute(Array.from({ length: PACKETS }, (_, i) => 3.5 + random(i, 7) * 1.5), 1));
      packetGeometry.setAttribute('alpha', new THREE.BufferAttribute(new Float32Array(PACKETS), 1).setUsage(THREE.DynamicDrawUsage));
      packetMaterial = pointMaterial(THREE, renderer, brick, 0);
      geometries.push(packetGeometry); materials.push(packetMaterial);
      const packetPoints = new THREE.Points(packetGeometry, packetMaterial); packetPoints.frustumCulled = false; group.add(packetPoints);
      def.scene = scene; def.camera = camera;
    },
    frame(t, dt, w, h, renderer) {
      if (w !== width || h !== height) {
        width = w; height = h;
        camera.right = w; camera.bottom = -h; camera.updateProjectionMatrix();
        routeCount = w < 600 ? 4 : ROUTES.length;
        paths = ROUTES.slice(0, routeCount).map((route) => {
          const points = route.map(([x, y]) => ({ x: x * w, y: -y * h }));
          const lengths = points.slice(1).map((p, i) => Math.hypot(p.x - points[i].x, p.y - points[i].y));
          return { points, lengths, total: lengths.reduce((a, b) => a + b, 0) };
        });
        const ep = edgeGeometry.attributes.position, np = nodeGeometry.attributes.position;
        let edgeCount = 0, nodeCount = 0;
        for (const path of paths) {
          for (let i = 1; i < path.points.length; i++) {
            const a = path.points[i - 1], b = path.points[i];
            ep.setXYZ(edgeCount++, a.x, a.y, 0); ep.setXYZ(edgeCount++, b.x, b.y, 0);
          }
          for (const p of path.points) np.setXYZ(nodeCount++, p.x, p.y, 0);
        }
        ep.needsUpdate = true; np.needsUpdate = true;
        edgeGeometry.setDrawRange(0, edgeCount); nodeGeometry.setDrawRange(0, nodeCount);
        packetGeometry.setDrawRange(0, w < 600 ? 10 : PACKETS);
        const cp = crossGeometry.attributes.position, step = Math.max(90, Math.sqrt(w * h / 72));
        let n = 0;
        for (let y = step / 2; y < h && n < CROSSES; y += step) for (let x = step / 2; x < w && n < CROSSES; x += step) {
          cp.setXYZ(n * 4, x - 3, -y, 0); cp.setXYZ(n * 4 + 1, x + 3, -y, 0);
          cp.setXYZ(n * 4 + 2, x, -y - 3, 0); cp.setXYZ(n * 4 + 3, x, -y + 3, 0); n++;
        }
        cp.needsUpdate = true; crossGeometry.setDrawRange(0, n * 4);
      }
      const k = Math.min(1, dt * 2.5);
      pointerX += (targetX - pointerX) * k; pointerY += (targetY - pointerY) * k;
      group.position.set(pointerX, pointerY - scroll * 32, 0);
      const pos = packetGeometry.attributes.position, alpha = packetGeometry.attributes.alpha;
      for (let i = 0; i < packetGeometry.drawRange.count; i++) {
        const path = paths[i % paths.length], u = (random(i, 10) + t * (0.012 + random(i, 11) * 0.014)) % 1;
        let distance = u * path.total, segment = 0;
        while (segment < path.lengths.length - 1 && distance > path.lengths[segment]) distance -= path.lengths[segment++];
        const a = path.points[segment], b = path.points[segment + 1], q = distance / path.lengths[segment];
        pos.setXYZ(i, a.x + (b.x - a.x) * q, a.y + (b.y - a.y) * q, 0);
        alpha.setX(i, 0.42 * Math.min(1, u * 8, (1 - u) * 8));
      }
      pos.needsUpdate = true; alpha.needsUpdate = true;
      nodeMaterial.uniforms.dpr.value = renderer.getPixelRatio(); packetMaterial.uniforms.dpr.value = renderer.getPixelRatio();
      renderer.render(def.scene, camera);
    },
    dispose() {
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
    },
  };

  const handle = stage.add(def);
  if (!window.FX || !window.FX.on) return;
  el.classList.add('fx-flow');
  const move = (e) => {
    if (e.pointerType === 'touch') return;
    targetX = (e.clientX / innerWidth - 0.5) * 12; targetY = (e.clientY / innerHeight - 0.5) * 8;
  };
  const leave = () => { targetX = targetY = 0; };
  add(() => ScrollTrigger.create({
    trigger: el, start: 'top top', end: 'bottom bottom',
    onUpdate: (self) => { scroll = self.progress; },
  }));
  addEventListener('pointermove', move, { passive: true });
  document.documentElement.addEventListener('pointerleave', leave, { passive: true });
  undo(() => {
    removeEventListener('pointermove', move); document.documentElement.removeEventListener('pointerleave', leave);
    el.classList.remove('fx-flow'); handle.remove();
  });
}
