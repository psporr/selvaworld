// Match-3 engine (pure). Board = array of SIZE*SIZE gem kinds (0..KINDS-1).
export const SIZE = 8;
export const KINDS = 6;
export const ROUND_SECONDS = 90;

/** Small seeded RNG so every player starts from the same board. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const kind = (rand) => Math.floor(rand() * KINDS);

function makesMatchAt(b, i, k) {
  const x = i % SIZE;
  const y = Math.floor(i / SIZE);
  return (x >= 2 && b[i - 1] === k && b[i - 2] === k) || (y >= 2 && b[i - SIZE] === k && b[i - 2 * SIZE] === k);
}

export function newBoard(rand) {
  for (;;) {
    const b = [];
    for (let i = 0; i < SIZE * SIZE; i++) {
      let k;
      do k = kind(rand); while (makesMatchAt(b, i, k));
      b.push(k);
    }
    if (findMoves(b).length) return b;
  }
}

/** Indices of all gems that are part of a horizontal or vertical run of 3+. */
export function findMatches(b) {
  const out = new Set();
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE;) {
      const k = b[y * SIZE + x];
      let e = x + 1;
      while (e < SIZE && b[y * SIZE + e] === k) e++;
      if (k != null && e - x >= 3) for (let i = x; i < e; i++) out.add(y * SIZE + i);
      x = e;
    }
  }
  for (let x = 0; x < SIZE; x++) {
    for (let y = 0; y < SIZE;) {
      const k = b[y * SIZE + x];
      let e = y + 1;
      while (e < SIZE && b[e * SIZE + x] === k) e++;
      if (k != null && e - y >= 3) for (let i = y; i < e; i++) out.add(i * SIZE + x);
      y = e;
    }
  }
  return out;
}

export const adjacent = (i, j) => {
  const dx = Math.abs((i % SIZE) - (j % SIZE));
  const dy = Math.abs(Math.floor(i / SIZE) - Math.floor(j / SIZE));
  return dx + dy === 1;
};

/** Every swap that makes a match: [i, j, gemsClearedImmediately]. */
export function findMoves(b) {
  const moves = [];
  for (let i = 0; i < SIZE * SIZE; i++) {
    for (const j of [i + 1, i + SIZE]) {
      if (j >= SIZE * SIZE || !adjacent(i, j)) continue;
      const c = b.slice();
      [c[i], c[j]] = [c[j], c[i]];
      const n = findMatches(c).size;
      if (n) moves.push([i, j, n]);
    }
  }
  return moves;
}

function gravity(c, rand) {
  for (let x = 0; x < SIZE; x++) {
    let write = SIZE - 1;
    for (let y = SIZE - 1; y >= 0; y--) {
      const v = c[y * SIZE + x];
      if (v != null) { c[write * SIZE + x] = v; write--; }
    }
    for (let y = write; y >= 0; y--) c[y * SIZE + x] = kind(rand);
  }
}

/**
 * Swap i and j. Returns null if illegal, else
 * { swapped, steps: [{ cleared, board, combo }], board, gained, combo, shuffled }.
 * Score: 10 per gem × cascade level (2nd cascade doubles, 3rd triples …).
 */
export function play(b, i, j, rand) {
  if (!adjacent(i, j)) return null;
  const c = b.slice();
  [c[i], c[j]] = [c[j], c[i]];
  let m = findMatches(c);
  if (!m.size) return null;
  const swapped = c.slice();
  const steps = [];
  let combo = 0;
  let gained = 0;
  while (m.size) {
    combo++;
    gained += m.size * 10 * combo;
    const cleared = [...m];
    for (const k of cleared) c[k] = null;
    gravity(c, rand);
    steps.push({ cleared, board: c.slice(), combo });
    m = findMatches(c);
  }
  let board = c;
  let shuffled = false;
  if (!findMoves(board).length) { board = newBoard(rand); shuffled = true; }
  return { swapped, steps, board, gained, combo, shuffled };
}

/** Bot choice: usually the biggest immediate match, sometimes any legal move. */
export function botMove(b, rand = Math.random) {
  const moves = findMoves(b);
  if (!moves.length) return null;
  if (rand() < 0.35) return moves[Math.floor(rand() * moves.length)];
  return moves.reduce((best, m) => (m[2] > best[2] ? m : best));
}
