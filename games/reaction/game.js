import { createLobby, playerItems } from '../../js/lobby.js';
import { escapeHtml } from '../../js/net.js';

const ROUNDS = 5;
const POINTS = [3, 2, 1, 0];
const LIMIT_MS = 3000;

createLobby({ title: '⚡ นิ้วไว', minPlayers: 1, maxPlayers: 6, onStart });

function onStart(room) {
  const pad = document.getElementById('pad');
  const board = document.getElementById('board');
  const again = document.getElementById('again');

  // ---------- every player ----------
  let phase = 'idle';
  let round = 0;
  let goAt = 0;
  let tapped = false;

  const setPad = (cls, big, small = '') => {
    pad.className = cls;
    pad.innerHTML = `<div class="big">${big}</div><div class="small">${small}</div>`;
  };
  const renderBoard = (scores) => {
    board.innerHTML = playerItems(scores, room.myId, (p) => `<span class="score">${p.score}</span>`);
  };

  room.on('message', (m) => {
    switch (m.type) {
      case 'wait':
        phase = 'wait'; round = m.round; tapped = false; again.hidden = true;
        setPad('wait', `รอบ ${m.round}/${ROUNDS}`, 'รอสีเขียว... อย่าเพิ่งแตะ!');
        renderBoard(m.scores);
        break;
      case 'go':
        if (m.round !== round || tapped) return;
        phase = 'go'; goAt = performance.now();
        setPad('go', 'แตะเลย!');
        break;
      case 'result': {
        phase = 'result';
        const rows = m.results.map((r) => {
          const what = r.early ? 'แตะก่อน ❌' : r.ms != null ? `${r.ms} ms` : 'ไม่ได้แตะ';
          const pts = r.points > 0 ? `+${r.points}` : `${r.points}`;
          return `${escapeHtml(r.name)}: ${what} <span class="ms">(${pts})</span>`;
        }).join('<br>');
        setPad('result', `ผลรอบ ${m.round}`, rows);
        renderBoard(m.scores);
        break;
      }
      case 'end': {
        phase = 'end';
        const top = m.scores[0];
        const tie = m.scores.filter((s) => s.score === top.score).length > 1;
        setPad('end', tie ? 'เสมอ! 🤝' : `🏆 ${escapeHtml(top.name)} ชนะ!`, `${top.score} คะแนน`);
        renderBoard(m.scores);
        if (room.isHost) again.hidden = false;
        else pad.querySelector('.small').insertAdjacentHTML('beforeend', '<br>รอหัวหน้าห้องเริ่มเกมใหม่');
        break;
      }
    }
  });

  const tap = () => {
    if (tapped) return;
    if (phase === 'wait') {
      tapped = true;
      room.toHost({ type: 'early', round });
      setPad('early', 'เร็วไป!', 'ฟาวล์รอบนี้ −1 คะแนน');
    } else if (phase === 'go') {
      tapped = true;
      const ms = Math.round(performance.now() - goAt);
      room.toHost({ type: 'tap', round, ms });
      setPad('done', `${ms} ms`, 'รอเพื่อน...');
    }
  };
  pad.addEventListener('pointerdown', (e) => { e.preventDefault(); tap(); });
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); if (!e.repeat) tap(); }
  });

  if (room.isHost) hostLogic(room, again);
}

// ---------- host: authoritative game logic ----------
function hostLogic(room, again) {
  let scores = {};
  let names = {};
  let r = 0;
  let taps = {};
  let phase = 'idle';
  let goTimer = 0;
  let limitTimer = 0;

  const ids = () => room.players.map((p) => p.id);
  const scoreList = () => Object.keys(scores)
    .map((id) => ({ id, ...names[id], score: scores[id] }))
    .sort((a, b) => b.score - a.score);

  function startGame() {
    scores = {}; names = {};
    for (const p of room.players) { scores[p.id] = 0; names[p.id] = { name: p.name, color: p.color }; }
    r = 0;
    again.hidden = true;
    nextRound();
  }

  function nextRound() {
    r++;
    taps = {};
    phase = 'wait';
    room.broadcast({ type: 'wait', round: r, scores: scoreList() });
    goTimer = setTimeout(() => {
      phase = 'go';
      room.broadcast({ type: 'go', round: r });
      limitTimer = setTimeout(finishRound, LIMIT_MS);
    }, 1500 + Math.random() * 3000);
  }

  function finishRound() {
    if (phase !== 'wait' && phase !== 'go') return;
    clearTimeout(goTimer); clearTimeout(limitTimer);
    phase = 'result';
    const results = Object.keys(scores).map((id) => ({ id, name: names[id].name, ...(taps[id] || {}) }));
    results.filter((x) => x.ms != null).sort((a, b) => a.ms - b.ms).forEach((x, i) => { x.points = POINTS[i] ?? 0; });
    for (const x of results) {
      if (x.early) x.points = -1;
      x.points ??= 0;
      scores[x.id] += x.points;
    }
    room.broadcast({ type: 'result', round: r, results, scores: scoreList() });
    setTimeout(() => {
      if (r >= ROUNDS) { phase = 'end'; room.broadcast({ type: 'end', scores: scoreList() }); }
      else nextRound();
    }, 3200);
  }

  const allDone = () => ids().every((id) => taps[id]);

  room.on('input', (d, from) => {
    if (d.round !== r || taps[from] || !(from in scores)) return;
    if (d.type === 'early' && (phase === 'wait' || phase === 'go')) taps[from] = { early: true };
    else if (d.type === 'tap' && phase === 'go') taps[from] = { ms: Math.max(0, Math.min(LIMIT_MS, Number(d.ms) || LIMIT_MS)) };
    else return;
    if (allDone()) finishRound();
  });
  room.on('leave', () => { if ((phase === 'wait' || phase === 'go') && allDone()) finishRound(); });

  again.onclick = startGame;
  setTimeout(startGame, 600);
}
