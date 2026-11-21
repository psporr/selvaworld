import { rankOf, suitOf } from '../../js/cards.js';

// Thai Slave: 3 lowest … K, A, 2 highest. Suits ♣ < ♦ < ♥ < ♠.
export const power = (c) => {
  const r = rankOf(c);
  return ((r === 2 ? 15 : r) - 3) * 4 + suitOf(c);
};
export const sortHand = (cards) => [...cards].sort((a, b) => power(a) - power(b));
export const THREE_CLUBS = 4; // card(3, ♣)

/** A valid play is 1–4 cards of the same rank. */
export function isCombo(cards) {
  return cards.length >= 1 && cards.length <= 4 && cards.every((c) => rankOf(c) === rankOf(cards[0]));
}

const top = (cards) => Math.max(...cards.map(power));

/** Can `cards` be played on top of `lead` (null = starting a new trick)? */
export function canBeat(cards, lead) {
  if (!isCombo(cards)) return false;
  if (!lead) return true;
  return cards.length === lead.length && top(cards) > top(lead);
}

/** Title keys by finishing place (translated with t()). */
export function titlesFor(n) {
  return {
    1: ['king'],
    2: ['king', 'slave'],
    3: ['king', 'peasant', 'slave'],
    4: ['king', 'queen', 'peasant', 'slave'],
    5: ['king', 'queen', 'peasant', 'peasant', 'slave'],
    6: ['king', 'queen', 'peasant', 'peasant', 'peasant', 'slave'],
  }[n].map((k) => `sl.t.${k}`);
}
