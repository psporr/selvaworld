import { createLobby } from '../../js/lobby.js';
import { COLORS, escapeHtml } from '../../js/net.js';
import { newDeck, cardsHTML, backHTML } from '../../js/cards.js';
import { evaluate, settle } from './rules.js';
import { botRunner } from '../../js/bots.js';

const BETS = [10, 20, 50, 100];

createLobby({ title: '🃏 ป็อกเด้ง', minPlayers: 2, maxPlayers: 6, bots: true, onStart });

const money = (n) => (n > 0 ? `+${n}` : `${n}`);
const deltaBadge = (d) => (d == null ? '' : `<span class="badge ${d > 0 ? 'good' : d < 0 ? 'bad' : ''}">${d === 0 ? 'เสมอ' : money(d)}</span>`);

function onStart(room) {
  const el = document.getElementById('table');
  let st = null;
  let hostNext = null;

  room.on('message', (m) => { if (m.type === 'state') { st = m; window.__st = m; render(); } });
  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b || b.disabled) return;
    if (b.dataset.act === 'next') hostNext?.();
    else room.toHost({ type: b.dataset.act, amount: Number(b.dataset.amount) || 0 });
  });

  function render() {
    const me = st.players.find((p) => p.id === room.myId);
    const dealer = st.players.find((p) => p.id === st.dealerId);
    const amDealer = st.dealerId === room.myId;
    const waiting = (p) => !p.left && (
      (st.phase === 'bet' && p.id !== st.dealerId && !p.bet)
      || (st.phase === 'draw' && p.id !== st.dealerId && !p.decided)
      || (st.phase === 'dealer' && p.id === st.dealerId));

    const seat = (p) => {
      const cards = p.cards ? cardsHTML(p.cards, { size: 'sm' }) : backHTML('sm').repeat(p.nCards);
      const isD = p.id === st.dealerId;
      return `<div class="seat ${waiting(p) ? 'turn' : ''} ${p.left ? 'out' : ''}" style="--pc:${COLORS[p.color % COLORS.length]}">
        <div class="who"><span class="n">${escapeHtml(p.name)}${p.left ? ' (ออกแล้ว)' : ''}</span>${isD ? '<span class="badge gold">เจ้ามือ</span>' : ''}</div>
        <div class="meta"><span>💰 ${money(p.balance)}</span><span>${!isD && p.bet ? `เดิมพัน ${p.bet}` : ''}</span></div>
        <div class="cards">${cards}</div>
        <div class="meta">${p.hand ? `<span class="badge">${p.hand}</span>` : ''}${deltaBadge(p.delta)}</div>
      </div>`;
    };

    const info = {
      bet: `รอผู้เล่นวางเดิมพัน (${st.players.filter((p) => p.bet).length}/${st.players.filter((p) => !p.left).length - 1})`,
      draw: 'ผู้เล่นตัดสินใจว่าจะจั่วใบที่ 3 หรือไม่',
      dealer: `รอเจ้ามือ ${escapeHtml(dealer?.name || '')} ตัดสินใจ`,
      result: `สรุปผลรอบที่ ${st.round}`,
      ended: 'ผู้เล่นไม่พอ เกมจบแล้ว',
    }[st.phase];

    let actions = '';
    if (st.phase === 'bet') {
      if (amDealer) actions = '<span class="muted">คุณเป็นเจ้ามือรอบนี้ รอผู้เล่นวางเดิมพัน...</span>';
      else if (!me.bet) actions = `<span class="muted">วางเดิมพัน:</span>${BETS.map((b) => `<button class="btn primary" data-act="bet" data-amount="${b}">${b}</button>`).join('')}`;
      else actions = '<span class="muted">รอคนอื่นวางเดิมพัน...</span>';
    } else if (st.phase === 'draw' && !amDealer) {
      actions = me.decided ? `<span class="muted">${me.cards.length === 2 && me.hand?.startsWith('ป็อก') ? 'ป็อก! รอเปิดไพ่' : 'รอคนอื่นตัดสินใจ...'}</span>`
        : '<button class="btn primary" data-act="draw">จั่วไพ่</button><button class="btn" data-act="stay">ไม่จั่ว</button>';
    } else if (st.phase === 'draw' && amDealer) {
      actions = '<span class="muted">รอผู้เล่นตัดสินใจ...</span>';
    } else if (st.phase === 'dealer') {
      actions = amDealer ? '<button class="btn primary" data-act="draw">จั่วไพ่</button><button class="btn" data-act="stay">ไม่จั่ว · เปิดไพ่</button>'
        : '<span class="muted">รอเจ้ามือ...</span>';
    } else if (st.phase === 'result') {
      actions = room.isHost ? '<button class="btn primary big" data-act="next">รอบต่อไป</button>' : '<span class="muted">รอหัวหน้าห้องเริ่มรอบต่อไป</span>';
    }

    el.innerHTML = `
      <div class="seats">${st.players.filter((p) => p.id !== room.myId).map(seat).join('')}</div>
      <div class="felt">
        <div class="info">รอบที่ ${st.round} · เจ้ามือ: <b>${escapeHtml(dealer?.name || '-')}</b></div>
        <div class="pot">${info}</div>
        <div class="info">${escapeHtml(st.log || '')}</div>
      </div>
      <div class="mine ${waiting(me) ? 'turn' : ''}">
        <div class="label">ไพ่ของคุณ ${amDealer ? '<span class="badge gold">เจ้ามือ</span>' : ''} · 💰 ${money(me.balance)} ${!amDealer && me.bet ? `· เดิมพัน ${me.bet}` : ''}</div>
        <div class="cards">${me.cards?.length ? cardsHTML(me.cards, { size: 'lg' }) : '<span class="muted">ยังไม่ได้รับไพ่</span>'}</div>
        <div>${me.hand ? `<span class="badge">${me.hand}</span>` : ''} ${deltaBadge(me.delta)}</div>
        <div class="actions">${actions}</div>
      </div>`;
  }

  if (room.isHost) hostNext = hostLogic(room);
}

// ---------- host: authoritative rules ----------
function hostLogic(room) {
  const S = {
    round: 0, dealerIdx: -1, phase: 'bet', deck: [], log: '',
    players: room.players.map(({ id, name, color }) => ({ id, name, color, balance: 0, cards: [] })),
  };
  const dealer = () => S.players[S.dealerIdx];
  const active = () => S.players.filter((p) => !p.left);
  const punters = () => active().filter((p) => p !== dealer());

  function newRound() {
    const n = S.players.length;
    let next = null;
    for (let k = 1; k <= n; k++) {
      const p = S.players[(S.dealerIdx + k + n) % n];
      if (!p.left) { next = p; break; }
    }
    S.players = S.players.filter((p) => !p.left);
    if (S.players.length < 2) { S.phase = 'ended'; push(); return; }
    S.dealerIdx = S.players.indexOf(next);
    S.round++;
    for (const p of S.players) Object.assign(p, { cards: [], bet: 0, decided: false, revealed: false, delta: null });
    S.deck = newDeck();
    S.phase = 'bet';
    S.log = `${dealer().name} เป็นเจ้ามือ ผู้เล่นวางเดิมพันได้เลย`;
    push();
  }

  function deal() {
    for (let k = 0; k < 2; k++) for (const p of active()) p.cards.push(S.deck.pop());
    if (evaluate(dealer().cards).pok) { S.log = `เจ้ามือ${evaluate(dealer().cards).label}!`; showdown(); return; }
    const poks = [];
    for (const p of punters()) {
      if (evaluate(p.cards).pok) { p.decided = true; p.revealed = true; poks.push(p.name); }
    }
    S.phase = 'draw';
    S.log = poks.length ? `${poks.join(', ')} ป็อก!` : 'แจกไพ่แล้ว';
    afterDecision();
  }

  function afterDecision() {
    if (S.phase === 'draw' && punters().every((p) => p.decided)) {
      S.phase = 'dealer';
      S.log = 'ผู้เล่นตัดสินใจครบแล้ว ถึงตาเจ้ามือ';
    }
    push();
  }

  function showdown() {
    const d = dealer();
    d.delta = 0;
    for (const p of punters()) {
      p.delta = settle(p.cards, d.cards, p.bet);
      p.balance += p.delta;
      d.delta -= p.delta;
    }
    d.balance += d.delta;
    for (const p of S.players) p.revealed = true;
    S.phase = 'result';
    push();
  }

  function handle(d, from) {
    const p = active().find((x) => x.id === from);
    if (!p) return;
    const isDealer = p === dealer();
    if (S.phase === 'bet' && d.type === 'bet' && !isDealer && !p.bet && BETS.includes(d.amount)) {
      p.bet = d.amount;
      if (punters().every((x) => x.bet)) deal(); else push();
    } else if (S.phase === 'draw' && !isDealer && !p.decided && (d.type === 'draw' || d.type === 'stay')) {
      if (d.type === 'draw') p.cards.push(S.deck.pop());
      p.decided = true;
      afterDecision();
    } else if (S.phase === 'dealer' && isDealer && (d.type === 'draw' || d.type === 'stay')) {
      if (d.type === 'draw') { p.cards.push(S.deck.pop()); S.log = 'เจ้ามือจั่วไพ่ใบที่ 3'; } else S.log = 'เจ้ามือไม่จั่ว';
      showdown();
    }
  }
  room.on('input', handle);

  // bot: random bet, draw a third card on 4 points or fewer
  function decide(id) {
    const p = active().find((x) => x.id === id);
    if (!p) return null;
    const isDealer = p === dealer();
    const drawOrStay = () => ({ type: evaluate(p.cards).pts <= 4 ? 'draw' : 'stay' });
    if (S.phase === 'bet' && !isDealer && !p.bet) return { type: 'bet', amount: BETS[Math.floor(Math.random() * BETS.length)] };
    if (S.phase === 'draw' && !isDealer && !p.decided) return drawOrStay();
    if (S.phase === 'dealer' && isDealer) return drawOrStay();
    return null;
  }
  const kick = botRunner(room, decide, handle);

  room.on('leave', (id) => {
    const p = S.players.find((x) => x.id === id);
    if (!p) return;
    p.left = true;
    if (active().length < 2) { S.phase = 'ended'; push(); return; }
    if (S.phase === 'result') { push(); return; }
    if (p === dealer()) {
      for (const x of S.players) x.revealed = true;
      S.phase = 'result';
      S.log = 'เจ้ามือออกจากเกม ยกเลิกรอบนี้';
      push();
    } else if (S.phase === 'bet') {
      if (punters().every((x) => x.bet)) deal(); else push();
    } else afterDecision();
  });

  function view(id) {
    return {
      type: 'state', phase: S.phase, round: S.round, log: S.log, dealerId: dealer()?.id,
      players: S.players.map((p) => {
        const visible = p.id === id || p.revealed;
        return {
          id: p.id, name: p.name, color: p.color, balance: p.balance, bet: p.bet, left: !!p.left,
          decided: p.decided, delta: p.delta, nCards: p.cards.length,
          cards: visible ? p.cards : null,
          hand: visible && p.cards.length >= 2 ? evaluate(p.cards).label : null,
        };
      }),
    };
  }

  function push() { for (const p of active()) room.sendTo(p.id, view(p.id)); kick(); }

  newRound();
  return newRound;
}
