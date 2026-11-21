import { createLobby } from '../../js/lobby.js';
import { COLORS, escapeHtml } from '../../js/net.js';
import { newDeck, cardsHTML, backHTML, rankOf, suitOf } from '../../js/cards.js';
import { botRunner } from '../../js/bots.js';
import { best, describe, splitPots } from './rules.js';

const START_CHIPS = 1000;
const SB = 10;
const BB = 20;
const STREET_NAME = { preflop: 'พรีฟล็อป', flop: 'ฟล็อป', turn: 'เทิร์น', river: 'ริเวอร์', showdown: 'โชว์ดาวน์' };

createLobby({ title: '♠️ โป๊กเกอร์', minPlayers: 2, maxPlayers: 6, bots: true, onStart });

function onStart(room) {
  const el = document.getElementById('table');
  let st = null;
  let hostNext = null;

  room.on('message', (m) => { if (m.type === 'state') { st = m; window.__st = m; render(); } });

  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b || b.disabled) return;
    const act = b.dataset.act;
    const input = el.querySelector('#raise-to');
    if (act === 'next') hostNext?.();
    else if (act === 'preset') { input.value = b.dataset.to; }
    else if (act === 'raise') room.toHost({ type: 'raise', to: Number(input.value) });
    else room.toHost({ type: act });
  });

  function render() {
    const me = st.players.find((p) => p.id === room.myId);
    const name = (id) => escapeHtml(st.players.find((p) => p.id === id)?.name || '');
    const myTurn = st.phase === 'play' && st.toAct === room.myId;

    const seat = (p) => {
      let cards = '';
      if (p.hole) cards = cardsHTML(p.hole, { size: 'sm' });
      else if (p.inHand && !p.folded) cards = backHTML('sm').repeat(2);
      const status = p.out ? '<span class="badge bad">หมดตัว</span>'
        : p.folded ? '<span class="badge">หมอบ</span>'
        : p.allIn ? '<span class="badge gold">ออลอิน</span>'
        : p.act ? `<span class="badge">${p.act}</span>` : '';
      return `<div class="seat ${st.toAct === p.id && st.phase === 'play' ? 'turn' : ''} ${p.folded || p.out || p.left ? 'out' : ''}" style="--pc:${COLORS[p.color % COLORS.length]}">
        <div class="who"><span class="n">${escapeHtml(p.name)}${p.left ? ' (ออกแล้ว)' : ''}</span>${p.id === st.dealerId ? '<span class="badge gold">D</span>' : ''}</div>
        <div class="meta"><span>🪙 ${p.chips}</span><span>${p.bet ? `เดิมพัน ${p.bet}` : ''}</span></div>
        <div class="cards">${cards}</div>
        <div class="meta">${status}${p.handName ? `<span class="badge">${p.handName}</span>` : ''}${p.won ? `<span class="badge good">+${p.won}</span>` : ''}</div>
      </div>`;
    };

    const board = st.board.map((c) => cardsHTML([c])).join('') + '<div class="pcard back" style="opacity:.15"></div>'.repeat(5 - st.board.length);
    let center = `<div class="info">มือที่ ${st.hand} · ${STREET_NAME[st.street] || ''}</div>
      <div class="cards">${board}</div>
      <div class="pot">พอต ${st.pot}</div>`;
    if (st.results) {
      center += `<div class="info">${st.results.map((r) =>
        `${r.winners.map(name).join(' และ ')} ได้ ${r.amount}${r.hand ? ` ด้วย${r.hand}` : ''}`).join('<br>')}</div>`;
    } else center += `<div class="info">${escapeHtml(st.log || '')}</div>`;
    if (st.phase === 'gameover') center = `<div class="pot">🏆 ${name(st.winner)} ชนะเกมนี้!</div><div class="info">เก็บชิปได้ทั้งหมด</div>`;

    let actions = '';
    if (st.phase === 'play' && myTurn) {
      const toCall = st.currentBet - me.bet;
      const maxTo = me.bet + me.chips;
      const minTo = Math.min(st.currentBet + st.minRaise, maxTo);
      const callAmt = Math.min(toCall, me.chips);
      const pot = st.pot;
      const presets = [
        ['½ พอต', st.currentBet + Math.round((pot + toCall) / 2)],
        ['พอต', st.currentBet + pot + toCall],
      ].map(([l, v]) => [l, Math.max(minTo, Math.min(maxTo, v))]);
      actions = `<button class="btn" data-act="fold">หมอบ</button>
        ${toCall <= 0 ? '<button class="btn primary" data-act="check">เช็ค</button>'
          : `<button class="btn primary" data-act="call">${callAmt >= me.chips ? `คอลออลอิน ${callAmt}` : `คอล ${callAmt}`}</button>`}
        ${maxTo > st.currentBet ? `
          <span class="actions">
            <input id="raise-to" type="number" min="${minTo}" max="${maxTo}" step="10" value="${minTo}">
            <button class="btn primary" data-act="raise">${st.currentBet ? 'เรสเป็น' : 'เบท'}</button>
            ${presets.map(([l, v]) => `<button class="btn ghost" data-act="preset" data-to="${v}">${l}</button>`).join('')}
            <button class="btn" data-act="allin">ออลอิน ${me.chips}</button>
          </span>` : ''}`;
    } else if (st.phase === 'play') {
      actions = st.toAct ? `<span class="muted">รอ ${name(st.toAct)}...</span>` : '<span class="muted">กำลังเปิดไพ่...</span>';
    } else if (st.phase === 'handover') {
      actions = room.isHost ? '<button class="btn primary big" data-act="next">แจกมือต่อไป</button>' : '<span class="muted">รอหัวหน้าห้องแจกมือต่อไป</span>';
    } else if (st.phase === 'gameover') {
      actions = room.isHost ? '<button class="btn primary big" data-act="next">เริ่มเกมใหม่ (ชิปคนละ 1000)</button>' : '<span class="muted">รอหัวหน้าห้องเริ่มเกมใหม่</span>';
    }

    const myHand = me.hole?.length ? describe([...me.hole, ...st.board]) : '';
    el.innerHTML = `
      <div class="seats">${st.players.filter((p) => p.id !== room.myId).map(seat).join('')}</div>
      <div class="felt">${center}</div>
      <div class="mine ${myTurn ? 'turn' : ''}">
        <div class="label">ไพ่ของคุณ · 🪙 ${me.chips} ${me.bet ? `· เดิมพัน ${me.bet}` : ''} ${me.id === st.dealerId ? '<span class="badge gold">D</span>' : ''}
          ${me.folded ? '<span class="badge">หมอบ</span>' : ''}${me.won ? `<span class="badge good">+${me.won}</span>` : ''}</div>
        <div class="cards">${me.hole?.length ? cardsHTML(me.hole, { size: 'lg' }) : '<span class="muted">ไม่ได้ร่วมมือนี้</span>'}</div>
        ${myHand ? `<span class="badge">${myHand}</span>` : ''}
        <div class="actions">${actions}</div>
      </div>`;
  }

  if (room.isHost) hostNext = hostLogic(room);
}

// ---------- host: authoritative rules ----------
function hostLogic(room) {
  const S = {
    hand: 0, dealer: -1, phase: 'play', street: 'preflop', board: [], deck: [],
    currentBet: 0, minRaise: BB, toAct: -1, need: new Set(), results: null, log: '', winner: null,
    players: room.players.map(({ id, name, color }) => ({ id, name, color, chips: START_CHIPS, hole: [] })),
  };
  const P = S.players;
  const n = P.length;
  const nextIdx = (from, pred) => {
    for (let k = 1; k <= n; k++) { const i = (((from + k) % n) + n) % n; if (pred(i)) return i; }
    return -1;
  };
  const seated = (i) => !P[i].left && P[i].chips > 0;
  const canAct = (p) => p.inHand && !p.folded && !p.allIn && !p.left;
  const pot = () => P.reduce((a, p) => a + (p.total || 0), 0);

  function put(p, x) {
    x = Math.min(x, p.chips);
    p.chips -= x; p.bet += x; p.total += x;
    if (p.chips === 0) p.allIn = true;
  }

  function startHand() {
    if (S.phase === 'gameover') for (const p of P) if (!p.left) p.chips = START_CHIPS;
    const live = P.filter((_, i) => seated(i));
    if (live.length < 2) { S.phase = 'gameover'; S.winner = live[0]?.id ?? null; push(); return; }
    S.hand++;
    S.dealer = nextIdx(S.dealer, seated);
    P.forEach((p, i) => Object.assign(p, {
      inHand: seated(i), hole: [], bet: 0, total: 0, folded: false, allIn: false, act: '', show: false, best: null, won: 0,
    }));
    S.deck = newDeck();
    S.board = [];
    S.results = null;
    S.phase = 'play';
    S.street = 'preflop';
    const inHand = (i) => P[i].inHand;
    const sb = live.length === 2 ? S.dealer : nextIdx(S.dealer, inHand);
    const bb = nextIdx(sb, inHand);
    put(P[sb], SB); P[sb].act = `SB ${P[sb].bet}`;
    put(P[bb], BB); P[bb].act = `BB ${P[bb].bet}`;
    for (let k = 0; k < 2; k++) for (let i = nextIdx(S.dealer, inHand), c = 0; c < live.length; c++, i = nextIdx(i, inHand)) P[i].hole.push(S.deck.pop());
    S.currentBet = BB;
    S.minRaise = BB;
    S.need = new Set(P.filter(canAct).map((p) => p.id));
    S.toAct = bb;
    S.log = `มือที่ ${S.hand} · บลายด์ ${SB}/${BB}`;
    proceed();
  }

  function proceed() {
    const live = P.filter((p) => p.inHand && !p.folded);
    if (live.length === 1) return awardSingle(live[0]);
    for (const id of [...S.need]) if (!canAct(P.find((p) => p.id === id))) S.need.delete(id);
    if (!S.need.size) return endStreet();
    S.toAct = nextIdx(S.toAct, (i) => S.need.has(P[i].id));
    push();
  }

  function endStreet() {
    for (const p of P) { p.bet = 0; if (canAct(p)) p.act = ''; }
    S.currentBet = 0;
    S.minRaise = BB;
    if (S.street === 'river') return showdown();
    S.street = { preflop: 'flop', flop: 'turn', turn: 'river' }[S.street];
    S.deck.pop(); // burn
    for (let k = 0; k < (S.street === 'flop' ? 3 : 1); k++) S.board.push(S.deck.pop());
    S.need = new Set(P.filter(canAct).map((p) => p.id));
    if (S.need.size <= 1) { // nobody left to bet against: run out the board
      S.need.clear();
      S.toAct = -1;
      push();
      const h = S.hand;
      setTimeout(() => { if (S.hand === h && S.phase === 'play') endStreet(); }, 1100);
      return;
    }
    S.toAct = S.dealer;
    proceed();
  }

  function awardSingle(p) {
    const amount = pot();
    p.chips += amount;
    p.won = amount;
    S.results = [{ amount, winners: [p.id], hand: null }];
    finishHand();
  }

  function showdown() {
    const live = P.filter((p) => p.inHand && !p.folded);
    for (const p of live) { p.best = best([...p.hole, ...S.board]); p.show = true; }
    const pots = splitPots(P.filter((p) => p.inHand).map((p) => ({ id: p.id, total: p.total, folded: p.folded, score: p.best?.score })));
    S.results = pots.map((pt) => {
      const share = Math.floor(pt.amount / pt.winners.length);
      pt.winners.forEach((id, k) => {
        const w = P.find((p) => p.id === id);
        const got = share + (k === 0 ? pt.amount - share * pt.winners.length : 0);
        w.chips += got;
        w.won += got;
      });
      const w0 = P.find((p) => p.id === pt.winners[0]);
      return { amount: pt.amount, winners: pt.winners, hand: w0.best?.name };
    });
    S.street = 'showdown';
    finishHand();
  }

  function finishHand() {
    S.toAct = -1;
    S.need.clear();
    const alive = P.filter((p) => !p.left && p.chips > 0);
    if (alive.length < 2) { S.phase = 'gameover'; S.winner = alive[0]?.id ?? null; }
    else S.phase = 'handover';
    push();
  }

  function handle(d, from) {
    if (S.phase !== 'play' || S.toAct < 0) return;
    const p = P[S.toAct];
    if (p.id !== from) return;
    const toCall = S.currentBet - p.bet;
    switch (d.type) {
      case 'fold': p.folded = true; p.act = 'หมอบ'; break;
      case 'check': if (toCall > 0) return; p.act = 'เช็ค'; break;
      case 'call': if (toCall <= 0) return; put(p, toCall); p.act = p.allIn ? 'ออลอิน' : `คอล ${p.bet}`; break;
      case 'raise':
      case 'allin': {
        const maxTo = p.bet + p.chips;
        let to = d.type === 'allin' ? maxTo : Math.floor(Number(d.to) || 0);
        if (to > maxTo) to = maxTo;
        if (to <= S.currentBet) { // all-in that doesn't exceed the bet = call
          if (d.type !== 'allin' || toCall <= 0) return;
          put(p, toCall); p.act = 'ออลอิน'; break;
        }
        if (to < S.currentBet + S.minRaise && to < maxTo) return;
        const raiseBy = to - S.currentBet;
        if (raiseBy >= S.minRaise) S.minRaise = raiseBy;
        S.currentBet = to;
        put(p, to - p.bet);
        p.act = p.allIn ? 'ออลอิน' : `${toCall > 0 || S.street === 'preflop' ? 'เรส' : 'เบท'} ${to}`;
        S.need = new Set(P.filter((x) => canAct(x) && x !== p).map((x) => x.id)); // action reopens
        break;
      }
      default: return;
    }
    S.need.delete(p.id);
    proceed();
  }
  room.on('input', handle);

  // bot: rough hand strength 0–3, then raise / call / check / fold
  function strength(p) {
    if (!S.board.length) {
      const [a, b] = p.hole.map(rankOf).sort((x, y) => y - x);
      if (a === b) return a >= 10 ? 3 : 2;
      if (b >= 11) return 2;
      if (a >= 12 || (suitOf(p.hole[0]) === suitOf(p.hole[1]) && a - b === 1)) return 1;
      return 0;
    }
    const cat = best([...p.hole, ...S.board]).score[0];
    return cat >= 3 ? 3 : cat;
  }
  function decide(id) {
    if (S.phase !== 'play' || S.toAct < 0) return null;
    const p = P[S.toAct];
    if (p.id !== id) return null;
    const s = strength(p);
    const toCall = S.currentBet - p.bet;
    const maxTo = p.bet + p.chips;
    const r = Math.random();
    const raiseTo = (extra) => {
      const to = Math.min(maxTo, Math.max(S.currentBet + S.minRaise, S.currentBet + Math.round(extra / 10) * 10));
      return to > S.currentBet ? { type: 'raise', to } : { type: toCall > 0 ? 'call' : 'check' };
    };
    if (s === 3 && r < 0.6) return raiseTo(pot() / 2 + toCall);
    if (toCall <= 0) return s >= 2 && r < 0.4 ? raiseTo(pot() / 2) : { type: 'check' };
    const price = toCall / (pot() + toCall);
    if (s >= 2 || (s === 1 && price < 0.35) || (toCall <= BB && r < 0.7)) return { type: 'call' };
    return { type: 'fold' };
  }
  const kick = botRunner(room, decide, handle, 900);

  room.on('leave', (id) => {
    const p = P.find((x) => x.id === id);
    if (!p) return;
    p.left = true;
    if (S.phase !== 'play') { finishHandIfNeeded(); return; }
    if (p.inHand && !p.folded) { p.folded = true; p.act = 'ออกจากเกม'; }
    S.need.delete(id);
    const liveCount = P.filter((x) => x.inHand && !x.folded).length;
    if (S.toAct < 0) { if (liveCount === 1) proceed(); else push(); return; } // board is running out
    if (P[S.toAct] === p || P.filter((x) => x.inHand && !x.folded).length === 1) proceed();
    else push();
  });
  function finishHandIfNeeded() {
    if (P.filter((p) => !p.left).length < 2) { S.phase = 'gameover'; S.winner = P.find((p) => !p.left)?.id ?? null; }
    push();
  }

  function view(id) {
    return {
      type: 'state', phase: S.phase, street: S.street, hand: S.hand, board: S.board, pot: pot(),
      currentBet: S.currentBet, minRaise: S.minRaise, toAct: S.toAct >= 0 ? P[S.toAct].id : null,
      dealerId: P[S.dealer]?.id, log: S.log, results: S.results, winner: S.winner,
      players: P.map((p) => ({
        id: p.id, name: p.name, color: p.color, chips: p.chips, bet: p.bet || 0, inHand: !!p.inHand,
        folded: !!p.folded, allIn: !!p.allIn, left: !!p.left, out: !p.left && p.chips <= 0 && !p.inHand,
        act: p.act, won: p.won || 0,
        hole: p.id === id || p.show ? p.hole : null,
        handName: p.show ? p.best?.name : null,
      })),
    };
  }

  function push() { for (const p of P) if (!p.left) room.sendTo(p.id, view(p.id)); kick(); }

  startHand();
  return startHand;
}
