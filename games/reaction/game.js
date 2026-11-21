import { createLobby, playerItems } from '../../js/lobby.js';
import { escapeHtml } from '../../js/net.js';
import { t, addStrings, onLang } from '../../js/i18n.js';

const ROUNDS = 5;
const POINTS = [3, 2, 1, 0];
const LIMIT_MS = 3000;

addStrings({
  th: {
    'rx.ready': 'เตรียมตัว...', 'rx.howto': 'แตะ/คลิก หรือกด Space เมื่อจอเป็นสีเขียว', 'rx.score': 'คะแนน',
    'rx.round': 'รอบ {n}/{total}', 'rx.waitGreen': 'รอสีเขียว... อย่าเพิ่งแตะ!', 'rx.tap': 'แตะเลย!',
    'rx.early': 'แตะก่อน ❌', 'rx.none': 'ไม่ได้แตะ', 'rx.result': 'ผลรอบ {n}', 'rx.tooEarly': 'เร็วไป!',
    'rx.foul': 'ฟาวล์รอบนี้ −1 คะแนน', 'rx.waitFriends': 'รอเพื่อน...',
  },
  en: {
    'rx.ready': 'Get ready...', 'rx.howto': 'Tap/click or press Space when the screen turns green', 'rx.score': 'Score',
    'rx.round': 'Round {n}/{total}', 'rx.waitGreen': "Wait for green... don't tap yet!", 'rx.tap': 'TAP!',
    'rx.early': 'Too early ❌', 'rx.none': 'No tap', 'rx.result': 'Round {n} results', 'rx.tooEarly': 'Too early!',
    'rx.foul': 'Foul: −1 point this round', 'rx.waitFriends': 'Waiting for the others...',
  },
});

createLobby({ title: 'g.reaction', minPlayers: 1, maxPlayers: 6, bots: true, onStart });

function onStart(room) {
  const pad = document.getElementById('pad');
  const board = document.getElementById('board');
  const again = document.getElementById('again');

  // ---------- every player ----------
  let phase = 'idle';
  let round = 0;
  let goAt = 0;
  let tapped = false;
  let padView = null;   // { cls, big(), small() } so it can be re-rendered in another language
  let lastScores = [];

  const setPad = (cls, big, small = () => '') => {
    padView = { cls, big, small };
    pad.className = cls;
    pad.innerHTML = `<div class="big">${big()}</div><div class="small">${small()}</div>`;
  };
  const renderBoard = (scores) => {
    lastScores = scores;
    board.innerHTML = playerItems(scores, room.myId, (p) => `<span class="score">${p.score}</span>`);
  };
  onLang(() => { if (padView) setPad(padView.cls, padView.big, padView.small); renderBoard(lastScores); });

  room.on('message', (m) => {
    switch (m.type) {
      case 'wait':
        phase = 'wait'; round = m.round; tapped = false; again.hidden = true;
        setPad('wait', () => t('rx.round', { n: m.round, total: ROUNDS }), () => t('rx.waitGreen'));
        renderBoard(m.scores);
        break;
      case 'go':
        if (m.round !== round || tapped) return;
        phase = 'go'; goAt = performance.now();
        setPad('go', () => t('rx.tap'));
        break;
      case 'result': {
        phase = 'result';
        const rows = () => m.results.map((r) => {
          const what = r.early ? t('rx.early') : r.ms != null ? `${r.ms} ms` : t('rx.none');
          const pts = r.points > 0 ? `+${r.points}` : `${r.points}`;
          return `${escapeHtml(r.name)}: ${what} <span class="ms">(${pts})</span>`;
        }).join('<br>');
        setPad('result', () => t('rx.result', { n: m.round }), rows);
        renderBoard(m.scores);
        break;
      }
      case 'end': {
        phase = 'end';
        const top = m.scores[0];
        const tie = m.scores.filter((s) => s.score === top.score).length > 1;
        setPad('end', () => (tie ? t('c.tie') : escapeHtml(t('c.wins', { name: top.name }))),
          () => t('c.points', { n: top.score }) + (room.isHost ? '' : `<br>${t('c.waitHostAgain')}`));
        renderBoard(m.scores);
        if (room.isHost) again.hidden = false;
        break;
      }
    }
  });

  const tap = () => {
    if (tapped) return;
    if (phase === 'wait') {
      tapped = true;
      room.toHost({ type: 'early', round });
      setPad('early', () => t('rx.tooEarly'), () => t('rx.foul'));
    } else if (phase === 'go') {
      tapped = true;
      const ms = Math.round(performance.now() - goAt);
      room.toHost({ type: 'tap', round, ms });
      setPad('done', () => `${ms} ms`, () => t('rx.waitFriends'));
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
    for (const p of room.players.filter((x) => x.bot)) {
      if (Math.random() < 0.08) { const round = r; setTimeout(() => handle({ type: 'early', round }, p.id), 600 + Math.random() * 800); }
    }
    goTimer = setTimeout(() => {
      phase = 'go';
      room.broadcast({ type: 'go', round: r });
      limitTimer = setTimeout(finishRound, LIMIT_MS);
      for (const p of room.players.filter((x) => x.bot)) {
        const ms = Math.round(230 + Math.random() * 230);
        const round = r;
        setTimeout(() => handle({ type: 'tap', round, ms }, p.id), ms);
      }
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

  function handle(d, from) {
    if (d.round !== r || taps[from] || !(from in scores)) return;
    if (d.type === 'early' && (phase === 'wait' || phase === 'go')) taps[from] = { early: true };
    else if (d.type === 'tap' && phase === 'go') taps[from] = { ms: Math.max(0, Math.min(LIMIT_MS, Number(d.ms) || LIMIT_MS)) };
    else return;
    if (allDone()) finishRound();
  }
  room.on('input', handle);
  room.on('leave', () => { if ((phase === 'wait' || phase === 'go') && allDone()) finishRound(); });

  again.onclick = startGame;
  setTimeout(startGame, 600);
}
