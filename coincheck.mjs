/**
 * pump.fun coin check: what a buyer should know before buying, read from the chain.
 *
 * One module for the Telegram bot (Node >= 20) and the site page (browser), no dependencies. Read-only: no wallet,
 * no keys. Only methods the free public node serves are used; it refuses getTokenLargestAccounts, so holders come
 * from getProgramAccounts with a 40-byte slice of each token account.
 *
 * Nothing here is taken from the trading bot: no price formula, no entry or exit thresholds. Account layouts are
 * pump.fun's public IDL.
 */

export const PUMP = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";
export const PUMP_AMM = "pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA";
export const PUMP_FEES = "pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ";
export const TOKEN = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
export const TOKEN_2022 = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
export const SYSTEM = "11111111111111111111111111111111";
export const WSOL = "So11111111111111111111111111111111111111112";
export const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
export const PUBLIC_RPC = "https://api.mainnet-beta.solana.com";

const CURVE_FOR_SALE = 793_100_000_000_000n;   // tokens a pump.fun curve sells before it completes (793.1 M, 6 decimals)
const CURVE_DISCRIMINATOR = "17b7f83760d8ac60";
const POOL_DISCRIMINATOR = "f19a6d0411b16dbc";
const TOP_OWNERS = 20;
const ONE_WALLET_DANGER_PCT = 50;
const THIN_POOL_SOL = 5;
const SAME_BLOCK_WARN = 5;
const HOLDERS_TIMEOUT_MS = 15000;
const LAUNCH_PAGES = 3;                           // signature pages of 1000 read to reach the creation transaction

// ---------- base58, sha256, program addresses ----------

const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const enc = (s) => new TextEncoder().encode(s);

export function b58decode(s) {
  let n = 0n;
  for (const c of s) {
    const i = ALPHABET.indexOf(c);
    if (i < 0) throw new Error("not base58");
    n = n * 58n + BigInt(i);
  }
  const out = [];
  while (n > 0n) { out.push(Number(n & 255n)); n >>= 8n; }
  for (const c of s) { if (c !== "1") break; out.push(0); }
  return Uint8Array.from(out.reverse());
}

export function b58encode(bytes) {
  let n = 0n;
  for (const b of bytes) n = (n << 8n) | BigInt(b);
  let s = "";
  while (n > 0n) { s = ALPHABET[Number(n % 58n)] + s; n /= 58n; }
  for (const b of bytes) { if (b !== 0) break; s = "1" + s; }
  return s;
}

export function isAddress(s) {
  if (typeof s !== "string" || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s)) return false;
  return b58decode(s).length === 32;
}

/** A mint address from a raw address or a link (pump.fun, Solscan, DexScreener, Axiom, GMGN all put it in the path). */
export function parseMintInput(text) {
  const words = String(text ?? "").trim().split(/[\s/?=&#]+/);
  for (const w of words.reverse()) if (isAddress(w)) return w;
  return null;
}

const P = 2n ** 255n - 19n;
const modp = (a) => ((a % P) + P) % P;
function powp(b, e) {
  let r = 1n;
  b = modp(b);
  while (e > 0n) { if (e & 1n) r = (r * b) % P; b = (b * b) % P; e >>= 1n; }
  return r;
}
const D = modp(-121665n * powp(121666n, P - 2n));

/** True if 32 bytes decompress to an ed25519 point, the same test Solana runs before accepting a program address. */
export function isOnCurve(bytes) {
  let y = 0n;
  for (let i = 31; i >= 0; i--) y = (y << 8n) | BigInt(bytes[i]);
  y = modp(y & ((1n << 255n) - 1n));
  const y2 = (y * y) % P;
  const u = modp(y2 - 1n);
  const v = modp(D * y2 + 1n);
  if (v === 0n) return u === 0n;
  const w = (u * powp(v, P - 2n)) % P;
  return w === 0n || powp(w, (P - 1n) / 2n) === 1n;
}

function concat(...parts) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}

const K = Uint32Array.from([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);
const rotr = (x, n) => (x >>> n) | (x << (32 - n));

/**
 * SHA-256 in plain JS. Browsers hide crypto.subtle from pages served over plain http, and the site is http until its
 * certificate is issued; a few hashes per check cost nothing.
 */
export function sha256(msg) {
  const padded = new Uint8Array(((msg.length + 9 + 63) >> 6) << 6);
  padded.set(msg);
  padded[msg.length] = 0x80;
  const dv = new DataView(padded.buffer);
  dv.setUint32(padded.length - 8, Math.floor(msg.length / 0x20000000));
  dv.setUint32(padded.length - 4, (msg.length * 8) >>> 0);
  const H = Uint32Array.from([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const W = new Uint32Array(64);
  for (let off = 0; off < padded.length; off += 64) {
    for (let i = 0; i < 16; i++) W[i] = dv.getUint32(off + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(W[i - 15], 7) ^ rotr(W[i - 15], 18) ^ (W[i - 15] >>> 3);
      const s1 = rotr(W[i - 2], 17) ^ rotr(W[i - 2], 19) ^ (W[i - 2] >>> 10);
      W[i] = W[i - 16] + s0 + W[i - 7] + s1;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const t1 = (h + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + W[i]) | 0;
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    H[0] += a; H[1] += b; H[2] += c; H[3] += d; H[4] += e; H[5] += f; H[6] += g; H[7] += h;
  }
  const out = new Uint8Array(32);
  const ov = new DataView(out.buffer);
  H.forEach((x, i) => ov.setUint32(i * 4, x));
  return out;
}

export async function findProgramAddress(seeds, programId) {
  const tail = concat(b58decode(programId), enc("ProgramDerivedAddress"));
  for (let bump = 255; bump >= 0; bump--) {
    const h = sha256(concat(...seeds, Uint8Array.of(bump), tail));
    if (!isOnCurve(h)) return b58encode(h);
  }
  throw new Error("no program address");
}

export const curveAddress = (mint) => findProgramAddress([enc("bonding-curve"), b58decode(mint)], PUMP);

/** The pool pump.fun creates on migration: pool = PDA(["pool", u16 0, PDA(["pool-authority", mint], pump), mint, quote], PumpSwap). */
export async function canonicalPoolAddress(mint, quoteMint = WSOL) {
  const authority = await findProgramAddress([enc("pool-authority"), b58decode(mint)], PUMP);
  return findProgramAddress(
    [enc("pool"), new Uint8Array(2), b58decode(authority), b58decode(mint), b58decode(quoteMint)], PUMP_AMM);
}

// ---------- account decoding (pump.fun public IDL) ----------

export function fromBase64(s) {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
const hex = (b) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
const u64 = (b, at) => new DataView(b.buffer, b.byteOffset, b.byteLength).getBigUint64(at, true);
const key = (b, at) => b58encode(b.subarray(at, at + 32));

/** BondingCurve: reserves, complete, creator, then fields pump.fun appended over time (older curves are shorter). */
export function decodeCurve(data) {
  if (data.length < 49 || hex(data.subarray(0, 8)) !== CURVE_DISCRIMINATOR) return null;
  const c = {
    realTokens: u64(data, 24),
    realQuote: u64(data, 32),
    complete: data[48] === 1,
  };
  if (data.length >= 81) c.creator = key(data, 49);
  if (data.length >= 82) c.mayhem = data[81] === 1;
  if (data.length >= 83) c.cashback = data[82] === 1;
  c.quoteMint = WSOL;
  if (data.length >= 115) {
    const q = key(data, 83);
    if (q !== SYSTEM) c.quoteMint = q;
  }
  if (data.length >= 125) c.holderReward = data[124] === 1;
  return c;
}

/** PumpSwap Pool: mints, vaults, coin creator and feature flags. */
export function decodePool(data) {
  if (data.length < 245 || hex(data.subarray(0, 8)) !== POOL_DISCRIMINATOR) return null;
  return {
    baseMint: key(data, 43),
    quoteMint: key(data, 75),
    baseVault: key(data, 139),
    quoteVault: key(data, 171),
    creator: key(data, 211),
    mayhem: data[243] === 1,
    cashback: data[244] === 1,
    holderReward: data.length > 270 ? data[270] === 1 : undefined,
  };
}

// ---------- RPC ----------

export class CheckError extends Error {
  constructor(code, detail) { super(detail ? `${code}: ${detail}` : code); this.code = code; }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Calls run one at a time with a gap between them: the free public node allows about 10 requests a second per address,
 * and the bot shares that address with whatever else runs on the machine.
 */
export function makeRpc(url = PUBLIC_RPC, { gapMs = 150, timeoutMs = 25000, retries = [1000, 3000, 8000] } = {}) {
  let queue = Promise.resolve();
  let last = 0;
  let calls = 0;

  async function once(method, params, ms) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), ms);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        signal: ctl.signal,
      });
      const text = await res.text();
      let body;
      try { body = JSON.parse(text); } catch { body = null; }
      if (res.status === 429 || res.status >= 500) return { retry: true, error: `HTTP ${res.status}` };
      if (!body) return { retry: false, error: `HTTP ${res.status}` };
      if (body.error) return { retry: body.error.code === 429, error: String(body.error.message ?? body.error.code) };
      return { result: body.result };
    } catch (e) {
      return { retry: true, error: e?.name === "AbortError" ? "timeout" : String(e?.message ?? e) };
    } finally {
      clearTimeout(timer);
    }
  }

  /** `opts.timeoutMs` and `opts.retries` override the defaults for one call. */
  function call(method, params, opts = {}) {
    const delays = opts.retries ?? retries;
    const run = queue.then(async () => {
      for (let attempt = 0; ; attempt++) {
        const wait = last + gapMs - Date.now();
        if (wait > 0) await sleep(wait);
        last = Date.now();
        calls++;
        const r = await once(method, params, opts.timeoutMs ?? timeoutMs);
        if (!r.error) return r.result;
        if (!r.retry || attempt >= delays.length) throw new CheckError("rpc", `${method}: ${r.error}`);
        await sleep(delays[attempt]);
      }
    });
    queue = run.catch(() => {});
    return run;
  }

  return { call, get calls() { return calls; } };
}

// ---------- reads ----------

const pct = (part, whole) => (whole > 0n ? Number((part * 1_000_000n) / whole) / 10_000 : 0);

const EXTENSIONS = {
  transferFeeConfig(s) {
    const bps = Number(s?.newerTransferFee?.transferFeeBasisPoints ?? 0);
    if (bps > 0) return { level: "danger", ru: `Комиссия ${bps / 100} % с каждого перевода — при продаже вы получите меньше`, en: `A ${bps / 100}% fee on every transfer: you get less when you sell` };
    if (s?.transferFeeConfigAuthority) return { level: "warn", ru: "Комиссию за перевод можно включить в любой момент", en: "A transfer fee can be switched on at any time" };
    return null;
  },
  transferHook(s) {
    if (s?.programId) return { level: "danger", ru: "Каждый перевод вызывает чужую программу — она может запретить продажу", en: "Every transfer calls another program, which can block selling" };
    if (s?.authority) return { level: "warn", ru: "Хук перевода можно подключить позже", en: "A transfer hook can be attached later" };
    return null;
  },
  permanentDelegate(s) {
    return s?.delegate ? { level: "danger", ru: "Есть постоянный делегат: он может списать токены с любого счёта", en: "A permanent delegate can take tokens from any account" } : null;
  },
  pausableConfig(s) {
    if (s?.paused) return { level: "danger", ru: "Переводы сейчас остановлены", en: "Transfers are paused right now" };
    return s?.authority ? { level: "danger", ru: "Переводы можно остановить — продать не дадут", en: "Transfers can be paused, and then nobody can sell" } : null;
  },
  defaultAccountState(s) {
    return s?.accountState === "frozen" ? { level: "danger", ru: "Новые счета создаются замороженными", en: "New token accounts start frozen" } : null;
  },
  nonTransferable() {
    return { level: "danger", ru: "Токен нельзя перевести, а значит и продать", en: "The token cannot be transferred, so it cannot be sold" };
  },
  mintCloseAuthority(s) {
    return s?.closeAuthority ? { level: "warn", ru: "Минт можно закрыть", en: "The mint can be closed" } : null;
  },
  permissionedBurn() {
    return { level: "warn", ru: "Сжигание только с разрешения выпускающего", en: "Burning needs the issuer's permission" };
  },
  scaledUiAmountConfig() {
    return { level: "warn", ru: "Показываемое количество токенов выпускающий может масштабировать", en: "The issuer can rescale the displayed token amounts" };
  },
  confidentialTransferFeeConfig: () => null,
  confidentialTransferMint() {
    return { level: "info", ru: "Включены скрытые переводы: суммы части переводов не видны", en: "Confidential transfers: some amounts are hidden" };
  },
  tokenMetadata(s) {
    return s?.updateAuthority ? { level: "info", ru: "Название и картинку монеты можно поменять", en: "The name and picture can be changed" } : null;
  },
  metadataPointer: () => null,
  groupPointer: () => null,
  groupMemberPointer: () => null,
  tokenGroup: () => null,
  tokenGroupMember: () => null,
};

function readMint(acc) {
  const info = acc.data.parsed.info;
  const m = {
    program: acc.owner === TOKEN_2022 ? "Token-2022" : "Token",
    decimals: info.decimals,
    supply: BigInt(info.supply),
    mintAuthority: info.mintAuthority ?? null,
    freezeAuthority: info.freezeAuthority ?? null,
    extensions: [],
    extensionFlags: [],
  };
  for (const e of info.extensions ?? []) {
    m.extensions.push(e.extension);
    if (e.extension === "tokenMetadata") { m.name = e.state?.name?.trim(); m.symbol = e.state?.symbol?.trim(); m.uri = e.state?.uri; }
    const rule = EXTENSIONS[e.extension];
    const f = rule ? rule(e.state) : { level: "warn", ru: `Незнакомое расширение токена: ${e.extension}`, en: `Unfamiliar token extension: ${e.extension}` };
    if (f) m.extensionFlags.push(f);
  }
  return m;
}

/** Every token account of the mint, summed by owner: [owner, raw amount] largest first, and the count of non-empty accounts. */
async function readHolders(rpc, mint, program) {
  const filters = [{ memcmp: { offset: 0, bytes: mint } }];
  if (program === TOKEN) filters.push({ dataSize: 165 });
  // A coin with hundreds of thousands of accounts takes the node minutes or is refused: one short try only.
  const rows = await rpc.call("getProgramAccounts", [program, { encoding: "base64", dataSlice: { offset: 32, length: 40 }, filters }],
    { timeoutMs: HOLDERS_TIMEOUT_MS, retries: [] });
  const byOwner = new Map();
  let accounts = 0;
  for (const r of rows) {
    const d = fromBase64(r.account.data[0]);
    if (d.length < 40) continue;
    const amount = u64(d, 32);
    if (amount === 0n) continue;
    accounts++;
    const owner = key(d, 0);
    byOwner.set(owner, (byOwner.get(owner) ?? 0n) + amount);
  }
  const owners = [...byOwner].sort((a, b) => (b[1] > a[1] ? 1 : b[1] < a[1] ? -1 : 0));
  return { accounts, owners };
}

/** Where the creator's first SOL came from: the system transfer into it in its oldest transaction. */
async function readFunding(rpc, creator, labels) {
  const sigs = await rpc.call("getSignaturesForAddress", [creator, { limit: 1000 }]);
  const out = { txs: sigs.length, fullHistory: sigs.length < 1000 };
  if (!sigs.length) return out;
  if (!out.fullHistory) return out;
  const tx = await rpc.call("getTransaction", [sigs.at(-1).signature,
    { encoding: "jsonParsed", maxSupportedTransactionVersion: 1, commitment: "confirmed" }]);
  if (!tx) return out;
  // Only a transaction that found the wallet empty is its first one: a node with short history returns some later one.
  const at = (tx.transaction?.message?.accountKeys ?? []).findIndex((k) => (k.pubkey ?? k) === creator);
  if (at < 0 || tx.meta?.preBalances?.[at] !== 0) {
    out.fullHistory = false;
    return out;
  }
  out.firstSeenAt = sigs.at(-1).blockTime ?? null;
  const all = [...(tx.transaction?.message?.instructions ?? []), ...(tx.meta?.innerInstructions ?? []).flatMap((i) => i.instructions)];
  let best = null;
  for (const ix of all) {
    const p = ix.parsed;
    if (ix.program !== "system" || !p || !["transfer", "transferWithSeed", "createAccount"].includes(p.type)) continue;
    const to = p.info?.destination ?? p.info?.newAccount;
    if (to !== creator) continue;
    const lamports = BigInt(p.info.lamports ?? 0);
    if (!best || lamports > best.lamports) best = { from: p.info.source, lamports };
  }
  if (best) out.funding = { from: best.from, sol: Number(best.lamports) / 1e9, label: labels.exchanges?.[best.from] ?? labels.terminals?.[best.from] ?? null };
  return out;
}

/** The curve's history back to its creation: when, and how many other successful transactions landed in the same block. */
async function readLaunch(rpc, curve) {
  let before;
  let newest = null;
  let last = [];
  for (let page = 0; page < LAUNCH_PAGES; page++) {
    const sigs = await rpc.call("getSignaturesForAddress", [curve, before ? { limit: 1000, before } : { limit: 1000 }]);
    if (!newest) newest = sigs;
    if (sigs.length) last = sigs;
    if (sigs.length < 1000) {
      if (!last.length) return { reached: true, recent: [] };
      const first = last.at(-1);
      const sameBlock = last.filter((s) => s.slot === first.slot && !s.err && s.signature !== first.signature).length;
      return { reached: true, createdAt: first.blockTime ?? null, createSignature: first.signature, sameBlock, recent: newest };
    }
    before = sigs.at(-1).signature;
  }
  return { reached: false, recent: newest };
}

// create and create_v2 in pump.fun's IDL: discriminator, index of the signing `user` account; both take
// name, symbol and uri (borsh strings) and then the `creator` pubkey the coin is registered to.
const CREATE_IX = { "181ec828051c0777": 7, d6904cec5f8b31b4: 5 };

/**
 * The creation transaction, checked: it must hold a pump.fun create instruction for this mint. Some nodes keep only
 * recent history, and the oldest signature they return is then just some trade, so an unchecked "first" transaction
 * would name a stranger as the creator.
 */
export function findCreate(tx, mint) {
  const msg = tx?.transaction?.message;
  if (!msg) return null;
  const keys = [...msg.accountKeys, ...(tx.meta?.loadedAddresses?.writable ?? []), ...(tx.meta?.loadedAddresses?.readonly ?? [])];
  const ixs = [...msg.instructions, ...(tx.meta?.innerInstructions ?? []).flatMap((i) => i.instructions)];
  for (const ix of ixs) {
    if (keys[ix.programIdIndex] !== PUMP || keys[ix.accounts?.[0]] !== mint) continue;
    let data;
    try { data = b58decode(ix.data); } catch { continue; }
    const userAt = CREATE_IX[hex(data.subarray(0, 8))];
    if (userAt === undefined) continue;
    let at = 8;
    for (let i = 0; i < 3 && at + 4 <= data.length; i++) at += 4 + new DataView(data.buffer, data.byteOffset).getUint32(at, true);
    const creator = at + 32 <= data.length ? key(data, at) : null;
    return { user: keys[ix.accounts[userAt]] ?? null, creator };
  }
  return null;
}

async function readCreate(rpc, signature, mint) {
  const tx = await rpc.call("getTransaction", [signature, { encoding: "json", maxSupportedTransactionVersion: 1, commitment: "confirmed" }]);
  return findCreate(tx, mint);
}

/** Which terminals the latest trades came through, by program and fee-wallet labels. */
async function readTerminals(rpc, sigs, labels, sample) {
  const counts = {};
  let seen = 0;
  for (const s of sigs.filter((x) => !x.err).slice(0, sample)) {
    const tx = await rpc.call("getTransaction", [s.signature, { encoding: "json", maxSupportedTransactionVersion: 1, commitment: "confirmed" }]);
    if (!tx) continue;
    seen++;
    const keys = [...(tx.transaction?.message?.accountKeys ?? []), ...(tx.meta?.loadedAddresses?.writable ?? []), ...(tx.meta?.loadedAddresses?.readonly ?? [])];
    const names = new Set(keys.map((k) => labels.terminals?.[k]).filter(Boolean));
    if (!names.size) names.add("");
    for (const n of names) counts[n] = (counts[n] ?? 0) + 1;
  }
  return { seen, counts };
}

// ---------- the check ----------

/**
 * Check one coin. Returns a report; `describe(report, lang)` turns it into text. Partial reads are kept: if the node
 * refuses one step, the report says what is missing instead of failing.
 */
export async function checkCoin(input, { rpc = makeRpc(), labels = {}, onStep = () => {}, sampleTx = 6 } = {}) {
  const mint = parseMintInput(input);
  if (!mint) throw new CheckError("bad_address");
  const t0 = Date.now();
  const calls0 = rpc.calls;
  const r = { mint, checkedAt: new Date().toISOString(), missing: [] };

  onStep("mint");
  const curve = await curveAddress(mint);
  const [mintAcc, curveAcc] = (await rpc.call("getMultipleAccounts", [[mint, curve], { encoding: "jsonParsed" }])).value;
  if (!mintAcc) throw new CheckError("not_found");
  if (![TOKEN, TOKEN_2022].includes(mintAcc.owner) || mintAcc.data?.parsed?.type !== "mint") throw new CheckError("not_mint");
  r.token = readMint(mintAcc);
  const supply = r.token.supply;

  const c = curveAcc && curveAcc.owner === PUMP && Array.isArray(curveAcc.data) ? decodeCurve(fromBase64(curveAcc.data[0])) : null;
  if (c) {
    const sold = c.realTokens > CURVE_FOR_SALE ? 0n : CURVE_FOR_SALE - c.realTokens;
    r.curve = {
      address: curve, complete: c.complete, soldPct: c.complete ? 100 : pct(sold, CURVE_FOR_SALE),
      quote: c.realQuote, quoteMint: c.quoteMint, creator: c.creator ?? null,
      mayhem: !!c.mayhem, cashback: !!c.cashback, holderReward: !!c.holderReward,
    };
  }
  r.isPump = !!c;

  if (c?.complete) {
    onStep("pool");
    const address = await canonicalPoolAddress(mint, c.quoteMint);
    const acc = await rpc.call("getAccountInfo", [address, { encoding: "base64" }]);
    const p = acc?.value && acc.value.owner === PUMP_AMM ? decodePool(fromBase64(acc.value.data[0])) : null;
    if (p && p.baseMint === mint) r.pool = { address, ...p };
  }
  // The launch first: the creation transaction names the wallet that really launched the coin. The curve's own
  // `creator` field is only who receives the creator fee: pump.fun's address for holder-reward coins, a fee-sharing
  // config, or a new wallet after a community takeover.
  let recent = [];
  if (r.curve) {
    onStep("launch");
    try {
      r.launch = await readLaunch(rpc, curve);
      recent = r.launch.recent;
      delete r.launch.recent;
    } catch { r.missing.push("launch"); }
  }
  let launcher = null;
  if (r.launch?.createSignature) {
    let created = null;
    try { created = await readCreate(rpc, r.launch.createSignature, mint); } catch { /* treated as not found */ }
    if (created) {
      launcher = created.creator ?? created.user;
      if (created.user && created.user !== launcher) r.launch.signedBy = created.user;
    } else {
      r.launch = { reached: false, shortHistory: true };   // the node's oldest transaction is not the creation
    }
  }
  const feeTo = r.pool?.creator ?? r.curve?.creator ?? null;

  onStep("holders");
  let holders = null;
  try {
    holders = await readHolders(rpc, mint, mintAcc.owner);
  } catch (e) {
    r.missing.push("holders");
    r.holdersError = String(e.message ?? e);
  }

  const top = holders ? holders.owners.slice(0, TOP_OWNERS) : [];
  const extra = [launcher, feeTo, r.pool?.baseVault, r.pool?.quoteVault].filter(Boolean);
  const keys = [...new Set([...top.map(([o]) => o), ...extra])];
  const accs = new Map();
  if (keys.length) {
    const got = (await rpc.call("getMultipleAccounts", [keys, { encoding: "base64", dataSlice: { offset: 64, length: 8 } }])).value;
    keys.forEach((k, i) => accs.set(k, got[i]));
  }
  const isWallet = (a) => !!a && a.owner === SYSTEM;

  if (r.pool) {
    const q = accs.get(r.pool.quoteVault);
    const b = accs.get(r.pool.baseVault);
    const qd = q ? fromBase64(q.data[0]) : null;
    const bd = b ? fromBase64(b.data[0]) : null;
    r.pool.quote = qd && qd.length === 8 ? u64(qd, 0) : null;
    r.pool.tokenPct = bd && bd.length === 8 ? pct(u64(bd, 0), supply) : null;
  }

  if (feeTo) {
    const a = accs.get(feeTo);
    let kind = "wallet";
    if (r.curve?.holderReward || r.pool?.holderReward) kind = "holders";
    else if (a?.owner === PUMP_FEES) kind = "sharing";
    else if (!isWallet(a)) kind = "other";
    r.feeRecipient = { address: feeTo, kind };
  }
  const creator = launcher ?? (r.feeRecipient?.kind === "wallet" ? feeTo : null);
  if (creator) {
    r.creator = { address: creator, fromCreateTx: !!launcher, sol: (accs.get(creator)?.lamports ?? 0) / 1e9 };
    if (r.feeRecipient) r.feeRecipient.isCreator = feeTo === creator;
  }

  if (holders) {
    r.holders = {
      accounts: holders.accounts,
      top: top.map(([owner, amount]) => {
        const a = accs.get(owner);
        let kind = "wallet";
        if (owner === curve) kind = "curve";
        else if (owner === r.pool?.address || a?.owner === PUMP_AMM) kind = "pool";
        else if (a && a.owner !== SYSTEM) kind = "program";
        const label = labels.exchanges?.[owner] ?? labels.terminals?.[owner] ?? (kind === "program" ? labels.terminals?.[a.owner] ?? null : null);
        return { owner, pct: pct(amount, supply), kind, label, isCreator: owner === creator };
      }),
    };
    const wallets = r.holders.top.filter((h) => h.kind === "wallet");
    r.holders.topWalletPct = wallets[0]?.pct ?? 0;
    r.holders.top10WalletsPct = Math.round(wallets.slice(0, 10).reduce((s, h) => s + h.pct, 0) * 100) / 100;
    const own = holders.owners.find(([o]) => o === creator);
    r.holders.creatorPct = own ? pct(own[1], supply) : 0;
  }

  if (r.creator) {
    onStep("creator");
    try { Object.assign(r.creator, await readFunding(rpc, creator, labels)); } catch { r.missing.push("creator"); }
  }

  if (r.pool) {
    try { recent = await rpc.call("getSignaturesForAddress", [r.pool.address, { limit: 20 }]); } catch { recent = []; }
  }
  if (recent.length && sampleTx > 0) {
    onStep("terminals");
    try { r.terminals = await readTerminals(rpc, recent, labels, sampleTx); } catch { r.missing.push("terminals"); }
  }

  r.calls = rpc.calls - calls0;
  r.ms = Date.now() - t0;
  r.flags = flagsOf(r);
  r.level = r.flags.some((f) => f.level === "danger") ? "danger" : r.flags.some((f) => f.level === "warn") ? "warn" : "ok";
  return r;
}

// ---------- verdict and text ----------

const quoteName = (m) => (m === WSOL ? "SOL" : m === USDC ? "USDC" : "quote");
const quoteAmount = (raw, m) => Number(raw) / (m === USDC ? 1e6 : 1e9);
const fmt = (x, d = 2, locale = "en-US") => (x == null ? "?" : Number(x).toLocaleString(locale, { maximumFractionDigits: d }));
const fmtRu = (x, d = 2) => fmt(x, d, "ru-RU");
const fmtEn = (x, d = 2) => fmt(x, d, "en-US");
const shortAddr = (a) => `${a.slice(0, 4)}…${a.slice(-4)}`;

export function flagsOf(r) {
  const f = [];
  const t = r.token;
  if (t.mintAuthority) f.push({ level: "danger", ru: "Можно выпустить новые токены — ваша доля размоется", en: "New tokens can still be minted, diluting your share" });
  if (t.freezeAuthority) f.push({ level: "danger", ru: "Ваш счёт можно заморозить — продать не дадут", en: "Your token account can be frozen, so you could not sell" });
  f.push(...t.extensionFlags);

  if (r.holders) {
    const h = r.holders;
    if (h.topWalletPct >= ONE_WALLET_DANGER_PCT) f.push({ level: "danger", ru: `Один кошелёк держит ${fmtRu(h.topWalletPct, 1)} % выпуска — он один может обрушить цену`, en: `One wallet holds ${fmt(h.topWalletPct, 1)}% of the supply and alone can crash the price` });
  }
  if (r.pool?.quote != null && r.pool.quoteMint === WSOL && quoteAmount(r.pool.quote, WSOL) < THIN_POOL_SOL) {
    const sol = quoteAmount(r.pool.quote, WSOL);
    f.push({ level: "warn", ru: `В пуле всего ${fmtRu(sol)} SOL — продать много не получится`, en: `Only ${fmt(sol)} SOL in the pool: a large sale cannot get out` });
  }
  const mayhem = r.pool?.mayhem ?? r.curve?.mayhem;
  if (mayhem) f.push({ level: "warn", ru: "Режим Mayhem: в торговле участвует собственный агент pump.fun", en: "Mayhem mode: pump.fun's own agent trades this coin" });
  if (r.launch?.reached && r.launch.sameBlock >= SAME_BLOCK_WARN) f.push({ level: "warn", ru: `В блоке создания ещё ${r.launch.sameBlock} сделок — похоже, создатель купил с нескольких кошельков сразу (бандл)`, en: `${r.launch.sameBlock} more transactions in the creation block: the creator likely bought from several wallets at once (a bundle)` });
  if (r.curve?.cashback || r.pool?.cashback) f.push({ level: "info", ru: "Кэшбэк: часть комиссии возвращается трейдерам, а не создателю", en: "Cashback: part of the fee goes back to traders instead of the creator" });
  if (r.curve?.holderReward || r.pool?.holderReward) f.push({ level: "info", ru: "Включены награды держателям", en: "Holder rewards are on" });
  if (!r.isPump) f.push({ level: "info", ru: "Кривой pump.fun нет — это не монета pump.fun; проверены только общие свойства токена", en: "No pump.fun curve: not a pump.fun coin, so only general token properties were checked" });
  for (const m of r.missing) f.push({ level: "info", code: `missing:${m}`, ru: `Не удалось прочитать: ${MISSING.ru[m] ?? m}`, en: `Could not read: ${MISSING.en[m] ?? m}` });
  const rank = { danger: 0, warn: 1, info: 2 };
  return f.sort((a, b) => rank[a.level] - rank[b.level]);
}

const MISSING = {
  ru: { holders: "держателей (узел отказал)", creator: "историю создателя", launch: "начало истории монеты", terminals: "последние сделки" },
  en: { holders: "holders (the node refused)", creator: "the creator's history", launch: "the coin's early history", terminals: "the latest trades" },
};

const VERDICT = {
  danger: { ru: "Опасно", en: "Dangerous" },
  warn: { ru: "Осторожно", en: "Caution" },
  ok: { ru: "Явных ловушек не найдено", en: "No obvious traps found" },
};

/** The report as text in one language: a verdict, the flags, and the facts behind them. */
export function describe(r, lang = "ru") {
  const L = (ru, en) => (lang === "ru" ? ru : en);
  const fmt = (x, d = 2) => (lang === "ru" ? fmtRu(x, d) : fmtEn(x, d));
  const facts = [];
  const t = r.token;
  const name = [t.name, t.symbol ? `$${t.symbol}` : ""].filter(Boolean).join(" ");
  if (name) facts.push([L("Монета", "Coin"), name]);
  facts.push([L("Программа токена", "Token program"), t.program]);
  facts.push([L("Выпуск", "Supply"), fmt(Number(t.supply) / 10 ** t.decimals, 0)]);
  facts.push([L("Выпуск новых", "Mint authority"), t.mintAuthority ? shortAddr(t.mintAuthority) : L("отключён", "revoked")]);
  facts.push([L("Заморозка", "Freeze authority"), t.freezeAuthority ? shortAddr(t.freezeAuthority) : L("отключена", "revoked")]);

  if (r.curve && !r.curve.complete) {
    const q = quoteName(r.curve.quoteMint);
    facts.push([L("Стадия", "Stage"), L(`на кривой pump.fun, продано ${fmt(r.curve.soldPct, 1)} %`, `on the pump.fun curve, ${fmt(r.curve.soldPct, 1)}% sold`)]);
    facts.push([L("В кривой", "In the curve"), `${fmt(quoteAmount(r.curve.quote, r.curve.quoteMint))} ${q}`]);
  } else if (r.pool) {
    const q = quoteName(r.pool.quoteMint);
    facts.push([L("Стадия", "Stage"), L("перешла в пул PumpSwap", "migrated to a PumpSwap pool")]);
    if (r.pool.quote != null) facts.push([L("В пуле", "In the pool"), `${fmt(quoteAmount(r.pool.quote, r.pool.quoteMint))} ${q}` + (r.pool.tokenPct != null ? L(` и ${fmt(r.pool.tokenPct, 1)} % токенов`, ` and ${fmt(r.pool.tokenPct, 1)}% of tokens`) : "")]);
  } else if (r.curve?.complete) {
    facts.push([L("Стадия", "Stage"), L("кривая завершена, пул PumpSwap не найден", "curve complete, no PumpSwap pool found")]);
  }

  if (r.holders) {
    const h = r.holders;
    facts.push([L("Держателей (счетов)", "Holders (accounts)"), fmt(h.accounts, 0)]);
    facts.push([L("Крупнейший кошелёк (без кривой и пула)", "Largest wallet (curve and pool excluded)"), L(`${fmt(h.topWalletPct, 2)} %`, `${fmt(h.topWalletPct, 2)}%`)]);
    facts.push([L("10 крупнейших кошельков", "Top 10 wallets"), L(`${fmt(h.top10WalletsPct, 2)} %`, `${fmt(h.top10WalletsPct, 2)}%`)]);
  }
  if (r.creator) {
    const c = r.creator;
    facts.push([L("Создатель", "Creator"), shortAddr(c.address)]);
    if (r.holders) facts.push([L("Создатель держит", "Creator holds"), L(`${fmt(r.holders.creatorPct, 2)} %`, `${fmt(r.holders.creatorPct, 2)}%`)]);
    if (c.sol != null) facts.push([L("SOL у создателя", "Creator's SOL"), fmt(c.sol, 3)]);
    if (c.funding) {
      const from = c.funding.label ?? shortAddr(c.funding.from);
      facts.push([L("Первые деньги создателя", "Creator first funded by"), `${fmt(c.funding.sol, 3)} SOL ← ${from}`]);
    } else if (c.txs != null && !c.fullHistory) {
      facts.push([L("История создателя", "Creator's history"), L("больше 1000 операций — старый кошелёк", "over 1000 transactions: an old wallet")]);
    }
    if (c.firstSeenAt && r.launch?.createdAt) {
      const h = (r.launch.createdAt - c.firstSeenAt) / 3600;
      facts.push([L("Кошелёк создателя заведён", "Creator wallet first seen"), h < 48 ? L(`за ${fmt(h, 1)} ч до монеты`, `${fmt(h, 1)} h before the coin`) : L(`за ${fmt(h / 24, 0)} дн до монеты`, `${fmt(h / 24, 0)} days before the coin`)]);
    }
  }
  if (r.feeRecipient && !r.feeRecipient.isCreator) {
    const fr = r.feeRecipient;
    const to = {
      holders: L("раздаётся держателям (pump.fun)", "paid out to holders by pump.fun"),
      sharing: L("делится между несколькими получателями", "split between several recipients"),
      wallet: L(`другой кошелёк ${shortAddr(fr.address)} — создателя меняли`, `another wallet ${shortAddr(fr.address)}: the creator was changed`),
      other: shortAddr(fr.address),
    }[fr.kind];
    facts.push([L("Комиссия создателя", "Creator fee"), to]);
  }
  if (r.launch?.shortHistory) {
    facts.push([L("Начало истории", "Early history"), L("узел не хранит транзакцию создания — создателя и блок создания не определить", "the node does not keep the creation transaction: creator and creation block unknown")]);
  } else if (r.launch && !r.launch.reached) {
    facts.push([L("Начало истории", "Early history"), L("больше 3000 сделок по кривой — создателя и блок создания не искали", "over 3000 curve trades: creator and creation block not looked up")]);
  }
  if (r.launch?.signedBy) facts.push([L("Создание подписал", "Creation signed by"), L(`${shortAddr(r.launch.signedBy)} (сервис запуска?)`, `${shortAddr(r.launch.signedBy)} (a launch service?)`)]);
  if (r.launch?.reached && r.launch.createdAt) {
    const when = new Date(r.launch.createdAt * 1000).toISOString().replace("T", " ").slice(0, 16) + " UTC";
    facts.push([L("Создана", "Created"), when]);
    facts.push([L("Ещё сделок в блоке создания", "Other trades in the creation block"), fmt(r.launch.sameBlock, 0)]);
  }
  if (r.terminals?.seen) {
    const parts = Object.entries(r.terminals.counts).sort((a, b) => b[1] - a[1])
      .map(([n, k]) => `${n || L("напрямую (боты)", "direct (bots)")} ${k}`);
    facts.push([L(`Последние ${r.terminals.seen} сделок`, `Latest ${r.terminals.seen} trades`), parts.join(", ")]);
  }

  return {
    level: r.level,
    verdict: VERDICT[r.level][lang === "ru" ? "ru" : "en"],
    flags: r.flags.map((f) => ({ level: f.level, code: f.code ?? null, text: lang === "ru" ? f.ru : f.en })),
    facts,
    note: L("Проверка видит устройство монеты на цепи, а не намерения людей. Это не совет покупать.",
      "The check sees how the coin is built on chain, not what people intend. It is not advice to buy."),
    links: {
      pump: `https://pump.fun/coin/${r.mint}`,
      solscan: `https://solscan.io/token/${r.mint}`,
    },
  };
}
