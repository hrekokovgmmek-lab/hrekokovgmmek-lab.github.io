/**
 * "Buy" buttons: the coin opened in trading terminals. Used by the Telegram bot and the terminal page.
 *
 * Only link formats that are documented or that every terminal shares publicly are built here:
 *   GMGN    gmgn.ai/sol/token/{code}_{mint} and t.me/GMGN_sol_bot?start=i_{code}_c_{mint} (docs.gmgn.ai, referral-link)
 *   Axiom   axiom.trade/meme/{pair}; its referral link only counts at sign-up, so it is offered as a separate sign-up link
 *   Photon  photon-sol.tinyastro.io/en/lp/{pair}
 * Trojan and BONKbot take the owner's own referral link as it is (their token deep links are not documented).
 * Referral codes live in refs.json and are filled in by the owner; empty means a plain link.
 */

const CODE = /^[A-Za-z0-9_-]{2,40}$/;
const isUrl = (s) => typeof s === "string" && /^https:\/\/[^\s"'<>]+$/.test(s);

/** Links that open this coin, best first. `pair` is the pool or curve address (Axiom and Photon open pairs, not mints). */
export function buyLinks(mint, pair, refs = {}) {
  const gmgn = CODE.test(refs.gmgn ?? "") ? refs.gmgn : "";
  const out = [];
  out.push({ id: "gmgn", name: "GMGN", url: gmgn ? `https://gmgn.ai/sol/token/${gmgn}_${mint}` : `https://gmgn.ai/sol/token/${mint}`, ref: !!gmgn });
  if (pair) out.push({ id: "axiom", name: "Axiom", url: `https://axiom.trade/meme/${pair}`, ref: false });
  if (pair) out.push({ id: "photon", name: "Photon", url: `https://photon-sol.tinyastro.io/en/lp/${pair}`, ref: false });
  if (gmgn) out.push({ id: "gmgnbot", name: "GMGN Bot", url: `https://t.me/GMGN_sol_bot?start=i_${gmgn}_c_${mint}`, ref: true });
  out.push({ id: "trojan", name: "Trojan", url: isUrl(refs.trojan) ? refs.trojan : "https://t.me/solana_trojanbot", ref: isUrl(refs.trojan) });
  out.push({ id: "bonkbot", name: "BONKbot", url: isUrl(refs.bonkbot) ? refs.bonkbot : "https://t.me/bonkbot_bot", ref: isUrl(refs.bonkbot) });
  out.push({ id: "pump", name: "pump.fun", url: `https://pump.fun/coin/${mint}`, ref: false });
  return out;
}

/** Sign-up links with the owner's referral, for terminals where the referral only counts when an account is created. */
export function signupLinks(refs = {}) {
  return [["axiom", "Axiom"], ["photon", "Photon"]]
    .filter(([id]) => isUrl(refs[id]))
    .map(([id, name]) => ({ id, name, url: refs[id] }));
}
