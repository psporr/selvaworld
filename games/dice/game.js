import { createLobby } from '../../js/lobby.js';
import { COLORS, escapeHtml } from '../../js/net.js';
import { botRunner } from '../../js/bots.js';
import { t, tl, addStrings, onLang } from '../../js/i18n.js';
import { CATS, CAT, ROUNDS, BONUS, BONUS_AT, upperSum, total, bestCategory, botPlan } from './rules.js';

addStrings({
  th: {
    'dc.c.ones': 'เลข 1', 'dc.c.twos': 'เลข 2', 'dc.c.threes': 'เลข 3', 'dc.c.fours': 'เลข 4', 'dc.c.fives': 'เลข 5', 'dc.c.sixes': 'เลข 6',
    'dc.c.choice': 'อิสระ', 'dc.c.four': 'โฟร์', 'dc.c.full': 'ฟูลเฮาส์', 'dc.c.small': 'เรียงเล็ก', 'dc.c.large': 'เรียงใหญ่', 'dc.c.yacht': 'ยอด!',
    'dc.h.choice': 'รวมทุกลูก', 'dc.h.four': 'เหมือนกัน 4 ลูก = รวมทุกลูก', 'dc.h.full': '3+2 = รวมทุกลูก', 'dc.h.small': 'เรียง 4 ลูก = 15',
    'dc.h.large': 'เรียง 5 ลูก = 30', 'dc.h.yacht': 'เหมือนกัน 5 ลูก = 50',
    'dc.tie': 'เสมอ! {n} คะแนน 🤝', 'dc.win': '🏆 {name} ชนะ {n} คะแนน!', 'dc.waitRestart': 'รอหัวหน้าห้องเริ่มใหม่',
    'dc.yourTurn': 'ตาคุณ! กดทอยลูกเต๋า', 'dc.holdOrScore': 'แตะลูกเต๋าเพื่อเก็บไว้ แล้วทอยใหม่ หรือเลือกช่องลงคะแนน',
    'dc.mustScore': 'ทอยครบแล้ว เลือกช่องลงคะแนน', 'dc.roll': '🎲 ทอย (เหลือ {n})', 'dc.scoreBtn': 'ลง {n} แต้มที่ "{cat}"',
    'dc.turnOf': 'ตาของ {name}...', 'dc.bonus': 'โบนัส', 'dc.bonusHint': 'เลข 1–6 รวม ≥ {at} ได้ +{b}', 'dc.total': 'รวม',
    'dc.round': 'รอบที่ {n}/{max}', 'dc.category': 'ช่อง', 'dc.held': 'เก็บ', 'dc.l.scored': '{name} ลง {n} แต้มที่ "{cat}"',
  },
  en: {
    'dc.c.ones': 'Ones', 'dc.c.twos': 'Twos', 'dc.c.threes': 'Threes', 'dc.c.fours': 'Fours', 'dc.c.fives': 'Fives', 'dc.c.sixes': 'Sixes',
    'dc.c.choice': 'Choice', 'dc.c.four': 'Four of a kind', 'dc.c.full': 'Full house', 'dc.c.small': 'Small straight', 'dc.c.large': 'Large straight', 'dc.c.yacht': 'Yacht!',
    'dc.h.choice': 'Sum of all dice', 'dc.h.four': '4 alike = sum of all dice', 'dc.h.full': '3+2 = sum of all dice', 'dc.h.small': '4 in a row = 15',
    'dc.h.large': '5 in a row = 30', 'dc.h.yacht': '5 alike = 50',
    'dc.tie': "It's a tie at {n} points! 🤝", 'dc.win': '🏆 {name} wins with {n} points!', 'dc.waitRestart': 'Waiting for the host to restart',
    'dc.yourTurn': 'Your turn! Roll the dice', 'dc.holdOrScore': 'Tap dice to keep them, then roll again, or pick a category to score',
    'dc.mustScore': 'No rolls left, pick a category to score', 'dc.roll': '🎲 Roll ({n} left)', 'dc.scoreBtn': 'Score {n} in "{cat}"',
    'dc.turnOf': "{name}'s turn...", 'dc.bonus': 'Bonus', 'dc.bonusHint': 'Ones–Sixes total ≥ {at}: +{b}', 'dc.total': 'Total',
    'dc.round': 'Round {n}/{max}', 'dc.category': 'Category', 'dc.held': 'Keep', 'dc.l.scored': '{name} scored {n} in "{cat}"',
  },
});

createLobby({ title: 'g.dice', minPlayers: 1, maxPlayers: 6, bots: true, onStart });

const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
const dieHTML = (v, i, cls = '') => `<div class="die ${cls}" data-i="${i}" data-held="${t('dc.held')}">${Array.from({ length: 9 }, (_, k) => `<i class="${PIPS[v]?.includes(k) ? 'on' : ''}"></i>`).join('')}</div>`;

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

  onLang(() => st && render(false));

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
      status = tie ? t('dc.tie', { n: top }) : escapeHtml(t('dc.win', { name: ranked[0].name, n: top }));
      actions = room.isHost ? `<button class="btn primary" data-act="again">${t('c.again')}</button>` : `<span class="muted">${t('dc.waitRestart')}</span>`;
    } else if (mine) {
      status = fresh ? t('dc.yourTurn') : st.rollsLeft ? t('dc.holdOrScore') : t('dc.mustScore');
      actions = `<button class="btn primary" data-act="roll" ${st.rollsLeft ? '' : 'disabled'}>${t('dc.roll', { n: st.rollsLeft })}</button>`;
      if (pending) actions += `<button class="btn" data-act="score">${t('dc.scoreBtn', { n: CAT[pending].score(st.dice), cat: { k: `dc.c.${pending}` } })}</button>`;
    } else {
      status = escapeHtml(t('dc.turnOf', { name: cur?.name || '' }));
    }

    const head = st.players.map((p) => `<th class="${p.id === st.turn && !st.over ? 'turn' : ''}" style="--pc:${COLORS[p.color % COLORS.length]}">${p.bot ? '🤖' : ''}${escapeHtml(p.name)}${p.id === room.myId ? `<br><small>${t('c.you')}</small>` : ''}</th>`).join('');
    const cell = (p, c) => {
      const v = st.cards[p.id][c.id];
      if (v != null) return `<td class="filled">${v}</td>`;
      if (p.id === room.myId && mine && !fresh) {
        const s = c.score(st.dice);
        return `<td class="pick ${s ? '' : 'zero'} ${pending === c.id ? 'chosen' : ''}" data-cat="${c.id}">${s}</td>`;
      }
      return '<td></td>';
    };
    const row = (c) => `<tr><td>${t(`dc.c.${c.id}`)}${c.upper ? '' : `<small>${t(`dc.h.${c.id}`)}</small>`}</td>${st.players.map((p) => cell(p, c)).join('')}</tr>`;
    const upper = CATS.filter((c) => c.upper).map(row).join('');
    const bonus = `<tr><td>${t('dc.bonus')}<small>${t('dc.bonusHint', { at: BONUS_AT, b: BONUS })}</small></td>${st.players.map((p) => {
      const u = upperSum(st.cards[p.id]);
      return `<td>${u >= BONUS_AT ? `+${BONUS}` : `<small>${u}/${BONUS_AT}</small>`}</td>`;
    }).join('')}</tr>`;
    const lower = CATS.filter((c) => !c.upper).map(row).join('');
    const sum = `<tr class="sum"><td>${t('dc.total')}</td>${st.players.map((p) => `<td>${total(st.cards[p.id])}</td>`).join('')}</tr>`;

    el.innerHTML = `
      <div class="tray">
        <div class="muted">${t('dc.round', { n: Math.min(st.round, ROUNDS), max: ROUNDS })}</div>
        <div class="dice">${dice}</div>
        <div class="status">${status}</div>
        <div class="row">${actions}</div>
        ${st.log ? `<div class="muted">${escapeHtml(tl(st.log))}</div>` : ''}
      </div>
      <div class="card-wrap"><table class="card"><thead><tr><th>${t('dc.category')}</th>${head}</tr></thead>
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
      S.log = { k: 'dc.l.scored', p: { name, n: v, cat: { k: `dc.c.${d.cat}` } } };
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
