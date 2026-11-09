// Глава «Багбаунти»: живой код. Слева без конца бежит программа Solana (вымышленный пример хранилища, не чужой код
// и не настоящая находка), «читающая» полоса идёт по строкам; на подозрительной строке краснеет и останавливается,
// справа в терминале песочницы сам набирается запуск теста — «воспроизведено». На узком рисунке (телефон) — только код.
// Без движения и без JS остаётся статичная картинка. ?still — один неподвижный кадр (так снята статичная картинка).

const CODE = `use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

declare_id!("Vau1t11111111111111111111111111111111111111");

#[program]
pub mod vault {
    use super::*;

    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        require!(amount > 0, VaultError::ZeroAmount);
        let vault = &mut ctx.accounts.vault;
        let shares = amount * vault.supply / vault.total;
        vault.total = vault.total.checked_add(amount).ok_or(VaultError::Overflow)?;
        vault.supply += shares;
        token::transfer(ctx.accounts.pull(), amount)?;
        emit!(Deposited { user: ctx.accounts.user.key(), amount, shares });
        Ok(())
    }

    pub fn withdraw(ctx: Context<Withdraw>, shares: u64) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        require!(shares <= ctx.accounts.position.shares, VaultError::TooMuch);
        let amount = shares * vault.total / vault.supply;
        vault.total -= amount;
        vault.supply -= shares;
        token::transfer(ctx.accounts.push().with_signer(&[&vault.seeds()]), amount)?;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut, seeds = [b"vault", vault.mint.as_ref()], bump = vault.bump)]
    pub vault: Account<'info, Vault>,
    #[account(mut, has_one = owner)]
    pub position: Account<'info, Position>,
    pub owner: Signer<'info>,
    /// CHECK: where the tokens go
    #[account(mut)]
    pub destination: UncheckedAccount<'info>,
    pub token_program: Program<'info, Token>,
}

#[account]
pub struct Vault { pub mint: Pubkey, pub total: u64, pub supply: u64, pub bump: u8 }

`.split('\n'); // две пустые строки — зазор, когда код идёт по кругу

// строки, на которых полоса краснеет, и тест, который это проверяет
const FLAGS = {
  12: { note: 'rounding: first depositor', test: 'poc::share_inflation' },
  23: { note: 'unchecked math', test: 'poc::withdraw_rounding' },
  40: { note: 'any account accepted', test: 'poc::unchecked_destination' },
};

const KW = new Set(['use', 'pub', 'fn', 'let', 'mut', 'mod', 'struct', 'impl', 'super', 'self', 'as', 'if', 'else', 'return', 'match', 'for', 'in', 'crate']);
const COL = {
  text: '#cfc8bb', kw: '#EE8A3C', type: '#F2B84B', mac: '#D9573B', str: '#B8A07A', num: '#E07B5A', com: '#6d675d',
  attr: '#9a7fb5', gutter: '#4a453c', soft: 'rgba(143,138,127,.9)', ink: '#100F0D', grid: '#181714', panel: '#14130f',
  edge: 'rgba(255,138,61,.16)', sig: '#FF6B3D', ok: '#F2B84B', paper: '#F3EFE6',
};

function tokens(line) {
  const out = [];
  const re = /(\/\/.*$)|("(?:[^"\\]|\\.)*"|b"(?:[^"\\]|\\.)*")|(#\[[^\]]*\])|([A-Za-z_][A-Za-z0-9_]*!?)|(\d[\d_]*)|(\s+)|(.)/g;
  let m, col = 0;
  while ((m = re.exec(line))) {
    const t = m[0];
    let c = COL.text;
    if (m[1]) c = COL.com; else if (m[2]) c = COL.str; else if (m[3]) c = COL.attr;
    else if (m[4]) c = t.endsWith('!') ? COL.mac : KW.has(t) ? COL.kw : /^[A-Z]/.test(t) ? COL.type : COL.text;
    else if (m[5]) c = COL.num;
    if (!m[6]) out.push([col, t, c]);
    col += t.length;
  }
  return out;
}
const TOK = CODE.map(tokens);

export function initStoryCode(S, addTicker) {
  const frames = [...document.querySelectorAll('.frame[data-code]')];
  const still = new URLSearchParams(location.search).has('still');
  if (!frames.length || (!S.motion && !still)) return;
  const lang = () => document.documentElement.dataset.lang || 'en';
  const L = (o) => (o && (o[lang()] || o.en)) || '';
  const items = [];
  const io = 'IntersectionObserver' in window
    ? new IntersectionObserver((es) => es.forEach((e) => { const it = items.find((x) => x.el === e.target); if (it) it.vis = e.isIntersecting; }),
      { rootMargin: '120px' })
    : null;
  for (const el of frames) {
    const cv = document.createElement('canvas');
    cv.className = 'art-cv'; cv.setAttribute('aria-hidden', 'true');
    el.insertBefore(cv, el.querySelector('.curtain'));
    let cfg = {};
    try { cfg = JSON.parse(el.dataset.codeCfg || '{}'); } catch { /* без подписей */ }
    const it = { el, cv, g: cv.getContext('2d'), cfg, vis: !io, off: 0, hold: 0, lastK: -1, flag: null, term: null };
    items.push(it);
    io?.observe(el);
    if (still) {
      it.vis = true;
      const draw0 = () => { stillState(it); draw(it, 1.2); };
      document.fonts?.ready.then(draw0); draw0();
    }
  }


  function size(it) {
    const r = it.el.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
    if (w !== it.cv.width || h !== it.cv.height) { it.cv.width = w; it.cv.height = h; }
    it.w = w; it.h = h; it.cssW = r.width;
  }

  // раскладка в условных 1280×720; на узком рисунке код крупнее и без терминала
  function layout(it) {
    const compact = it.cssW < 560;
    return compact
      ? { compact, ed: [36, 36, 1208, 648], fs: 30, lh: 44, gut: 74 }
      : { compact, ed: [56, 64, 704, 592], fs: 15, lh: 22, gut: 44, tm: [800, 150, 424, 420], tfs: 16, tlh: 26 };
  }

  function termLines(it) {
    const f = it.flag;
    return [
      ['cmd', '$ cargo test-sbf -- ' + f.test.split('::')[0]],
      ['out', '   Compiling vault v0.1.0'],
      ['out', '    Finished test profile in 2.41s'],
      ['out', 'running 1 test'],
      ['out', `test ${f.test} ... ok`],
      ['ok', '✓ ' + L(it.cfg.done)],
    ];
  }

  function stillState(it) {
    const lo = layout(it);
    const [, ey, , eh] = lo.ed, top = ey + 44, head = top + (eh - 60) * 0.42;
    const k = 40;
    it.off = k * lo.lh + lo.lh / 2 - (head - top);
    it.flag = FLAGS[k]; it.hold = 1; it.lastK = k;
    it.term = { lines: termLines(it), shown: 99, typed: 999, t: 0 };
  }

  function rr(g, x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }

  function draw(it, t) {
    size(it);
    const { g, w } = it, s = w / 1280, lo = layout(it);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = COL.ink; g.fillRect(0, 0, it.w, it.h);
    g.setTransform(s, 0, 0, s, 0, 0);
    g.strokeStyle = COL.grid; g.lineWidth = 1 / s;
    g.beginPath();
    for (let x = 0; x <= 1280; x += 28) { g.moveTo(x, 0); g.lineTo(x, 720); }
    for (let y = 0; y <= 720; y += 28) { g.moveTo(0, y); g.lineTo(1280, y); }
    g.stroke();

    // ---- редактор ----
    const [ex, ey, ew, eh] = lo.ed, fs = lo.fs, lh = lo.lh, top = ey + 44, bot = ey + eh - 16;
    rr(g, ex, ey, ew, eh, 12); g.fillStyle = COL.panel; g.fill(); g.strokeStyle = COL.edge; g.lineWidth = 1.2; g.stroke();
    [0, 1, 2].forEach((i) => { g.fillStyle = '#3a352d'; g.beginPath(); g.arc(ex + 22 + i * 18, ey + 21, lo.compact ? 7 : 5, 0, Math.PI * 2); g.fill(); });
    g.font = `500 ${lo.compact ? 22 : 13}px "Geist Mono", ui-monospace, monospace`;
    g.fillStyle = COL.soft; g.textBaseline = 'middle';
    g.fillText('programs/vault/src/lib.rs', ex + (lo.compact ? 92 : 80), ey + 22);

    g.save();
    g.beginPath(); g.rect(ex + 1, top - 6, ew - 2, bot - top + 6); g.clip();
    g.font = `500 ${fs}px "Geist Mono", ui-monospace, monospace`;
    const cw = g.measureText('M').width, N = CODE.length;
    const head = top + (eh - 60) * 0.42;
    const kHead = Math.floor((head - top + it.off) / lh);
    const flagged = it.hold > 0 && it.flag;
    // полоса чтения
    g.fillStyle = flagged ? 'rgba(255,107,61,.20)' : 'rgba(255,138,61,.07)';
    g.fillRect(ex + 1, top + kHead * lh - it.off, ew - 2, lh);
    if (flagged) { g.fillStyle = COL.sig; g.fillRect(ex + 1, top + kHead * lh - it.off, 3, lh); }
    const k0 = Math.floor(it.off / lh) - 1, k1 = k0 + Math.ceil((bot - top) / lh) + 3;
    for (let k = k0; k <= k1; k++) {
      const i = ((k % N) + N) % N, y = top + k * lh - it.off + lh / 2;
      g.textAlign = 'right'; g.fillStyle = flagged && k === kHead ? COL.sig : COL.gutter;
      g.fillText(flagged && k === kHead ? '!' : String(i + 1), ex + lo.gut, y);
      g.textAlign = 'left';
      for (const [c, txt, col] of TOK[i]) { g.fillStyle = col; g.fillText(txt, ex + lo.gut + 16 + c * cw, y); }
      if (flagged && k === kHead) {
        // пометка на тёмной плашке у правого края: длинную строку она закрывает, а не налезает на неё
        const note = '← ' + it.flag.note, nw = g.measureText(note).width;
        const nx = Math.min(ex + lo.gut + 16 + CODE[i].length * cw + cw * 2, ex + ew - nw - 22);
        rr(g, nx - 9, y - lh / 2 + 2, nw + 18, lh - 4, 5);
        g.fillStyle = '#2a150e'; g.fill(); g.strokeStyle = 'rgba(255,107,61,.6)'; g.lineWidth = 1; g.stroke();
        g.fillStyle = COL.sig; g.fillText(note, nx, y);
      }
    }
    g.restore();
    // мягкие края потока
    let gr = g.createLinearGradient(0, top - 6, 0, top + 40);
    gr.addColorStop(0, COL.panel); gr.addColorStop(1, 'rgba(20,19,15,0)');
    g.fillStyle = gr; g.fillRect(ex + 1, top - 6, ew - 2, 46);
    gr = g.createLinearGradient(0, bot - 50, 0, bot);
    gr.addColorStop(0, 'rgba(20,19,15,0)'); gr.addColorStop(1, COL.panel);
    g.fillStyle = gr; g.fillRect(ex + 1, bot - 50, ew - 2, 50);

    // ---- терминал песочницы ----
    if (!lo.compact) {
      const [tx, ty, tw, th] = lo.tm;
      rr(g, tx, ty, tw, th, 12); g.fillStyle = '#0b0a08'; g.fill(); g.strokeStyle = COL.edge; g.lineWidth = 1.2; g.stroke();
      [0, 1, 2].forEach((i) => { g.fillStyle = '#3a352d'; g.beginPath(); g.arc(tx + 22 + i * 18, ty + 21, 5, 0, Math.PI * 2); g.fill(); });
      g.font = '500 13px "Geist Mono", ui-monospace, monospace'; g.fillStyle = COL.soft; g.textBaseline = 'middle';
      g.fillText('sandbox', tx + 80, ty + 22);
      g.font = `500 ${lo.tfs}px "Geist Mono", ui-monospace, monospace`;
      let y = ty + 66;
      const tm = it.term;
      if (tm) {
        tm.lines.forEach(([kind, txt], j) => {
          if (j > tm.shown) return;
          const vis = j < tm.shown ? txt : txt.slice(0, Math.floor(tm.typed));
          g.fillStyle = kind === 'cmd' ? COL.paper : kind === 'ok' ? COL.ok : '#a39c8f';
          if (kind === 'ok') g.font = `600 ${lo.tfs}px "Geist Mono", ui-monospace, monospace`;
          g.fillText(vis, tx + 20, y);
          y += lo.tlh;
        });
      } else {
        g.fillStyle = COL.paper; g.fillText('$', tx + 20, y);
        if (Math.floor(t * 2) % 2 === 0) { g.fillStyle = COL.kw; g.fillRect(tx + 38, y - lo.tfs / 2, lo.tfs * 0.55, lo.tfs); }
      }
    } else if (it.term && it.term.shown >= 5) {
      // телефон: вместо терминала — тёмная плашка с итогом
      const txt = '✓ ' + L(it.cfg.done);
      g.font = '600 30px "Geist Mono", ui-monospace, monospace';
      const tw2 = g.measureText(txt).width + 44;
      rr(g, 60, 600, tw2, 64, 12); g.fillStyle = '#0b0a08'; g.fill(); g.strokeStyle = COL.sig; g.lineWidth = 2; g.stroke();
      g.fillStyle = COL.ok; g.textBaseline = 'middle'; g.fillText(txt, 82, 633);
    }

    // пометка, как у остальных рисунков
    g.font = `500 ${lo.compact ? 22 : 13}px "Geist Mono", ui-monospace, monospace`;
    g.textAlign = 'right'; g.textBaseline = 'alphabetic'; g.fillStyle = COL.soft;
    g.fillText(L(it.cfg.tag).toUpperCase(), 1240, 688);
    g.textAlign = 'left';
    if (!it.el.classList.contains('live')) it.el.classList.add('live');
  }

  if (still) return;
  addTicker((t, dt) => {
    dt = Math.min(dt || 0, 0.1);
    for (const it of items) {
      if (!it.vis) continue;
      const lo = layout(it), lh = lo.lh, top = lo.ed[1] + 44, head = top + (lo.ed[3] - 60) * 0.42;
      if (it.hold > 0) it.hold -= dt;
      else {
        it.off += (lo.compact ? 34 : 26) * dt;
        const k = Math.floor((head - top + it.off) / lh), i = ((k % CODE.length) + CODE.length) % CODE.length;
        if (k !== it.lastK && FLAGS[i]) {         // подозрительная строка под полосой: стоп, тест в песочнице
          it.lastK = k; it.flag = FLAGS[i]; it.hold = 3.4;
          it.term = { lines: termLines(it), shown: 0, typed: 0, t: 0 };
        }
      }
      const tm = it.term;
      if (tm && tm.shown < tm.lines.length) {      // команда набирается по буквам, вывод появляется строками
        const [kind, txt] = tm.lines[tm.shown];
        if (kind === 'cmd') { tm.typed += 34 * dt; if (tm.typed >= txt.length + 4) { tm.shown++; tm.typed = 0; } }
        else { tm.t += dt; if (tm.t > (tm.shown === 1 ? 0.5 : 0.32)) { tm.shown++; tm.t = 0; tm.typed = 0; } }
        if (tm.shown < tm.lines.length && tm.lines[tm.shown][0] !== 'cmd') tm.typed = 999;
      } else if (tm && it.hold <= 0) {
        tm.t += dt; if (tm.t > 2.2) it.term = null;  // итог виден ещё пару секунд после того, как код пошёл дальше
      }
      draw(it, t);
    }
  });
}
