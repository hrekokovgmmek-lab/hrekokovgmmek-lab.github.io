// Мелкие эффекты: расшифровка имени, размер шапки, подсказка, подпись состояния, появления, «тиканье» моно-подписей.

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const bit = () => (Math.random() < 0.5 ? '0' : '1');

export function initFx(S, addTicker, heroReady) {
  const root = document.documentElement;
  const T = S.cfg.hero.tuning, ND = T.nameDecode;
  const wm = document.querySelector('.wordmark');

  // ---- имя: биты → буквы, без скачка размера (ширина каждой буквы закреплена) ----
  const chars = [];
  if (wm) {
    for (const line of wm.querySelectorAll('.wm-line')) {
      const text = line.textContent; line.textContent = '';
      for (const ch of text) {
        const s = document.createElement('span'); s.className = 'ch'; s.textContent = ch; s.dataset.c = ch;
        line.appendChild(s); chars.push(s);
      }
    }
  }
  const decode = S.motion && !location.hash && chars.length;
  // ширина в em: шапка уменьшается при прокрутке, буквы не должны разъезжаться
  function lockWidths() {
    for (const s of chars) {
      s.style.width = '';
      const w = s.getBoundingClientRect().width, fsz = parseFloat(getComputedStyle(s).fontSize) || 1;
      s.style.width = (w / fsz).toFixed(4) + 'em';
    }
  }
  if (!decode) root.classList.add('named');
  else {
    const fontsReady = document.fonts ? document.fonts.ready : Promise.resolve();
    fontsReady.then(() => {
      lockWidths();
      for (const s of chars) s.textContent = s.dataset.c === ' ' ? ' ' : bit();
      root.classList.add('decoding');
      return Promise.race([heroReady, new Promise((r) => setTimeout(r, ND.fallbackMs))]);
    }).then(() => {
      const t0 = performance.now(); let lastStep = 0;
      const n = chars.length;
      const run = (now) => {
        const el = now - t0;
        if (now - lastStep >= ND.stepMs) {
          lastStep = now;
          const done = clamp01((el - ND.holdMs) / ND.durMs) * n;
          chars.forEach((s, i) => { s.textContent = i < done ? s.dataset.c : (s.dataset.c === ' ' ? ' ' : bit()); });
        }
        if (el < ND.holdMs + ND.durMs + ND.stepMs) requestAnimationFrame(run);
        else {
          chars.forEach((s) => { s.textContent = s.dataset.c; s.style.width = ''; });
          root.classList.add('named'); root.classList.remove('decoding');
        }
      };
      requestAnimationFrame(run);
    });
    addEventListener('resize', () => { if (root.classList.contains('named')) for (const s of chars) s.style.width = ''; else lockWidths(); });
  }

  // ---- вход на сайт: на фоне домен — расшифровывается из 0 и 1, держится и растворяется, пока проявляется портрет ----
  if (root.classList.contains('intro') && S.cfg.domain) {
    const el = document.createElement('div'); el.className = 'intro-domain'; el.setAttribute('aria-hidden', 'true');
    const line = document.createElement('div'); line.className = 'w'; el.appendChild(line);
    const spans = [...String(S.cfg.domain).toLowerCase()].map((ch) => {
      const s = document.createElement('span'); s.dataset.c = ch; s.textContent = ch; line.appendChild(s); return s;
    });
    document.body.appendChild(el);
    // ждём только свой шрифт (он в preload), а не все шрифты страницы: иначе надпись и первый экран появлялись поздно
    const ready = document.fonts ? document.fonts.load('850 100px "Roboto Flex"').catch(() => {}) : Promise.resolve();
    ready.then(() => {
      for (const s of spans) { const w = s.getBoundingClientRect().width, fz = parseFloat(getComputedStyle(s).fontSize) || 1; s.style.width = (w / fz).toFixed(4) + 'em'; }
      spans.forEach((s) => { if (s.dataset.c !== '.') s.textContent = bit(); });
      el.classList.add('on');
      const t0 = performance.now();
      const run = (now) => {
        const k = clamp01((now - t0 - 200) / 800), n = Math.floor(k * spans.length);
        spans.forEach((s, i) => { s.textContent = i < n || s.dataset.c === '.' ? s.dataset.c : bit(); });
        if (k < 1) setTimeout(() => requestAnimationFrame(run), 55); else spans.forEach((s) => { s.textContent = s.dataset.c; });
      };
      requestAnimationFrame(run);
    });
    let fired = false;
    const out = () => { if (fired) return; fired = true; el.classList.add('out'); setTimeout(() => el.remove(), 1600); };
    addEventListener('introstart', () => setTimeout(out, 1100), { once: true });
    setTimeout(out, 3200); // без WebGL — всё равно уходит
    addEventListener('scroll', () => { if (scrollY > 30) out(); }, { passive: true });
  }

  // ---- шапка: большое имя → среднее на первых 15 % героя ----
  const big = () => Math.min(67, Math.max(24, innerWidth * 0.0416));
  let fs = big();
  const hint = document.getElementById('hint');
  const readout = document.getElementById('readout');
  const st = document.getElementById('ro-state');
  const ro = S.cfg.hero.readout;
  let lastState = '';
  addTicker((t, dt) => {
    const b = big(), small = (b + 18) / 2;
    const target = b + (small - b) * clamp01(S.P / 0.15);
    fs += (target - fs) * (1 - Math.pow(0.8, dt * 60));
    if (Math.abs(fs - target) < 0.01) fs = target;
    root.style.setProperty('--wm-fs', fs.toFixed(2) + 'px');
    if (hint) hint.classList.toggle('gone', S.P > 0.03);
    if (readout) readout.classList.toggle('gone', S.P > T.beats[2] + 0.5 * (T.beats[3] - T.beats[2]));
    root.classList.toggle('past-hero', S.P > 0.97);
    root.classList.toggle('cursor-off', S.fine && S.P < 0.35 && !!S.stage);
    if (st) {
      const B = T.beats; const P = S.P;
      const s = P < B[0] ? (S.scanning ? 'scanning' : 'tracking') : P < B[1] ? 'split' : P < B[2] ? 'converting' : P < B[3] ? 'dissolving' : 'offline';
      if (s !== lastState) { st.textContent = ro.states[s] || s; lastState = s; }
    }
  });

  // ---- бегущая лента фото Instagram: едет по кругу, под курсором плавно останавливается, работает только пока видна ----
  for (const mq of document.querySelectorAll('.ig-marquee')) {
    if (!S.motion) break;
    const track = mq.querySelector('.ig-track');
    const loop = parseFloat(getComputedStyle(mq).getPropertyValue('--loop')) || 70;
    let half = 0, x = 0, v = 0, target = 1, vis = false;
    const measure = () => { half = track.scrollWidth / 2; };
    measure(); addEventListener('resize', measure); document.fonts?.ready.then(measure);
    track.querySelectorAll('img').forEach((im) => im.addEventListener('load', measure, { once: true }));
    mq.addEventListener('pointerenter', () => { target = 0; });
    mq.addEventListener('pointerleave', () => { target = 1; });
    if ('IntersectionObserver' in window) new IntersectionObserver((es) => { vis = es[0].isIntersecting; }).observe(mq); else vis = true;
    addTicker((t, dt) => {
      if (!vis || !half) return;
      v += (target - v) * Math.min(1, dt * 4);
      x -= v * (half / loop) * dt;
      if (x <= -half) x += half;
      track.style.transform = `translate3d(${x.toFixed(2)}px,0,0)`;
    });
  }

  // ---- посты X: каждая карточка встаёт в самую короткую колонку (без JS остаются CSS-колонки, на телефоне — лента) ----
  for (const box of document.querySelectorAll('.posts')) {
    const cards = [...box.children];
    const narrow = matchMedia('(max-width: 760px)');
    let raf = 0;
    const layout = () => {
      raf = 0;
      if (narrow.matches) {
        box.classList.remove('masonry'); box.style.height = '';
        cards.forEach((c) => { c.style.left = c.style.top = c.style.width = ''; });
        return;
      }
      const gap = parseFloat(getComputedStyle(box).columnGap) || 18, W = box.clientWidth;
      const n = Math.max(1, Math.floor((W + gap) / (300 + gap))), w = (W - (n - 1) * gap) / n; // 300 — как columns в site.css
      box.classList.add('masonry');
      cards.forEach((c) => { c.style.width = `${w}px`; });
      const hs = new Array(n).fill(0);
      for (const c of cards) {
        const k = hs.indexOf(Math.min(...hs));
        c.style.left = `${k * (w + gap)}px`; c.style.top = `${hs[k]}px`;
        hs[k] += c.offsetHeight + gap;
      }
      box.style.height = `${Math.max(...hs) - gap}px`;
    };
    const later = () => { if (!raf) raf = requestAnimationFrame(layout); };
    layout();
    addEventListener('resize', later);
    narrow.addEventListener?.('change', later);
    if ('ResizeObserver' in window) { const ro = new ResizeObserver(later); cards.forEach((c) => ro.observe(c)); } // язык, шрифты
    document.fonts?.ready.then(later);
    box.querySelectorAll('img').forEach((im) => im.addEventListener('load', later, { once: true }));
  }

  // ---- появления: один раз, только с движением ----
  if (!S.motion || !('IntersectionObserver' in window)) {
    document.querySelectorAll('.rise, .row, .rise-soft').forEach((el) => el.classList.add('in'));
    return;
  }
  const io = (sel, margin, fn) => {
    const o = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { fn(e.target); o.unobserve(e.target); } }),
      { rootMargin: `0px 0px ${margin} 0px` });
    document.querySelectorAll(sel).forEach((el) => o.observe(el));
  };
  io('.rise', '-12%', (el) => el.classList.add('in'));
  io('.rows .row', '-30%', (el) => el.classList.add('in'));
  io('.rise-soft', '-15%', (el) => el.classList.add('in'));
  io('.tick', '-12%', tick);
}

/** «Тиканье»: текст набирается из 0 и 1 слева направо за 600 мс, шаг 50 мс. */
function tick(el) {
  const spans = el.querySelectorAll('[data-l]');
  const targets = spans.length ? [...spans] : [el];
  for (const node of targets) {
    const text = node.textContent; const t0 = performance.now();
    const run = (now) => {
      const k = Math.min(1, (now - t0) / 600), n = Math.floor(k * text.length);
      node.textContent = text.slice(0, n) + text.slice(n).replace(/\S/g, () => (Math.random() < 0.5 ? '0' : '1'));
      if (k < 1) setTimeout(() => requestAnimationFrame(run), 50); else node.textContent = text;
    };
    requestAnimationFrame(run);
  }
}
