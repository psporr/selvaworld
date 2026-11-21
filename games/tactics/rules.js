// Tactics Arena rules: pure functions shared by host, clients and bots.
// Deterministic combat (no dice): what the forecast shows is exactly what happens.

export const CLASSES = {
  knight: { name: 'อัศวิน', icon: '🛡️', hp: 32, atk: 10, def: 6, mov: 3, min: 1, max: 1, note: 'ถึก ตีระยะประชิด' },
  archer: { name: 'นักธนู', icon: '🏹', hp: 22, atk: 9, def: 2, mov: 4, min: 2, max: 3, note: 'ยิงไกล 2–3 ช่อง ตีประชิดไม่ได้' },
  mage: { name: 'จอมเวท', icon: '🔮', hp: 20, atk: 11, def: 1, mov: 3, min: 1, max: 2, magic: true, note: 'เวทลดเกราะศัตรูครึ่งหนึ่ง' },
};
export const SQUAD = ['knight', 'archer', 'mage'];
export const TERRAIN = {
  '.': { name: 'ทุ่งหญ้า', cost: 1, def: 0 },
  F: { name: 'ป่า', cost: 2, def: 2 },
  R: { name: 'หิน', cost: Infinity, def: 0 },
  W: { name: 'น้ำ', cost: Infinity, def: 0 },
};
export const MAX_ROUNDS = 30;
const KILL_BONUS = 25;

export const key = (x, y) => `${x},${y}`;
export const dist = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
export const tileAt = (st, x, y) => (x < 0 || y < 0 || x >= st.size || y >= st.size ? 'R' : st.tiles[y * st.size + x]);
export const alive = (st) => st.units.filter((u) => u.hp > 0);
export const unitAt = (st, x, y) => st.units.find((u) => u.hp > 0 && u.x === x && u.y === y);
export const inRange = (cls, from, to) => { const d = dist(from, to); return d >= CLASSES[cls].min && d <= CLASSES[cls].max; };

/** Damage `att` deals to `def` standing on defPos. */
export function damage(st, att, def, defPos = [def.x, def.y]) {
  const a = CLASSES[att.cls];
  const armor = CLASSES[def.cls].def + TERRAIN[tileAt(st, ...defPos)].def;
  return Math.max(1, a.atk - (a.magic ? Math.floor(armor / 2) : armor));
}

/** Tiles the unit can end its move on → movement cost. Allies can be passed through, enemies block. */
export function reachable(st, u) {
  const mov = CLASSES[u.cls].mov;
  const best = new Map([[key(u.x, u.y), 0]]);
  const queue = [[u.x, u.y, 0]];
  while (queue.length) {
    queue.sort((a, b) => a[2] - b[2]);
    const [x, y, c] = queue.shift();
    if (c > best.get(key(x, y))) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      const nc = c + TERRAIN[tileAt(st, nx, ny)].cost;
      if (nc > mov) continue;
      const other = unitAt(st, nx, ny);
      if (other && other.owner !== u.owner) continue;
      if (nc < (best.get(key(nx, ny)) ?? Infinity)) { best.set(key(nx, ny), nc); queue.push([nx, ny, nc]); }
    }
  }
  for (const k of [...best.keys()]) {
    const [x, y] = k.split(',').map(Number);
    const other = unitAt(st, x, y);
    if (other && other !== u) best.delete(k);
  }
  return best;
}

/** Enemy units `u` could attack if it stood on pos. */
export function targetsFrom(st, u, pos) {
  return alive(st).filter((e) => e.owner !== u.owner && inRange(u.cls, pos, [e.x, e.y]));
}

/** Exact outcome of `u` moving to pos and attacking `t`. */
export function forecast(st, u, pos, t) {
  const dmg = damage(st, u, t);
  const kill = dmg >= t.hp;
  const counter = !kill && inRange(t.cls, [t.x, t.y], pos) ? Math.min(u.hp, damage(st, t, u, pos)) : 0;
  return { dmg: Math.min(dmg, t.hp), kill, counter, die: counter >= u.hp };
}

/** All tiles enemies of `owner` could hit next turn (for the danger-zone overlay). */
export function threatTiles(st, owner) {
  const out = new Set();
  for (const e of alive(st)) {
    if (e.owner === owner) continue;
    for (const k of reachable(st, e).keys()) {
      const [x, y] = k.split(',').map(Number);
      const { min, max } = CLASSES[e.cls];
      for (let dx = -max; dx <= max; dx++) for (let dy = -max; dy <= max; dy++) {
        const d = Math.abs(dx) + Math.abs(dy);
        if (d >= min && d <= max) out.add(key(x + dx, y + dy));
      }
    }
  }
  return out;
}

// ---------- map generation ----------
function anchors(S) {
  const m = Math.floor(S / 2);
  return [[1, 1, 1, 1], [S - 2, S - 2, -1, -1], [S - 2, 1, -1, 1], [1, S - 2, 1, -1], [m - 1, 1, 1, 1], [m, S - 2, -1, -1]];
}

export function makeBattle(playerIds, rnd = Math.random) {
  const n = playerIds.length;
  const S = n <= 2 ? 10 : n <= 4 ? 12 : 14;
  const spots = anchors(S).slice(0, n).map(([x, y, dx, dy]) => [[x, y], [x + dx, y], [x, y + dy]]);
  const reserved = new Set();
  for (const squad of spots) for (const [x, y] of squad) {
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) reserved.add(key(x + a, y + b));
  }
  for (let attempt = 0; attempt < 200; attempt++) {
    const tiles = Array(S * S).fill('.');
    // point-symmetric terrain so every corner is equally fair
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const mx = S - 1 - x;
      const my = S - 1 - y;
      if (y * S + x > my * S + mx) continue;
      if (reserved.has(key(x, y)) || reserved.has(key(mx, my))) continue;
      const r = rnd();
      const t = r < 0.07 ? 'R' : r < 0.11 ? 'W' : r < 0.26 ? 'F' : '.';
      tiles[y * S + x] = t;
      tiles[my * S + mx] = t;
    }
    // every squad must be able to reach every other
    const st = { size: S, tiles, units: [] };
    const seen = new Set([key(...spots[0][0])]);
    const q = [spots[0][0]];
    while (q.length) {
      const [x, y] = q.pop();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const k = key(x + dx, y + dy);
        if (!seen.has(k) && TERRAIN[tileAt(st, x + dx, y + dy)].cost < Infinity) { seen.add(k); q.push([x + dx, y + dy]); }
      }
    }
    if (!spots.every((s) => seen.has(key(...s[0])))) continue;
    const units = [];
    playerIds.forEach((owner, i) => SQUAD.forEach((cls, j) => {
      const [x, y] = spots[i][j];
      units.push({ id: `${i}-${cls}`, owner, cls, x, y, hp: CLASSES[cls].hp, acted: false });
    }));
    return { size: S, tiles, units };
  }
  throw new Error('map generation failed');
}

// ---------- bot ----------
/** Distance-by-path from every enemy (multi-source BFS, terrain only) — avoids getting stuck behind walls. */
function pathField(st, owner) {
  const field = new Map();
  const q = [];
  for (const e of alive(st)) if (e.owner !== owner) { field.set(key(e.x, e.y), 0); q.push([e.x, e.y]); }
  while (q.length) {
    const [x, y] = q.shift();
    const d = field.get(key(x, y));
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const k = key(x + dx, y + dy);
      const c = TERRAIN[tileAt(st, x + dx, y + dy)].cost;
      if (c === Infinity || field.has(k)) continue;
      field.set(k, d + c);
      q.push([x + dx, y + dy]);
    }
  }
  return field;
}

/** Next action for the player `owner`: one unit at a time, or end the turn. */
export function botAction(st, owner) {
  const mine = alive(st).filter((u) => u.owner === owner && !u.acted);
  if (!mine.length) return { type: 'end' };

  let bestAtk = null;
  for (const u of mine) {
    for (const k of reachable(st, u).keys()) {
      const pos = k.split(',').map(Number);
      for (const t of targetsFrom(st, u, pos)) {
        const f = forecast(st, u, pos, t);
        const forest = TERRAIN[tileAt(st, ...pos)].def;
        const score = f.dmg + (f.kill ? KILL_BONUS : 0) - f.counter * 0.8 - (f.die ? 40 : 0)
          + (1 - t.hp / CLASSES[t.cls].hp) * 4 + forest + (CLASSES[u.cls].max > 1 ? dist(pos, [t.x, t.y]) : 0);
        if (!bestAtk || score > bestAtk.score) bestAtk = { score, u, pos, t };
      }
    }
  }
  if (bestAtk && bestAtk.score > 0) {
    return { type: 'act', unit: bestAtk.u.id, x: bestAtk.pos[0], y: bestAtk.pos[1], target: bestAtk.t.id };
  }

  // no good attack: advance along real paths, prefer cover, keep fragile units a step behind
  const field = pathField(st, owner);
  const u = mine[0];
  const want = CLASSES[u.cls].max + (u.cls === 'knight' ? 0 : 1);
  let best = null;
  for (const k of reachable(st, u).keys()) {
    const pos = k.split(',').map(Number);
    const d = field.get(k) ?? 99;
    const score = -Math.abs(d - want) * 3 - d * 0.2 + TERRAIN[tileAt(st, ...pos)].def;
    if (!best || score > best.score) best = { score, pos };
  }
  return { type: 'act', unit: u.id, x: best.pos[0], y: best.pos[1], target: null };
}
