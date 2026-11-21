import { createLobby } from '../../js/lobby.js';
import { COLORS, escapeHtml } from '../../js/net.js';
import { newDeck, cardsHTML, backHTML } from '../../js/cards.js';
import { evaluate, settle } from './rules.js';
import { botRunner } from '../../js/bots.js';
import { t, tl, addStrings, onLang } from '../../js/i18n.js';

addStrings({
  th: {
    'pd.h.pok': 'ป็อก {pts}', 'pd.h.pts': '{pts} แต้ม', 'pd.h.tong': 'ตอง', 'pd.h.sf': 'สเตรทฟลัช', 'pd.h.straight': 'เรียง', 'pd.h.sian': 'เซียน',
    'pd.deng': ' · {n} เด้ง', 'pd.even': 'เสมอ', 'pd.dealer': 'เจ้ามือ', 'pd.bet': 'เดิมพัน {n}',
    'pd.i.bet': 'รอผู้เล่นวางเดิมพัน ({a}/{b})', 'pd.i.draw': 'ผู้เล่นตัดสินใจว่าจะจั่วใบที่ 3 หรือไม่',
    'pd.i.dealer': 'รอเจ้ามือ {name} ตัดสินใจ', 'pd.i.result': 'สรุปผลรอบที่ {n}', 'pd.i.ended': 'ผู้เล่นไม่พอ เกมจบแล้ว',
    'pd.a.youDeal': 'คุณเป็นเจ้ามือรอบนี้ รอผู้เล่นวางเดิมพัน...', 'pd.a.placeBet': 'วางเดิมพัน:', 'pd.a.waitBets': 'รอคนอื่นวางเดิมพัน...',
    'pd.a.pokWait': 'ป็อก! รอเปิดไพ่', 'pd.a.waitOthers': 'รอคนอื่นตัดสินใจ...', 'pd.a.draw': 'จั่วไพ่', 'pd.a.stay': 'ไม่จั่ว',
    'pd.a.waitPlayers': 'รอผู้เล่นตัดสินใจ...', 'pd.a.stayShow': 'ไม่จั่ว · เปิดไพ่', 'pd.a.waitDealer': 'รอเจ้ามือ...',
    'pd.a.next': 'รอบต่อไป', 'pd.a.waitNext': 'รอหัวหน้าห้องเริ่มรอบต่อไป',
    'pd.roundInfo': 'รอบที่ {n} · เจ้ามือ:', 'pd.yourCards': 'ไพ่ของคุณ', 'pd.noCards': 'ยังไม่ได้รับไพ่',
    'pd.l.dealerIs': '{name} เป็นเจ้ามือ ผู้เล่นวางเดิมพันได้เลย', 'pd.l.dealerPok': 'เจ้ามือ{hand}!', 'pd.l.poks': '{names} ป็อก!',
    'pd.l.dealt': 'แจกไพ่แล้ว', 'pd.l.dealerTurn': 'ผู้เล่นตัดสินใจครบแล้ว ถึงตาเจ้ามือ', 'pd.l.dealerDrew': 'เจ้ามือจั่วไพ่ใบที่ 3',
    'pd.l.dealerStay': 'เจ้ามือไม่จั่ว', 'pd.l.dealerLeft': 'เจ้ามือออกจากเกม ยกเลิกรอบนี้',
  },
  en: {
    'pd.h.pok': 'Pok {pts}', 'pd.h.pts': '{pts} points', 'pd.h.tong': 'Three of a kind', 'pd.h.sf': 'Straight flush', 'pd.h.straight': 'Straight', 'pd.h.sian': 'Court cards',
    'pd.deng': ' · {n}× deng', 'pd.even': 'Push', 'pd.dealer': 'Dealer', 'pd.bet': 'Bet {n}',
    'pd.i.bet': 'Waiting for bets ({a}/{b})', 'pd.i.draw': 'Players decide whether to draw a 3rd card',
    'pd.i.dealer': 'Waiting for dealer {name}', 'pd.i.result': 'Round {n} results', 'pd.i.ended': 'Not enough players, game over',
    'pd.a.youDeal': "You're the dealer this round, waiting for bets...", 'pd.a.placeBet': 'Place a bet:', 'pd.a.waitBets': 'Waiting for the other bets...',
    'pd.a.pokWait': 'Pok! Waiting for the reveal', 'pd.a.waitOthers': 'Waiting for the others...', 'pd.a.draw': 'Draw', 'pd.a.stay': 'Stay',
    'pd.a.waitPlayers': 'Waiting for the players...', 'pd.a.stayShow': 'Stay · reveal', 'pd.a.waitDealer': 'Waiting for the dealer...',
    'pd.a.next': 'Next round', 'pd.a.waitNext': 'Waiting for the host to start the next round',
    'pd.roundInfo': 'Round {n} · Dealer:', 'pd.yourCards': 'Your cards', 'pd.noCards': 'No cards yet',
    'pd.l.dealerIs': '{name} is the dealer, place your bets', 'pd.l.dealerPok': 'Dealer has {hand}!', 'pd.l.poks': '{names}: Pok!',
    'pd.l.dealt': 'Cards dealt', 'pd.l.dealerTurn': "Everyone's decided, dealer's turn", 'pd.l.dealerDrew': 'The dealer drew a 3rd card',
    'pd.l.dealerStay': 'The dealer stays', 'pd.l.dealerLeft': 'The dealer left, round cancelled',
  },
});

/** Hand data from the host → text in the viewer's language. */
const handText = (h) => (h ? t(`pd.h.${h.kind}`, { pts: h.pts }) + (h.deng > 1 ? t('pd.deng', { n: h.deng }) : '') : '');

const BETS = [10, 20, 50, 100];

createLobby({ title: 'g.pokdeng', minPlayers: 2, maxPlayers: 6, bots: true, onStart });

const money = (n) => (n > 0 ? `+${n}` : `${n}`);
const deltaBadge = (d) => (d == null ? '' : `<span class="badge ${d > 0 ? 'good' : d < 0 ? 'bad' : ''}">${d === 0 ? t('pd.even') : money(d)}</span>`);

function onStart(room) {
  const el = document.getElementById('table');
  let st = null;
  let hostNext = null;

  room.on('message', (m) => { if (m.type === 'state') { st = m; window.__st = m; render(); } });
  onLang(() => st && render());
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
        <div class="who"><span class="n">${escapeHtml(p.name)}${p.left ? ` ${t('c.left')}` : ''}</span>${isD ? `<span class="badge gold">${t('pd.dealer')}</span>` : ''}</div>
        <div class="meta"><span>💰 ${money(p.balance)}</span><span>${!isD && p.bet ? t('pd.bet', { n: p.bet }) : ''}</span></div>
        <div class="cards">${cards}</div>
        <div class="meta">${p.hand ? `<span class="badge">${handText(p.hand)}</span>` : ''}${deltaBadge(p.delta)}</div>
      </div>`;
    };

    const info = {
      bet: t('pd.i.bet', { a: st.players.filter((p) => p.bet).length, b: st.players.filter((p) => !p.left).length - 1 }),
      draw: t('pd.i.draw'),
      dealer: escapeHtml(t('pd.i.dealer', { name: dealer?.name || '' })),
      result: t('pd.i.result', { n: st.round }),
      ended: t('pd.i.ended'),
    }[st.phase];

    let actions = '';
    if (st.phase === 'bet') {
      if (amDealer) actions = `<span class="muted">${t('pd.a.youDeal')}</span>`;
      else if (!me.bet) actions = `<span class="muted">${t('pd.a.placeBet')}</span>${BETS.map((b) => `<button class="btn primary" data-act="bet" data-amount="${b}">${b}</button>`).join('')}`;
      else actions = `<span class="muted">${t('pd.a.waitBets')}</span>`;
    } else if (st.phase === 'draw' && !amDealer) {
      actions = me.decided ? `<span class="muted">${me.cards.length === 2 && me.hand?.kind === 'pok' ? t('pd.a.pokWait') : t('pd.a.waitOthers')}</span>`
        : `<button class="btn primary" data-act="draw">${t('pd.a.draw')}</button><button class="btn" data-act="stay">${t('pd.a.stay')}</button>`;
    } else if (st.phase === 'draw' && amDealer) {
      actions = `<span class="muted">${t('pd.a.waitPlayers')}</span>`;
    } else if (st.phase === 'dealer') {
      actions = amDealer ? `<button class="btn primary" data-act="draw">${t('pd.a.draw')}</button><button class="btn" data-act="stay">${t('pd.a.stayShow')}</button>`
        : `<span class="muted">${t('pd.a.waitDealer')}</span>`;
    } else if (st.phase === 'result') {
      actions = room.isHost ? `<button class="btn primary big" data-act="next">${t('pd.a.next')}</button>` : `<span class="muted">${t('pd.a.waitNext')}</span>`;
    }

    el.innerHTML = `
      <div class="seats">${st.players.filter((p) => p.id !== room.myId).map(seat).join('')}</div>
      <div class="felt">
        <div class="info">${t('pd.roundInfo', { n: st.round })} <b>${escapeHtml(dealer?.name || '-')}</b></div>
        <div class="pot">${info}</div>
        <div class="info">${escapeHtml(tl(st.log))}</div>
      </div>
      <div class="mine ${waiting(me) ? 'turn' : ''}">
        <div class="label">${t('pd.yourCards')} ${amDealer ? `<span class="badge gold">${t('pd.dealer')}</span>` : ''} · 💰 ${money(me.balance)} ${!amDealer && me.bet ? `· ${t('pd.bet', { n: me.bet })}` : ''}</div>
        <div class="cards">${me.cards?.length ? cardsHTML(me.cards, { size: 'lg' }) : `<span class="muted">${t('pd.noCards')}</span>`}</div>
        <div>${me.hand ? `<span class="badge">${handText(me.hand)}</span>` : ''} ${deltaBadge(me.delta)}</div>
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
    S.log = { k: 'pd.l.dealerIs', p: { name: dealer().name } };
    push();
  }

  function deal() {
    for (let k = 0; k < 2; k++) for (const p of active()) p.cards.push(S.deck.pop());
    if (evaluate(dealer().cards).pok) { const dh = evaluate(dealer().cards);
      S.log = { k: 'pd.l.dealerPok', p: { hand: { k: 'pd.h.pok', p: { pts: dh.pts } } } }; showdown(); return; }
    const poks = [];
    for (const p of punters()) {
      if (evaluate(p.cards).pok) { p.decided = true; p.revealed = true; poks.push(p.name); }
    }
    S.phase = 'draw';
    S.log = poks.length ? { k: 'pd.l.poks', p: { names: poks } } : { k: 'pd.l.dealt' };
    afterDecision();
  }

  function afterDecision() {
    if (S.phase === 'draw' && punters().every((p) => p.decided)) {
      S.phase = 'dealer';
      S.log = { k: 'pd.l.dealerTurn' };
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
      if (d.type === 'draw') { p.cards.push(S.deck.pop()); S.log = { k: 'pd.l.dealerDrew' }; } else S.log = { k: 'pd.l.dealerStay' };
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
      S.log = { k: 'pd.l.dealerLeft' };
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
          hand: visible && p.cards.length >= 2 ? (({ kind, pts, deng }) => ({ kind, pts, deng }))(evaluate(p.cards)) : null,
        };
      }),
    };
  }

  function push() { for (const p of active()) room.sendTo(p.id, view(p.id)); kick(); }

  newRound();
  return newRound;
}
