/**
 * "Buy" buttons: the coin opened in trading terminals. Used by the Telegram bot and the terminal page.
 *
 *   GMGN      gmgn.ai/sol/token/{code}_{mint} and t.me/GMGN_sol_bot?start=i_{code}_c_{mint} (docs.gmgn.ai, referral-link)
 *   Axiom     axiom.trade/meme/{pair}; its referral counts only at sign-up, so the owner's link is a separate sign-up button
 *   Trojan    the owner's referral link as it is (a coin link that keeps the referral is not documented)
 *   pump.fun  pump.fun/coin/{mint}; a referral counts only when a new user types the code (the referrer's username)
 *             in the pump.fun app, so the code is shown as text, not built into the link
 * Referral codes live in refs.json and are filled in by the owner; empty means a plain link.
 */

const CODE = /^[A-Za-z0-9_-]{2,40}$/;
const isUrl = (s) => typeof s === "string" && /^https:\/\/[^\s"'<>]+$/.test(s);

/** Links that open this coin, best first. `pair` is the pool or curve address (Axiom opens pairs, not mints). */
export function buyLinks(mint, pair, refs = {}) {
  const gmgn = CODE.test(refs.gmgn ?? "") ? refs.gmgn : "";
  const out = [];
  out.push({ id: "gmgn", name: "GMGN", url: gmgn ? `https://gmgn.ai/sol/token/${gmgn}_${mint}` : `https://gmgn.ai/sol/token/${mint}`, ref: !!gmgn });
  if (pair) out.push({ id: "axiom", name: "Axiom", url: `https://axiom.trade/meme/${pair}`, ref: false });
  out.push({ id: "trojan", name: "Trojan", url: isUrl(refs.trojan) ? refs.trojan : "https://trojan.com", ref: isUrl(refs.trojan) });
  out.push({ id: "pump", name: "pump.fun", url: `https://pump.fun/coin/${mint}`, ref: false });
  if (gmgn) out.push({ id: "gmgnbot", name: "GMGN Bot", url: `https://t.me/GMGN_sol_bot?start=i_${gmgn}_c_${mint}`, ref: true });
  return out;
}

/** Sign-up links with the owner's referral, for terminals where the referral only counts when an account is created. */
export function signupLinks(refs = {}) {
  return [["axiom", "Axiom"]]
    .filter(([id]) => isUrl(refs[id]))
    .map(([id, name]) => ({ id, name, url: refs[id] }));
}

/** The pump.fun invite code (the owner's username), to type in the pump.fun app; null when not set. */
export const pumpCode = (refs = {}) => (CODE.test(refs.pump ?? "") ? refs.pump : null);
