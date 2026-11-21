import { createLobby } from '../../js/lobby.js';
import { COLORS, escapeHtml } from '../../js/net.js';
import { botRunner } from '../../js/bots.js';
import { CATS, CAT, ROUNDS, BONUS, BONUS_AT, upperSum, total, bestCategory, botPlan } from './rules.js';

createLobby({ title: '🎲 ยอดลูกเต๋า', minPlayers: 1, maxPlayers: 6, bots: true, onStart });

const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
const dieHTML = (v, i, cls = '') => `<div class="die ${cls}" data-i="${i}">${Array.from({ length: 9 }, (_, k) => `<i class="${PIPS[v]?.includes(k) ? 'on' : ''}"></i>`).join('')}</div>`;

function onStart(room) {
  const el = document.getElementById('table');
  let st = null;
  let lastRoll = -1;
  let pending = null;
  let hostNext = null;

  room.on('message', (m) => {
    if (m.type !== 'state') return;
    const rolled = m.rollId !== lastRoll;
    lastRoll = m.rollId;
    if (m.turn !== st?.turn || rolled) pending = null;
    st = m;
    window.__st = m;
    render(rolled);
  });

  el.addEventListener('click', (e) => {
    if (!st) return;
    const mine = !st.over && st.turn === room.myId;
    const die = e.target.closest('.die');
    if (die && mine && st.rollsLeft < 3 && st.rollsLeft > 0) return room.toHost({ type: 'hold', i: Number(die.dataset.i) });
    const pick = e.target.closest('td.pick');
    if (pick && mine) { pending = pick.dataset.cat; return render(false); }
    const b = e.target.closest('[data-act]');
    if (!b || b.disabled) return;
    if (b.dataset.act === 'roll') room.toHost({ type: 'roll' });
    else if (b.dataset.act === 'score') { room.toHost({ type: 'score', cat: pending }); pending = null; }
    else if (b.dataset.act === 'again') hostNext?.();
  });

  function render(animate) {
    const mine = !st.over && st.turn === room.myId;
    const cur = st.players.find((p) => p.id === st.turn);
    const fresh = st.rollsLeft === 3;
    const dice = st.dice.map((v, i) => dieHTML(fresh ? 0 : v, i,
      [fresh ? 'blank' : '', st.held[i] && !fresh ? 'held' : '', animate && !st.held[i] && !fresh ? 'roll' : ''].join(' '))).join('');

    let status;
    let actions = '';
    if (st.over) {
      const ranked = [...st.players].sort((a, b) => total(st.cards[b.id]) - total(st.cards[a.id]));
      const top = total(st.cards[ranked[0].id]);
      const tie = ranked.filter((p) => total(st.cards[p.id]) === top).length > 1;
      status = tie ? `เสมอ! ${top} คะแนน 🤝` : `🏆 ${escapeHtml(ranked[0].name)} ชนะ ${top} คะแนน!`;
      actions = room.isHost ? '<button class="btn primary" data-act="again">เล่นอีกครั้ง</button>' : '<span class="muted">รอหัวหน้าห้องเริ่มใหม่</span>';
    } else if (mine) {
      status = fresh ? 'ตาคุณ! กดทอยลูกเต๋า' : st.rollsLeft ? 'แตะลูกเต๋าเพื่อเก็บไว้ แล้วทอยใหม่ หรือเลือกช่องลงคะแนน' : 'ทอยครบแล้ว เลือกช่องลงคะแนน';
      actions = `<button class="btn primary" data-act="roll" ${st.rollsLeft ? '' : 'disabled'}>🎲 ทอย (เหลือ ${st.rollsLeft})</button>`;
      if (pending) actions += `<button class="btn" data-act="score">ลง ${CAT[pending].score(st.dice)} แต้มที่ "${CAT[pending].name}"</button>`;
    } else {
      status = `ตาของ ${escapeHtml(cur?.name || '')}${cur?.bot ? ' 🤖' : ''}...`;
    }

    const head = st.players.map((p) => `<th class="${p.id === st.turn && !st.over ? 'turn' : ''}" style="--pc:${COLORS[p.color % COLORS.length]}">${p.bot ? '🤖' : ''}${escapeHtml(p.name)}${p.id === room.myId ? '<br><small>(คุณ)</small>' : ''}</th>`).join('');
    const cell = (p, c) => {
      const v = st.cards[p.id][c.id];
      if (v != null) return `<td class="filled">${v}</td>`;
      if (p.id === room.myId && mine && !fresh) {
        const s = c.score(st.dice);
        return `<td class="pick ${s ? '' : 'zero'} ${pending === c.id ? 'chosen' : ''}" data-cat="${c.id}">${s}</td>`;
      }
      return '<td></td>';
    };
    const row = (c) => `<tr><td>${c.name}${c.hint ? `<small>${c.hint}</small>` : ''}</td>${st.players.map((p) => cell(p, c)).join('')}</tr>`;
    const upper = CATS.filter((c) => c.upper).map(row).join('');
    const bonus = `<tr><td>โบนัส<small>เลข 1–6 รวม ≥ ${BONUS_AT} ได้ +${BONUS}</small></td>${st.players.map((p) => {
      const u = upperSum(st.cards[p.id]);
      return `<td>${u >= BONUS_AT ? `+${BONUS}` : `<small>${u}/${BONUS_AT}</small>`}</td>`;
    }).join('')}</tr>`;
    const lower = CATS.filter((c) => !c.upper).map(row).join('');
    const sum = `<tr class="sum"><td>รวม</td>${st.players.map((p) => `<td>${total(st.cards[p.id])}</td>`).join('')}</tr>`;

    el.innerHTML = `
      <div class="tray">
        <div class="muted">รอบที่ ${Math.min(st.round, ROUNDS)}/${ROUNDS}</div>
        <div class="dice">${dice}</div>
        <div class="status">${status}</div>
        <div class="row">${actions}</div>
        ${st.log ? `<div class="muted">${escapeHtml(st.log)}</div>` : ''}
      </div>
      <div class="card-wrap"><table class="card"><thead><tr><th>ช่อง</th>${head}</tr></thead>
        <tbody>${upper}${bonus}${lower}${sum}</tbody></table></div>`;
  }

  if (room.isHost) hostNext = hostLogic(room);
}

// ---------- host ----------
function hostLogic(room) {
  let S;
  const roll = () => 1 + (crypto.getRandomValues(new Uint32Array(1))[0] % 6);

  function newGame() {
    const players = room.players.map(({ id, name, color, bot }) => ({ id, name, color, bot: !!bot }));
    S = {
      type: 'state', players, cards: Object.fromEntries(players.map((p) => [p.id, {}])),
      turn: players[0].id, round: 1, dice: [1, 1, 1, 1, 1], held: [false, false, false, false, false],
      rollsLeft: 3, rollId: 0, over: false, log: '',
    };
    push();
  }

  function nextTurn() {
    const n = S.players.length;
    const cur = S.players.findIndex((p) => p.id === S.turn);
    for (let k = 1; k <= n; k++) {
      const j = (cur + k) % n;
      if (S.players[j].left) continue;
      if (j <= cur) S.round++;
      S.turn = S.players[j].id;
      S.held = [false, false, false, false, false];
      S.rollsLeft = 3;
      if (S.round > ROUNDS) S.over = true;
      return;
    }
    S.over = true;
  }

  function handle(d, from) {
    if (!S || S.over || from !== S.turn) return;
    const name = S.players.find((p) => p.id === from)?.name;
    if (d.type === 'roll' && S.rollsLeft > 0) {
      S.dice = S.dice.map((v, i) => (S.held[i] && S.rollsLeft < 3 ? v : roll()));
      S.rollsLeft--;
      S.rollId++;
    } else if (d.type === 'hold' && S.rollsLeft < 3 && S.rollsLeft > 0) {
      if (Array.isArray(d.held) && d.held.length === 5) S.held = d.held.map(Boolean);
      else if (Number.isInteger(d.i) && d.i >= 0 && d.i < 5) S.held[d.i] = !S.held[d.i];
      else return;
    } else if (d.type === 'score' && S.rollsLeft < 3 && CAT[d.cat] && S.cards[from][d.cat] == null) {
      const v = CAT[d.cat].score(S.dice);
      S.cards[from][d.cat] = v;
      S.log = `${name} ลง ${v} แต้มที่ "${CAT[d.cat].name}"`;
      nextTurn();
    } else return;
    push();
  }

  function decide(id) {
    if (!S || S.over || S.turn !== id) return null;
    if (S.rollsLeft === 3) return { type: 'roll' };
    const card = S.cards[id];
    const plan = botPlan(S.dice, card);
    if (!S.rollsLeft || plan.stop) return { type: 'score', cat: bestCategory(S.dice, card) };
    if (plan.held.some((h, i) => h !== S.held[i])) return { type: 'hold', held: plan.held };
    return { type: 'roll' };
  }
  const kick = botRunner(room, decide, handle, 650);

  function push() { room.broadcast(S); kick(); }

  room.on('input', handle);
  room.on('leave', (id) => {
    const p = S?.players.find((x) => x.id === id);
    if (!p) return;
    p.left = true;
    if (S.turn === id && !S.over) nextTurn();
    push();
  });

  newGame();
  return newGame;
}
