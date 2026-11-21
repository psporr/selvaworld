// Yacht-style dice: 12 categories, roll up to 3 times per turn, keep any dice between rolls.
const sum = (d) => d.reduce((a, b) => a + b, 0);
const counts = (d) => { const c = [0, 0, 0, 0, 0, 0, 0]; for (const v of d) c[v]++; return c; };
const hasRun = (d, len) => {
  const u = new Set(d);
  for (let s = 1; s + len - 1 <= 6; s++) {
    let ok = true;
    for (let v = s; v < s + len; v++) if (!u.has(v)) ok = false;
    if (ok) return true;
  }
  return false;
};

// Category names/hints are translated in game.js as dc.c.<id> / dc.h.<id>.
export const CATS = [
  { id: 'ones', upper: 1, score: (d) => d.filter((v) => v === 1).length },
  { id: 'twos', upper: 2, score: (d) => 2 * d.filter((v) => v === 2).length },
  { id: 'threes', upper: 3, score: (d) => 3 * d.filter((v) => v === 3).length },
  { id: 'fours', upper: 4, score: (d) => 4 * d.filter((v) => v === 4).length },
  { id: 'fives', upper: 5, score: (d) => 5 * d.filter((v) => v === 5).length },
  { id: 'sixes', upper: 6, score: (d) => 6 * d.filter((v) => v === 6).length },
  { id: 'choice', score: sum },
  { id: 'four', score: (d) => (Math.max(...counts(d)) >= 4 ? sum(d) : 0) },
  { id: 'full', score: (d) => { const c = counts(d).filter(Boolean).sort(); return (c.join() === '2,3' || c.join() === '5') ? sum(d) : 0; } },
  { id: 'small', score: (d) => (hasRun(d, 4) ? 15 : 0) },
  { id: 'large', score: (d) => (hasRun(d, 5) ? 30 : 0) },
  { id: 'yacht', score: (d) => (Math.max(...counts(d)) === 5 ? 50 : 0) },
];
export const CAT = Object.fromEntries(CATS.map((c) => [c.id, c]));
export const BONUS_AT = 63;
export const BONUS = 35;
export const ROUNDS = CATS.length;

export function upperSum(card) {
  return CATS.filter((c) => c.upper).reduce((a, c) => a + (card[c.id] ?? 0), 0);
}
export function total(card) {
  const all = CATS.reduce((a, c) => a + (card[c.id] ?? 0), 0);
  return all + (upperSum(card) >= BONUS_AT ? BONUS : 0);
}

// ---------- bot ----------
// rough average a category is worth, so the bot doesn't burn "yacht" on a 1-point roll
const BASE = { ones: 2, twos: 4.5, threes: 7, fours: 9.5, fives: 12, sixes: 14.5, choice: 22, four: 11, full: 13, small: 11, large: 10, yacht: 8 };

export function bestCategory(dice, card) {
  let best = null;
  for (const c of CATS) {
    if (card[c.id] != null) continue;
    const s = c.score(dice);
    let v = s - BASE[c.id];
    if (c.upper && s >= 3 * c.upper) v += 4; // on track for the upper bonus
    if (!best || v > best.v) best = { id: c.id, v };
  }
  return best.id;
}

/** Which dice to keep before the next roll, and whether to stop rolling now. */
export function botPlan(dice, card) {
  const open = (id) => card[id] == null;
  const c = counts(dice);
  const maxCount = Math.max(...c.slice(1));
  const face = [6, 5, 4, 3, 2, 1].find((f) => c[f] === maxCount);
  const keep = (pred) => dice.map(pred);
  if (open('yacht') && maxCount === 5) return { stop: true };
  if (open('large') && hasRun(dice, 5)) return { stop: true };
  if (open('full') && CAT.full.score(dice) && maxCount < 4) return { stop: true };
  if (open('small') && !open('large') && hasRun(dice, 4)) return { stop: true };
  if ((open('large') || open('small')) && maxCount < 3) {
    for (const run of [[2, 3, 4, 5], [3, 4, 5, 6], [1, 2, 3, 4], [2, 3, 4], [3, 4, 5], [4, 5, 6]]) {
      if (run.every((v) => dice.includes(v))) {
        const used = new Set();
        return { stop: false, held: keep((v) => { if (!run.includes(v) || used.has(v)) return false; used.add(v); return true; }) };
      }
    }
  }
  if (maxCount >= 2) return { stop: false, held: keep((v) => v === face) };
  return { stop: false, held: keep((v) => v >= 5) };
}
