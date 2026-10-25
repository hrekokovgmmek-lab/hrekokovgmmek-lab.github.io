/**
 * Market data from GeckoTerminal's free public API: price, changes, volume, minute candles, latest trades.
 * Works in Node and in a browser (the API answers any origin). Free tier: about 30 requests a minute per address.
 *
 * Prices come from GeckoTerminal, never from pool reserves: the trading bot's price formula stays private.
 */

const GT = "https://api.geckoterminal.com/api/v2/networks/solana";
const DEX_RANK = { pumpswap: 0, "pump-fun": 1 };

async function getOnce(path, timeoutMs) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(`${GT}${path}`, { headers: { Accept: "application/json" }, signal: ctl.signal });
    if (res.status === 404) return { body: null };
    if (!res.ok) return { error: `GeckoTerminal ${res.status}`, retry: res.status === 429 || res.status >= 500 };
    return { body: await res.json() };
  } catch (e) {
    return { error: String(e?.message ?? e), retry: true };
  } finally {
    clearTimeout(timer);
  }
}

// In a browser the page's requests go one after another with a gap: the free tier answers a burst of four or five at
// once with 429 (worse behind a shared VPN address). The bot asks rarely and keeps no gap.
const GAP_MS = typeof window === "undefined" ? 0 : 350;
let queue = Promise.resolve();
function spaced(fn) {
  if (!GAP_MS) return fn();
  const run = queue.then(fn);
  queue = run.catch(() => {}).then(() => new Promise((r) => setTimeout(r, GAP_MS)));
  return run;
}

/** One request, retried twice on a rate limit or a network error: the free tier refuses bursts. */
async function get(path, timeoutMs = 12000) {
  for (const wait of [0, 2000, 6000]) {
    if (wait) await new Promise((r) => setTimeout(r, wait));
    const r = await spaced(() => getOnce(path, timeoutMs));
    if (!r.error) return r.body;
    if (!r.retry || wait === 6000) throw new Error(r.error);
  }
}

const num = (x) => (x == null || x === "" ? null : Number(x));

function poolOf(p) {
  const a = p.attributes;
  return {
    address: a.address,
    dex: p.relationships?.dex?.data?.id ?? "",
    priceUsd: num(a.base_token_price_usd),
    priceSol: num(a.base_token_price_quote_token),
    change: {
      m5: num(a.price_change_percentage?.m5), h1: num(a.price_change_percentage?.h1),
      h6: num(a.price_change_percentage?.h6), h24: num(a.price_change_percentage?.h24),
    },
    volume24: num(a.volume_usd?.h24),
    liquidityUsd: num(a.reserve_in_usd),
    marketCapUsd: num(a.market_cap_usd) ?? num(a.fdv_usd),
    fdvUsd: num(a.fdv_usd),
    createdAt: a.pool_created_at ? Date.parse(a.pool_created_at) : null,
    buys24: a.transactions?.h24?.buys ?? null,
    sells24: a.transactions?.h24?.sells ?? null,
    // per window: { buys, sells, buyers, sellers } and volume in USD, windows m5 m15 m30 h1 h6 h24
    tx: Object.fromEntries(Object.entries(a.transactions ?? {}).map(([k, v]) => [k, {
      buys: v?.buys ?? null, sells: v?.sells ?? null, buyers: v?.buyers ?? null, sellers: v?.sellers ?? null }])),
    volume: Object.fromEntries(Object.entries(a.volume_usd ?? {}).map(([k, v]) => [k, num(v)])),
  };
}

/**
 * What GeckoTerminal knows about the token itself: holders and how the supply is spread (its own count), the
 * developer's share, the pump.fun curve's progress, picture and links. null when the token is unknown to it.
 */
export async function tokenInfo(mint) {
  const j = await get(`/tokens/${mint}/info`);
  const a = j?.data?.attributes;
  if (!a) return null;
  const d = a.holders?.distribution_percentage ?? {};
  const lp = a.launchpad_details ?? null;
  return {
    name: a.name ?? null,
    symbol: a.symbol ?? null,
    image: a.image_url && a.image_url !== "missing.png" ? a.image_url : null,
    holders: a.holders?.count ?? null,
    spread: { top10: num(d.top_10), next10: num(d["11_20"]), next20: num(d["21_40"]), rest: num(d.rest) },
    devPct: num(a.developer_holding_percentage),
    curvePct: lp ? num(lp.graduation_percentage) : null,
    curveDone: lp ? !!lp.completed : null,
    curveDoneAt: lp?.completed_at ? Date.parse(lp.completed_at) : null,
    twitter: a.twitter_handle ?? null,
    telegram: a.telegram_handle ?? null,
    websites: Array.isArray(a.websites) ? a.websites.filter((u) => /^https?:\/\//.test(u)).slice(0, 2) : [],
    honeypot: a.is_honeypot === "yes" ? true : a.is_honeypot === "no" ? false : null,
  };
}

/** The coin's pools, the one to show first: the pump.fun pool we know of, else PumpSwap, the curve, then by liquidity. */
export async function marketOf(mint, knownPair = null) {
  const j = await get(`/tokens/${mint}/pools?page=1`);
  const pools = (j?.data ?? []).map(poolOf).filter((p) => p.address);
  pools.sort((a, b) => (a.address === knownPair ? -1 : b.address === knownPair ? 1 : 0)
    || (DEX_RANK[a.dex] ?? 9) - (DEX_RANK[b.dex] ?? 9) || (b.liquidityUsd ?? 0) - (a.liquidityUsd ?? 0));
  return { main: pools[0] ?? null, pools };
}

export async function poolNow(pool) {
  const j = await get(`/pools/${pool}`);
  return j?.data ? poolOf(j.data) : null;
}

/** Candles oldest first: { t (seconds), o, h, l, c, v (USD) }. timeframe: minute | hour | day. */
export async function candles(pool, timeframe = "minute", aggregate = 1, limit = 300) {
  const j = await get(`/pools/${pool}/ohlcv/${timeframe}?aggregate=${aggregate}&limit=${limit}&currency=usd`);
  const list = j?.data?.attributes?.ohlcv_list ?? [];
  const seen = new Set();
  return list
    .map(([t, o, h, l, c, v]) => ({ t, o, h, l, c, v }))
    .filter((k) => !seen.has(k.t) && seen.add(k.t))
    .sort((a, b) => a.t - b.t);
}

/** Latest trades (up to 300 within a day), newest first: { at (ms), side, sol, usd, tokens, priceUsd, wallet, tx }. */
export async function trades(pool, mint) {
  const j = await get(`/pools/${pool}/trades`);
  return (j?.data ?? []).map((d) => {
    const a = d.attributes;
    const buy = a.kind === "buy";
    return {
      at: Date.parse(a.block_timestamp),
      side: buy ? "buy" : "sell",
      sol: num(buy ? a.from_token_amount : a.to_token_amount),
      usd: num(a.volume_in_usd),
      tokens: num(buy ? a.to_token_amount : a.from_token_amount),
      priceUsd: num(buy ? a.price_to_in_usd : a.price_from_in_usd),
      wallet: a.tx_from_address,
      tx: a.tx_hash,
      mintSide: buy ? a.to_token_address === mint : a.from_token_address === mint,
    };
  }).filter((x) => x.mintSide !== false);
}

/** Short money formatting shared by the bot and the page: $0.0000021, $48.2K, $1.3M. */
export function money(x, lang = "en") {
  if (x == null || !Number.isFinite(x)) return "?";
  const loc = lang === "ru" ? "ru-RU" : "en-US";
  const a = Math.abs(x);
  if (a >= 1e9) return `$${(x / 1e9).toLocaleString(loc, { maximumFractionDigits: 2 })}${lang === "ru" ? " млрд" : "B"}`;
  if (a >= 1e6) return `$${(x / 1e6).toLocaleString(loc, { maximumFractionDigits: 2 })}${lang === "ru" ? " млн" : "M"}`;
  if (a >= 1e4) return `$${(x / 1e3).toLocaleString(loc, { maximumFractionDigits: 1 })}${lang === "ru" ? " тыс" : "K"}`;
  if (a >= 1000) return `$${x.toLocaleString(loc, { maximumFractionDigits: 0 })}`;
  if (a >= 1) return `$${x.toLocaleString(loc, { maximumFractionDigits: 2 })}`;
  if (a === 0) return "$0";
  return `$${x.toLocaleString(loc, { maximumSignificantDigits: 3 })}`;
}

export function signedPct(x, lang = "en") {
  if (x == null || !Number.isFinite(x)) return "?";
  const s = Math.abs(x).toLocaleString(lang === "ru" ? "ru-RU" : "en-US", { maximumFractionDigits: Math.abs(x) < 10 ? 1 : 0 });
  return `${x > 0 ? "+" : x < 0 ? "−" : ""}${s}${lang === "ru" ? " %" : "%"}`;
}

/**
 * Candles built from trades, oldest first: { t (seconds), o, h, l, c, v (USD) }. GeckoTerminal's own second candles are
 * paid, so second timeframes come from the latest trades; `step` is the candle length in seconds.
 */
export function candlesFromTrades(list, step) {
  const out = [];
  for (const x of [...list].filter((x) => x.priceUsd > 0 && Number.isFinite(x.at)).sort((a, b) => a.at - b.at)) {
    const t = Math.floor(x.at / 1000 / step) * step;
    const last = out[out.length - 1];
    if (last && last.t === t) {
      last.h = Math.max(last.h, x.priceUsd); last.l = Math.min(last.l, x.priceUsd); last.c = x.priceUsd; last.v += x.usd ?? 0;
    } else {
      out.push({ t, o: last ? last.c : x.priceUsd, h: Math.max(x.priceUsd, last ? last.c : x.priceUsd), l: Math.min(x.priceUsd, last ? last.c : x.priceUsd), c: x.priceUsd, v: x.usd ?? 0 });
    }
  }
  return out;
}
