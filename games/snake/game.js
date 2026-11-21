import { createLobby, playerItems } from '../../js/lobby.js';
import { COLORS, escapeHtml } from '../../js/net.js';
import { t, addStrings, onLang } from '../../js/i18n.js';

const W = 32;
const H = 32;
const TICK = 115;
const FOOD = 4;
const ROUND_MS = 90000; // with 2+ snakes, the longest survivor wins when time runs out
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };
const STARTS = [
  { x: 5, y: 5, d: 'right' },
  { x: W - 6, y: H - 6, d: 'left' },
  { x: W - 6, y: 5, d: 'down' },
  { x: 5, y: H - 6, d: 'up' },
  { x: W / 2, y: 3, d: 'down' },
  { x: W / 2 - 1, y: H - 4, d: 'up' },
];

addStrings({
  th: {
    'sn.list': 'ผู้เล่น (ความยาว · ชนะ)', 'sn.newRound': 'เริ่มรอบใหม่', 'sn.controls': 'บังคับด้วยปุ่มลูกศร / WASD หรือปัดจอ',
    'sn.secs': '⏱ {n} วินาที', 'sn.ready': 'เตรียมตัว!', 'sn.soloEnd': 'จบเกม! ยาว {n} ช่อง', 'sn.draw': 'เสมอ! 💥',
  },
  en: {
    'sn.list': 'Players (length · wins)', 'sn.newRound': 'New round', 'sn.controls': 'Steer with arrow keys / WASD or swipe',
    'sn.secs': '⏱ {n} s', 'sn.ready': 'Get ready!', 'sn.soloEnd': 'Game over! Length {n}', 'sn.draw': 'Draw! 💥',
  },
});

createLobby({ title: 'g.snake', minPlayers: 1, maxPlayers: 6, bots: true, onStart });

function onStart(room) {
  const canvas = document.getElementById('board');
  const ctx = canvas.getContext('2d');
  const countEl = document.getElementById('count');
  const banner = document.getElementById('banner');
  const list = document.getElementById('list');
  const again = document.getElementById('again');
  let state = null;
  let wins = {};
  let bannerFn = null; // re-rendered when the language changes
  const setBanner = (fn) => { bannerFn = fn; banner.innerHTML = fn ? fn() : ''; };
  onLang(() => { setBanner(bannerFn); renderList(); });

  room.on('message', (m) => {
    if (m.type === 'state') {
      state = m;
      window.__st = m;
      if (m.left != null) setBanner(() => t('sn.secs', { n: m.left }));
      draw();
      renderList();
    }
    else if (m.type === 'countdown') {
      countEl.textContent = m.n > 0 ? m.n : '';
      if (m.n > 0) { setBanner(() => t('sn.ready')); again.hidden = true; }
      else setBanner(null);
    } else if (m.type === 'over') {
      wins = m.wins;
      const w = m.winner && state?.snakes.find((s) => s.id === m.winner);
      setBanner(() => (w ? escapeHtml(t('c.wins', { name: w.name })) : m.solo ? t('sn.soloEnd', { n: m.solo }) : t('sn.draw'))
        + (room.isHost ? '' : `<br><small class="muted">${t('c.waitHostAgain')}</small>`));
      if (room.isHost) again.hidden = false;
      renderList();
    }
  });

  function renderList() {
    if (!state) return;
    list.innerHTML = playerItems(state.snakes, room.myId, (s) =>
      `<span class="score">${s.alive ? '' : '💀 '}${s.body.length} · ${wins[s.id] || 0}</span>`);
  }

  function draw() {
    const dpr = window.devicePixelRatio || 1;
    const size = canvas.clientWidth * dpr;
    if (canvas.width !== size) { canvas.width = size; canvas.height = size; }
    const c = size / W;
    ctx.fillStyle = '#0c0a17';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#ffffff0a';
    for (let x = 0; x < W; x++) for (let y = 0; y < H; y++) if ((x + y) % 2) ctx.fillRect(x * c, y * c, c, c);
    if (!state) return;

    for (const [x, y] of state.food) {
      ctx.fillStyle = '#ff6b6b';
      ctx.beginPath();
      ctx.arc((x + 0.5) * c, (y + 0.5) * c, c * 0.38, 0, Math.PI * 2);
      ctx.fill();
    }
    const sorted = [...state.snakes].sort((a, b) => a.alive - b.alive); // dead below
    for (const s of sorted) {
      ctx.globalAlpha = s.alive ? 1 : 0.25;
      ctx.fillStyle = COLORS[s.color % COLORS.length];
      s.body.forEach(([x, y], i) => {
        const pad = i === 0 ? 0.04 : 0.12;
        roundRect(ctx, (x + pad) * c, (y + pad) * c, c * (1 - pad * 2), c * (1 - pad * 2), c * 0.25);
      });
      if (s.body.length) {
        const [hx, hy] = s.body[0];
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc((hx + 0.5) * c, (hy + 0.5) * c, c * 0.14, 0, Math.PI * 2);
        ctx.fill();
        if (s.id === room.myId && s.alive) {
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = Math.max(1, c * 0.1);
          ctx.strokeRect(hx * c, hy * c, c, c);
        }
      }
    }
    ctx.globalAlpha = 1;
  }
  window.addEventListener('resize', draw);

  // ---------- input ----------
  const send = (d) => room.toHost({ type: 'dir', d });
  const KEYS = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };
  window.addEventListener('keydown', (e) => { const d = KEYS[e.code]; if (d) { e.preventDefault(); send(d); } });
  document.querySelectorAll('.pad button').forEach((b) => b.addEventListener('pointerdown', (e) => { e.preventDefault(); send(b.dataset.d); }));
  let touch = null;
  canvas.addEventListener('pointerdown', (e) => { touch = [e.clientX, e.clientY]; });
  canvas.addEventListener('pointermove', (e) => {
    if (!touch) return;
    const dx = e.clientX - touch[0];
    const dy = e.clientY - touch[1];
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    send(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
    touch = [e.clientX, e.clientY];
  });
  window.addEventListener('pointerup', () => { touch = null; });

  draw();
  if (room.isHost) hostLogic(room, again);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h);
  ctx.fill();
}

// ---------- host: authoritative simulation ----------
function hostLogic(room, again) {
  const wins = {};
  let snakes = [];
  let food = [];
  let tickTimer = 0;
  let cdTimer = 0;
  let running = false;
  let roundStart = 0;
  const key = (x, y) => `${x},${y}`;

  function newRound() {
    clearInterval(tickTimer); clearInterval(cdTimer);
    running = false;
    again.hidden = true;
    snakes = room.players.map((p, i) => {
      const s = STARTS[i % STARTS.length];
      const [dx, dy] = DIRS[s.d];
      return {
        id: p.id, name: p.name, color: p.color, bot: !!p.bot, dir: s.d, queue: [], alive: true, grow: 0,
        body: [0, 1, 2].map((k) => [s.x - dx * k, s.y - dy * k]),
      };
    });
    food = [];
    while (food.length < FOOD) spawnFood();
    sendState();
    let n = 3;
    room.broadcast({ type: 'countdown', n });
    cdTimer = setInterval(() => {
      n--;
      room.broadcast({ type: 'countdown', n });
      if (n <= 0) {
        clearInterval(cdTimer);
        running = true;
        roundStart = Date.now();
        tickTimer = setInterval(tick, TICK);
      }
    }, 800);
  }

  function spawnFood() {
    const used = new Set();
    for (const s of snakes) if (s.alive) for (const [x, y] of s.body) used.add(key(x, y));
    for (const [x, y] of food) used.add(key(x, y));
    for (let i = 0; i < 200; i++) {
      const x = Math.floor(Math.random() * W);
      const y = Math.floor(Math.random() * H);
      if (!used.has(key(x, y))) { food.push([x, y]); return; }
    }
  }

  // bot steering: never step into a wall/body, prefer room to move (flood fill), then the nearest fruit
  function steer(s, alive) {
    const blocked = new Set();
    for (const o of alive) o.body.forEach(([x, y], i) => { if (i < o.body.length - 1) blocked.add(key(x, y)); });
    for (const o of alive) if (o !== s) for (const [dx, dy] of Object.values(DIRS)) blocked.add(key(o.body[0][0] + dx, o.body[0][1] + dy));
    const free = (x, y) => x >= 0 && y >= 0 && x < W && y < H && !blocked.has(key(x, y));
    const space = (sx, sy) => {
      const seen = new Set([key(sx, sy)]);
      const q = [[sx, sy]];
      while (q.length && seen.size < 80) {
        const [x, y] = q.pop();
        for (const [dx, dy] of Object.values(DIRS)) {
          const k = key(x + dx, y + dy);
          if (!seen.has(k) && free(x + dx, y + dy)) { seen.add(k); q.push([x + dx, y + dy]); }
        }
      }
      return seen.size;
    };
    let best = null;
    for (const [d, [dx, dy]] of Object.entries(DIRS)) {
      if (d === OPPOSITE[s.dir]) continue;
      const x = s.body[0][0] + dx;
      const y = s.body[0][1] + dy;
      if (!free(x, y)) continue;
      const open = space(x, y);
      const fruit = Math.min(...food.map(([fx, fy]) => Math.abs(fx - x) + Math.abs(fy - y)));
      const score = Math.min(open, s.body.length + 12) * 10 - fruit + (d === s.dir ? 0.5 : 0) + Math.random() * 0.4;
      if (!best || score > best.score) best = { score, d };
    }
    if (best) s.queue = [best.d];
  }

  function tick() {
    const alive = snakes.filter((s) => s.alive);
    for (const s of alive) if (s.bot) steer(s, alive);
    const occupied = new Set();
    for (const s of alive) {
      const len = s.grow > 0 ? s.body.length : s.body.length - 1; // tail moves away this tick
      for (let i = 0; i < len; i++) occupied.add(key(...s.body[i]));
    }
    const heads = new Map();
    for (const s of alive) {
      while (s.queue.length) {
        const d = s.queue.shift();
        if (d !== s.dir && d !== OPPOSITE[s.dir]) { s.dir = d; break; }
      }
      const [dx, dy] = DIRS[s.dir];
      s.next = [s.body[0][0] + dx, s.body[0][1] + dy];
      const k = key(...s.next);
      heads.set(k, (heads.get(k) || 0) + 1);
    }
    for (const s of alive) {
      const [x, y] = s.next;
      const k = key(x, y);
      if (x < 0 || y < 0 || x >= W || y >= H || occupied.has(k) || heads.get(k) > 1) { s.alive = false; continue; }
      s.body.unshift(s.next);
      const fi = food.findIndex((f) => f[0] === x && f[1] === y);
      if (fi >= 0) { food.splice(fi, 1); s.grow += 2; }
      if (s.grow > 0) s.grow--; else s.body.pop();
    }
    while (food.length < FOOD) spawnFood();
    sendState();
    checkOver();
  }

  function checkOver() {
    if (!running) return;
    const alive = snakes.filter((s) => s.alive);
    const multi = snakes.length > 1;
    const timeUp = multi && Date.now() - roundStart >= ROUND_MS;
    if (!timeUp && ((multi && alive.length > 1) || (!multi && alive.length > 0))) return;
    running = false;
    clearInterval(tickTimer);
    let winner = multi && alive.length === 1 ? alive[0].id : null;
    if (timeUp && alive.length > 1) {
      const longest = Math.max(...alive.map((x) => x.body.length));
      const top = alive.filter((x) => x.body.length === longest);
      winner = top.length === 1 ? top[0].id : null;
    }
    if (winner) wins[winner] = (wins[winner] || 0) + 1;
    room.broadcast({ type: 'over', winner, wins: { ...wins }, solo: multi ? 0 : snakes[0].body.length });
  }

  function sendState() {
    room.broadcast({
      type: 'state',
      food,
      left: running && snakes.length > 1 ? Math.max(0, Math.ceil((ROUND_MS - (Date.now() - roundStart)) / 1000)) : null,
      snakes: snakes.map(({ id, name, color, alive, body, left }) => ({ id, name, color, alive, body, left })),
    });
  }

  room.on('input', (d, from) => {
    if (d?.type !== 'dir' || !DIRS[d.d]) return;
    const s = snakes.find((x) => x.id === from);
    if (s && s.alive && s.queue.length < 3) s.queue.push(d.d);
  });
  room.on('leave', (id) => {
    const s = snakes.find((x) => x.id === id);
    if (s) { s.alive = false; s.left = true; sendState(); checkOver(); }
  });

  again.onclick = newRound;
  setTimeout(newRound, 400);
}
