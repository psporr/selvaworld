import { createLobby, playerItems } from '../../js/lobby.js';
import { escapeHtml } from '../../js/net.js';
import { SIZE, ROUND_SECONDS, mulberry32, newBoard, play, findMoves, adjacent, botMove } from './rules.js';

const GEMS = ['💎', '🍀', '🔥', '⭐', '🍇', '🌙'];
const BG = ['#1e40af', '#166534', '#991b1b', '#a16207', '#6b21a8', '#334155'];
const COUNTDOWN = 3;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

createLobby({ title: '💎 เพชรเรียงสาม', minPlayers: 1, maxPlayers: 6, bots: true, onStart });

function onStart(room) {
  const boardEl = document.getElementById('board');
  const cover = document.getElementById('cover');
  const comboEl = document.getElementById('combo');
  const timerEl = document.getElementById('timer');
  const myScoreEl = document.getElementById('myscore');
  const list = document.getElementById('list');
  const again = document.getElementById('again');

  let round = 0;
  let board = null;
  let rand = null;
  let score = 0;
  let phase = 'idle';  // idle | countdown | play | done
  let deadline = 0;
  let busy = false;
  let sel = -1;
  let lastAction = 0;
  let hint = null;
  let ranking = [];

  function draw(pop = null) {
    boardEl.innerHTML = board.map((k, i) => {
      const cls = ['gem'];
      if (i === sel) cls.push('sel');
      if (pop?.has(i)) cls.push('pop');
      if (hint && (hint[0] === i || hint[1] === i)) cls.push('hint');
      return `<div class="${cls.join(' ')}" data-i="${i}" style="--g:${BG[k]}">${GEMS[k]}</div>`;
    }).join('');
  }

  function renderList() {
    list.innerHTML = playerItems(ranking.map((p) => (p.id === room.myId ? { ...p, score } : p)).sort((a, b) => b.score - a.score),
      room.myId, (p) => `<span class="score">${p.score}</span>`);
  }

  room.on('message', (m) => {
    window.__st = { phase, score, round, ranking };
    if (m.type === 'start') {
      round = m.round;
      rand = mulberry32(m.seed);
      board = newBoard(rand);
      score = 0; sel = -1; hint = null; busy = false;
      ranking = m.players.map((p) => ({ ...p, score: 0 }));
      myScoreEl.textContent = '0';
      again.hidden = true;
      draw();
      renderList();
      phase = 'countdown';
      (async () => {
        for (let n = COUNTDOWN; n > 0; n--) { cover.hidden = false; cover.innerHTML = `<div><div class="n">${n}</div>เตรียมตัว!</div>`; await wait(1000); }
        cover.hidden = true;
        phase = 'play';
        deadline = performance.now() + ROUND_SECONDS * 1000;
        lastAction = performance.now();
      })();
    } else if (m.type === 'scores' && m.round === round) {
      ranking = m.scores;
      renderList();
    } else if (m.type === 'end' && m.round === round) {
      phase = 'done';
      ranking = m.scores;
      score = m.scores.find((p) => p.id === room.myId)?.score ?? score;
      renderList();
      const top = m.scores[0];
      const tie = m.scores.filter((p) => p.score === top.score).length > 1;
      cover.hidden = false;
      cover.innerHTML = `<div>${tie ? 'เสมอ! 🤝' : `🏆 ${escapeHtml(top.name)} ชนะ!`}<br><small class="muted">${top.score} คะแนน${room.isHost ? '' : ' · รอหัวหน้าห้องเริ่มรอบใหม่'}</small></div>`;
      if (room.isHost) again.hidden = false;
    }
    window.__st = { phase, score, round, ranking };
  });

  // timer + idle hint
  setInterval(() => {
    if (phase !== 'play') { if (phase !== 'done') timerEl.textContent = ROUND_SECONDS; return; }
    const left = Math.max(0, Math.ceil((deadline - performance.now()) / 1000));
    timerEl.textContent = left;
    timerEl.classList.toggle('low', left <= 10);
    if (left === 0) { phase = 'done'; sel = -1; hint = null; draw(); cover.hidden = false; cover.textContent = 'หมดเวลา! รอสรุปผล...'; }
    else if (!busy && !hint && performance.now() - lastAction > 7000) { hint = findMoves(board)[0]; draw(); }
  }, 250);

  async function doMove(i, j) {
    if (busy || phase !== 'play') return;
    sel = -1;
    hint = null;
    lastAction = performance.now();
    const r = play(board, i, j, rand);
    if (!r) {
      draw();
      for (const k of [i, j]) boardEl.children[k]?.classList.add('shake');
      return;
    }
    busy = true;
    board = r.swapped;
    draw();
    await wait(130);
    for (const s of r.steps) {
      draw(new Set(s.cleared));
      if (s.combo > 1) { comboEl.textContent = `คอมโบ x${s.combo}!`; comboEl.classList.add('show'); }
      await wait(210);
      board = s.board;
      draw();
      await wait(120);
    }
    comboEl.classList.remove('show');
    board = r.board;
    score += r.gained;
    myScoreEl.textContent = score;
    draw();
    renderList();
    room.toHost({ type: 'score', round, score });
    busy = false;
  }

  // input: tap two gems, or swipe from one gem towards a neighbour (fires on release / after a clear swipe)
  let down = null;
  boardEl.addEventListener('pointerdown', (e) => {
    const g = e.target.closest('.gem');
    if (!g) return;
    down = { i: Number(g.dataset.i), x: e.clientX, y: e.clientY, swiped: false };
  });
  boardEl.addEventListener('pointermove', (e) => {
    if (!down || down.swiped) return;
    const dx = e.clientX - down.x;
    const dy = e.clientY - down.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 22) return;
    down.swiped = true;
    const { i } = down;
    const x = i % SIZE;
    const j = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? (x < SIZE - 1 ? i + 1 : -1) : (x > 0 ? i - 1 : -1)) : (dy > 0 ? i + SIZE : i - SIZE);
    if (j >= 0 && j < SIZE * SIZE) doMove(i, j);
  });
  window.addEventListener('pointerup', (e) => {
    if (!down) return;
    const d = down;
    down = null;
    if (d.swiped || phase !== 'play' || busy) return;
    const g = e.target.closest?.('.gem');
    if (!g || Number(g.dataset.i) !== d.i) return;
    if (sel >= 0 && adjacent(sel, d.i)) doMove(sel, d.i);
    else { sel = sel === d.i ? -1 : d.i; draw(); }
  });

  if (room.isHost) hostLogic(room, again);
}

// ---------- host: round timing, scoreboard and bots ----------
function hostLogic(room, again) {
  let round = 0;
  let phase = 'idle';
  let scores = {};
  let players = [];
  const timers = [];

  const ranking = () => players.map((p) => ({ ...p, score: scores[p.id] || 0 })).sort((a, b) => b.score - a.score);

  function newRound() {
    timers.forEach(clearTimeout);
    timers.length = 0;
    round++;
    players = room.players.map(({ id, name, color, bot }) => ({ id, name, color, bot: !!bot }));
    scores = Object.fromEntries(players.map((p) => [p.id, 0]));
    again.hidden = true;
    const seed = crypto.getRandomValues(new Uint32Array(1))[0];
    phase = 'countdown';
    room.broadcast({ type: 'start', round, seed, players });
    timers.push(setTimeout(() => {
      phase = 'play';
      for (const p of players) if (p.bot) runBot(p.id, seed);
    }, COUNTDOWN * 1000));
    // a little grace after the clock so the last moves' scores arrive
    timers.push(setTimeout(() => { phase = 'end'; room.broadcast({ type: 'end', round, scores: ranking() }); }, (COUNTDOWN + ROUND_SECONDS) * 1000 + 1500));
    const tick = setInterval(() => {
      if (phase === 'end') { clearInterval(tick); return; }
      room.broadcast({ type: 'scores', round, scores: ranking() });
    }, 1000);
    timers.push(tick);
  }

  function runBot(id, seed) {
    const rand = mulberry32(seed);
    let board = newBoard(rand);
    const r = round;
    const step = () => {
      if (phase !== 'play' || r !== round) return;
      const m = botMove(board);
      const res = m && play(board, m[0], m[1], rand);
      if (res) { board = res.board; scores[id] += res.gained; }
      timers.push(setTimeout(step, 1600 + Math.random() * 1400));
    };
    timers.push(setTimeout(step, 800 + Math.random() * 800));
  }

  room.on('input', (d, from) => {
    if (d?.type !== 'score' || d.round !== round || phase === 'end' || !(from in scores)) return;
    scores[from] = Math.max(0, Math.floor(Number(d.score) || 0));
  });
  room.on('leave', (id) => { players = players.filter((p) => p.id !== id); });

  again.onclick = newRound;
  setTimeout(newRound, 300);
}
