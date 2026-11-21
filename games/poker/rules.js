import { rankOf, suitOf } from '../../js/cards.js';

export const HAND_NAMES = ['ไฮการ์ด', 'วันแพร์', 'ทูแพร์', 'ตอง', 'สเตรท', 'ฟลัช', 'ฟูลเฮาส์', 'โฟร์การ์ด', 'สเตรทฟลัช'];

/** Score 5 cards as [category, ...tiebreakers]; compare with cmp(). */
export function eval5(cs) {
  const rs = cs.map(rankOf).sort((a, b) => b - a);
  const flush = cs.every((c) => suitOf(c) === suitOf(cs[0]));
  const counts = new Map();
  for (const r of rs) counts.set(r, (counts.get(r) || 0) + 1);
  const groups = [...counts].sort((a, b) => b[1] - a[1] || b[0] - a[0]); // [rank, count]
  const uniq = [...new Set(rs)];
  let sh = 0;
  if (uniq.length === 5) {
    if (uniq[0] - uniq[4] === 4) sh = uniq[0];
    else if (uniq[0] === 14 && uniq[1] === 5) sh = 5; // A-2-3-4-5
  }
  const g = groups.map((x) => x[0]);
  if (sh && flush) return [8, sh];
  if (groups[0][1] === 4) return [7, ...g];
  if (groups[0][1] === 3 && groups[1][1] === 2) return [6, ...g];
  if (flush) return [5, ...rs];
  if (sh) return [4, sh];
  if (groups[0][1] === 3) return [3, ...g];
  if (groups[0][1] === 2 && groups[1][1] === 2) return [2, ...g];
  if (groups[0][1] === 2) return [1, ...g];
  return [0, ...rs];
}

export function cmp(a, b) {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d) return d;
  }
  return 0;
}

/** Best 5-card hand out of 5–7 cards → { score, cards, name } */
export function best(cards) {
  let bestScore = null;
  let bestCards = null;
  const n = cards.length;
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) for (let c = b + 1; c < n; c++)
    for (let d = c + 1; d < n; d++) for (let e = d + 1; e < n; e++) {
      const five = [cards[a], cards[b], cards[c], cards[d], cards[e]];
      const s = eval5(five);
      if (!bestScore || cmp(s, bestScore) > 0) { bestScore = s; bestCards = five; }
    }
  if (!bestScore) return null;
  const name = bestScore[0] === 8 && bestScore[1] === 14 ? 'รอยัลฟลัช' : HAND_NAMES[bestScore[0]];
  return { score: bestScore, cards: bestCards, name };
}

/** Name of the best hand so far (works with 2+ cards, for the player's own display). */
export function describe(cards) {
  if (cards.length >= 5) return best(cards).name;
  const rs = cards.map(rankOf);
  const counts = {};
  for (const r of rs) counts[r] = (counts[r] || 0) + 1;
  const c = Object.values(counts).sort((a, b) => b - a);
  if (c[0] === 4) return HAND_NAMES[7];
  if (c[0] === 3) return HAND_NAMES[3];
  if (c[0] === 2 && c[1] === 2) return HAND_NAMES[2];
  if (c[0] === 2) return HAND_NAMES[1];
  return HAND_NAMES[0];
}

/**
 * Split chips into main/side pots.
 * players: [{ id, total (chips put in this hand), folded, score (best() score or null) }]
 * returns [{ amount, winners: [id] }]
 */
export function splitPots(players) {
  const levels = [...new Set(players.map((p) => p.total).filter((t) => t > 0))].sort((a, b) => a - b);
  const pots = [];
  let prev = 0;
  for (const lv of levels) {
    let amount = 0;
    for (const p of players) amount += Math.max(0, Math.min(p.total, lv) - prev);
    const eligible = players.filter((p) => !p.folded && p.total >= lv);
    prev = lv;
    if (!amount) continue;
    if (!eligible.length) { // only folded players reached this level: fold it into the previous pot
      if (pots.length) pots[pots.length - 1].amount += amount;
      continue;
    }
    let top = null;
    for (const p of eligible) if (!top || cmp(p.score, top) > 0) top = p.score;
    const winners = eligible.filter((p) => cmp(p.score, top) === 0).map((p) => p.id);
    const last = pots[pots.length - 1];
    if (last && last.winners.join() === winners.join()) last.amount += amount;
    else pots.push({ amount, winners });
  }
  return pots;
}
