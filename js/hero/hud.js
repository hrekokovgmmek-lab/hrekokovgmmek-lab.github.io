// HUD: квадраты трекинга у точек сетки (видны только рядом с курсором и при движении), подпись координат,
// свой курсор-прицел. Только мышь и только до второго удара.

export function createHud(canvas, S) {
  const g = canvas.getContext('2d');
  let W = 0, H = 0, dpr = 1, drawn = false;
  const signal = () => getComputedStyle(document.documentElement).getPropertyValue('--signal').trim() || '#FF6B3D';
  const ink = () => getComputedStyle(document.documentElement).getPropertyValue('--ink').trim() || '#100F0D';
  let colS = signal(), colI = ink();

  function resize() {
    const r = canvas.getBoundingClientRect();
    W = r.width; H = r.height; dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    colS = signal(); colI = ink();
  }
  resize();
  addEventListener('resize', resize);

  function clear() { if (drawn) { g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, canvas.width, canvas.height); drawn = false; } }

  function draw({ t, P, rise, ptr, points, scanning, beats }) {
    if (!S.fine || P >= beats[1] || !ptr.has) { clear(); return; }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    drawn = true;
    const fade = 1 - Math.min(1, Math.max(0, (rise - 0.75) / 0.25)); // гаснут на последней четверти подъёма
    const move = Math.min(1, ptr.speed * 3 + 0.25);
    g.lineWidth = 1;
    g.font = '500 10px "Geist Mono", ui-monospace, monospace';
    g.textBaseline = 'middle';
    points.forEach((p, i) => {
      const [x0, y0] = p.xy;
      const d = Math.hypot(x0 - ptr.x, y0 - ptr.y);
      const a = Math.max(0, 1 - d / 190) * move * fade;
      if (a < 0.01) return;
      const x = x0 + Math.sin(t * 11 + i) * 0.6, y = y0 + Math.cos(t * 9 + i) * 0.6;
      g.globalAlpha = a;
      g.strokeStyle = colS; g.fillStyle = colS;
      g.strokeRect(Math.round(x - 9) + 0.5, Math.round(y - 9) + 0.5, 18, 18);
      g.beginPath();
      g.moveTo(x - 3, y); g.lineTo(x + 3, y); g.moveTo(x, y - 3); g.lineTo(x, y + 3);
      g.stroke();
      if (!scanning) {
        const label = (p.label ? p.label + '  ' : '') + `${Math.round(x0)},${Math.round(y0)}`;
        g.fillText(label, x + 14, y);
      }
    });
    // свой курсор: кольцо растёт со скоростью, 4 риски
    g.globalAlpha = 1;
    const r = 7 + ptr.speed * 10;
    g.strokeStyle = colI; g.lineWidth = 1.25;
    g.beginPath(); g.arc(ptr.x, ptr.y, r, 0, Math.PI * 2); g.stroke();
    g.beginPath();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      g.moveTo(ptr.x + dx * (r - 2), ptr.y + dy * (r - 2)); g.lineTo(ptr.x + dx * (r + 6), ptr.y + dy * (r + 6));
    }
    g.stroke();
  }

  return { draw, resize, clear };
}
