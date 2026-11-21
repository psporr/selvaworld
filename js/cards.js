// Shared playing-card helpers. A card is an int 0..51: rank = (c >> 2) + 2 (2..14, A = 14),
// suit = c & 3 in the order ♣ ♦ ♥ ♠ (Thai Slave suit order, lowest to highest).

export const SUITS = ['♣', '♦', '♥', '♠'];
const LABEL = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };

export const rankOf = (c) => (c >> 2) + 2;
export const suitOf = (c) => c & 3;
export const card = (rank, suit) => (rank - 2) * 4 + suit;
export const rankLabel = (r) => LABEL[r] || String(r);
export const cardLabel = (c) => rankLabel(rankOf(c)) + SUITS[suitOf(c)];
export const isRed = (c) => suitOf(c) === 1 || suitOf(c) === 2;

export function shuffle(a) {
  const rnd = new Uint32Array(a.length);
  crypto.getRandomValues(rnd);
  for (let i = a.length - 1; i > 0; i--) {
    const j = rnd[i] % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const newDeck = () => shuffle([...Array(52).keys()]);

/** HTML for a face-up card. opts: { size: 'sm'|'lg', selected, clickable } */
export function cardHTML(c, opts = {}) {
  const cls = ['pcard', isRed(c) ? 'red' : '', opts.size || '', opts.selected ? 'sel' : '', opts.clickable ? 'clickable' : '']
    .filter(Boolean).join(' ');
  const r = rankLabel(rankOf(c));
  const s = SUITS[suitOf(c)];
  return `<div class="${cls}" data-c="${c}" title="${r}${s}"><span class="cr">${r}<small>${s}</small></span><span class="cs">${s}</span></div>`;
}

export const backHTML = (size = '') => `<div class="pcard back ${size}"></div>`;

export const cardsHTML = (cards, opts) => cards.map((c) => cardHTML(c, opts)).join('');
