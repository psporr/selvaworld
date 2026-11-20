import { createLobby, playerItems } from '../../js/lobby.js';
import { COLORS, escapeHtml } from '../../js/net.js';

const S = 64; // spacing between dots (svg units)
const M = 20; // margin

createLobby({ title: '🔲 จุดต่อกล่อง', minPlayers: 2, maxPlayers: 4, onStart });

// Indexing for an n×n grid of dots:
//  h[r*(n-1)+c]  horizontal line (r,c)→(r,c+1), r∈[0,n-1], c∈[0,n-2]
//  v[r*n+c]      vertical line   (r,c)→(r+1,c), r∈[0,n-2], c∈[0,n-1]
//  boxes[r*(n-1)+c]                              r,c∈[0,n-2]

function onStart(room) {
  const svg = document.getElementById('board');
  const banner = document.getElementById('banner');
  const list = document.getElementById('list');
  const again = document.getElementById('again');
  let st = null;

  room.on('message', (m) => { if (m.type === 'state') { st = m; render(); } });

  svg.addEventListener('click', (e) => {
    const hit = e.target.closest('.hit.free');
    if (!hit || !st || st.over || st.turn !== room.myId) return;
    room.toHost({ type: 'line', kind: hit.dataset.kind, r: +hit.dataset.r, c: +hit.dataset.c });
  });

  const colorOf = (id) => {
    const p = st.players.find((x) => x.id === id);
    return p ? COLORS[p.color % COLORS.length] : '#888';
  };

  function render() {
    const { n } = st;
    const size = M * 2 + S * (n - 1);
    const P = (i) => M + i * S;
    const myTurn = !st.over && st.turn === room.myId;
    svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
    svg.classList.toggle('myturn', myTurn);
    const me = st.players.find((p) => p.id === room.myId);
    svg.style.setProperty('--me', me ? COLORS[me.color % COLORS.length] : '#fff');

    let out = '';
    for (let r = 0; r < n - 1; r++) {
      for (let c = 0; c < n - 1; c++) {
        const owner = st.boxes[r * (n - 1) + c];
        if (!owner) continue;
        const p = st.players.find((x) => x.id === owner);
        out += `<rect class="box" x="${P(c) + 4}" y="${P(r) + 4}" width="${S - 8}" height="${S - 8}" rx="8" fill="${colorOf(owner)}"/>`;
        out += `<text class="box-label" x="${P(c) + S / 2}" y="${P(r) + S / 2}">${escapeHtml((p?.name || '?').slice(0, 1))}</text>`;
      }
    }
    const edge = (kind, r, c, x1, y1, x2, y2, owner) => {
      const isLast = st.last && st.last.kind === kind && st.last.r === r && st.last.c === c;
      const visible = owner
        ? `<line class="edge drawn ${isLast ? 'last' : ''}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${colorOf(owner)}" style="stroke:${colorOf(owner)}"/>`
        : `<line class="edge" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
      const hit = owner ? '' : `<line class="hit free" data-kind="${kind}" data-r="${r}" data-c="${c}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>
        <line class="ghost" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
      return visible + hit;
    };
    for (let r = 0; r < n; r++) for (let c = 0; c < n - 1; c++) out += edge('h', r, c, P(c), P(r), P(c + 1), P(r), st.h[r * (n - 1) + c]);
    for (let r = 0; r < n - 1; r++) for (let c = 0; c < n; c++) out += edge('v', r, c, P(c), P(r), P(c), P(r + 1), st.v[r * n + c]);
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) out += `<circle class="dotpt" cx="${P(c)}" cy="${P(r)}" r="6"/>`;
    svg.innerHTML = out;

    const ranked = [...st.players].map((p) => ({ ...p, score: st.scores[p.id] || 0, gone: !st.order.includes(p.id) }));
    list.innerHTML = playerItems(ranked, room.myId, (p) => `<span class="score">${p.gone ? '🚪 ' : ''}${p.score}</span>`);
    const turnIdx = ranked.findIndex((p) => p.id === st.turn);
    if (!st.over && turnIdx >= 0) list.children[turnIdx].classList.add('turn');

    if (st.over) {
      const best = Math.max(...ranked.map((p) => p.score));
      const top = ranked.filter((p) => p.score === best);
      banner.innerHTML = top.length > 1 ? 'เสมอ! 🤝' : `🏆 ${escapeHtml(top[0].name)} ชนะ!`;
      again.hidden = !room.isHost;
    } else {
      const cur = st.players.find((p) => p.id === st.turn);
      banner.innerHTML = myTurn ? '✏️ ตาคุณแล้ว!' : `รอ ${escapeHtml(cur?.name || '')} ลากเส้น...`;
      again.hidden = true;
    }
  }

  if (room.isHost) hostLogic(room, again);
}

// ---------- host: authoritative rules ----------
function hostLogic(room, again) {
  let st = null;

  function newGame() {
    const players = room.players.map(({ id, name, color }) => ({ id, name, color }));
    const n = players.length <= 2 ? 5 : 6;
    st = {
      type: 'state', n,
      h: Array(n * (n - 1)).fill(null),
      v: Array(n * (n - 1)).fill(null),
      boxes: Array((n - 1) * (n - 1)).fill(null),
      players,
      order: players.map((p) => p.id),
      turn: players[0].id,
      scores: Object.fromEntries(players.map((p) => [p.id, 0])),
      over: false,
      last: null,
    };
    room.broadcast(st);
  }

  const boxClosed = (r, c) => {
    const { n } = st;
    return st.h[r * (n - 1) + c] && st.h[(r + 1) * (n - 1) + c] && st.v[r * n + c] && st.v[r * n + c + 1];
  };

  const advance = () => {
    const i = st.order.indexOf(st.turn);
    st.turn = st.order[(i + 1) % st.order.length];
  };

  room.on('input', (d, from) => {
    if (!st || st.over || d?.type !== 'line' || from !== st.turn) return;
    const { n } = st;
    const { kind, r, c } = d;
    if (!Number.isInteger(r) || !Number.isInteger(c)) return;
    let arr;
    let idx;
    if (kind === 'h' && r >= 0 && r < n && c >= 0 && c < n - 1) { arr = st.h; idx = r * (n - 1) + c; }
    else if (kind === 'v' && r >= 0 && r < n - 1 && c >= 0 && c < n) { arr = st.v; idx = r * n + c; }
    else return;
    if (arr[idx]) return;
    arr[idx] = from;

    const candidates = kind === 'h' ? [[r - 1, c], [r, c]] : [[r, c - 1], [r, c]];
    let scored = 0;
    for (const [br, bc] of candidates) {
      if (br < 0 || bc < 0 || br > n - 2 || bc > n - 2) continue;
      const bi = br * (n - 1) + bc;
      if (!st.boxes[bi] && boxClosed(br, bc)) { st.boxes[bi] = from; st.scores[from]++; scored++; }
    }
    if (!scored) advance();
    st.last = { kind, r, c };
    if (st.boxes.every(Boolean)) st.over = true;
    room.broadcast(st);
  });

  room.on('leave', (id) => {
    if (!st) return;
    const i = st.order.indexOf(id);
    if (i < 0) return;
    st.order.splice(i, 1);
    if (!st.order.length) st.over = true;
    else if (st.turn === id) st.turn = st.order[i % st.order.length];
    room.broadcast(st);
  });

  again.onclick = newGame;
  newGame();
}
