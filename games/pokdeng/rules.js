import { rankOf, suitOf } from '../../js/cards.js';

// A = 1, 2–9 = face value, 10/J/Q/K = 0
export const pointOf = (c) => { const r = rankOf(c); return r === 14 ? 1 : r >= 10 ? 0 : r; };

/**
 * Evaluate a Pok Deng hand.
 * key: higher wins (Pok > Tong > Straight flush > Straight > Sian > points)
 * deng: payout multiplier when this hand wins; kind: pok | tong | sf | straight | sian | pts
 */
export function evaluate(cards) {
  const pts = cards.reduce((a, c) => a + pointOf(c), 0) % 10;
  const rs = cards.map(rankOf).sort((a, b) => a - b);
  const flush = cards.every((c) => suitOf(c) === suitOf(cards[0]));

  if (cards.length === 2) {
    const pok = pts >= 8;
    const deng = flush || rs[0] === rs[1] ? 2 : 1;
    return { key: pok ? 200 + pts : pts, pts, pok, deng, kind: pok ? 'pok' : 'pts' };
  }

  const tong = rs[0] === rs[2];
  const lowAce = rs[0] === 2 && rs[1] === 3 && rs[2] === 14; // A-2-3
  const straight = (rs[1] === rs[0] + 1 && rs[2] === rs[1] + 1) || lowAce;
  const high = lowAce ? 3 : rs[2];
  const sian = rs.every((r) => r >= 11 && r <= 13);

  if (tong) return { key: 180 + rs[0], pts, deng: 5, kind: 'tong' };
  if (straight && flush) return { key: 160 + high, pts, deng: 5, kind: 'sf' };
  if (straight) return { key: 140 + high, pts, deng: 3, kind: 'straight' };
  if (sian) return { key: 120, pts, deng: 3, kind: 'sian' };
  return { key: pts, pts, deng: flush ? 3 : 1, kind: 'pts' };
}

/** Money the player wins (+) or loses (−) against the dealer. */
export function settle(playerCards, dealerCards, bet) {
  const p = evaluate(playerCards);
  const d = evaluate(dealerCards);
  if (p.key > d.key) return bet * p.deng;
  if (p.key < d.key) return -bet * d.deng;
  return 0;
}
