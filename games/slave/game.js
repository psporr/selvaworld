import { createLobby } from '../../js/lobby.js';
import { COLORS, escapeHtml } from '../../js/net.js';
import { newDeck, cardsHTML, cardLabel, backHTML, rankOf } from '../../js/cards.js';
import { botRunner } from '../../js/bots.js';
import { power, sortHand, canBeat, titlesFor, THREE_CLUBS } from './rules.js';

createLobby({ title: '👑 สลาฟ', minPlayers: 2, maxPlayers: 6, bots: true, onStart });

function onStart(room) {
  const el = document.getElementById('table');
  let st = null;
  let selected = new Set();
  let hostNext = null;

  room.on('message', (m) => {
    if (m.type !== 'state') return;
    st = m;
    window.__st = m; // handy for debugging/tests
    selected = new Set([...selected].filter((c) => st.hand.includes(c)));
    render();
  });

  el.addEventListener('click', (e) => {
    const card = e.target.closest('.mine .pcard.clickable');
    if (card) {
      const c = Number(card.dataset.c);
      selected.has(c) ? selected.delete(c) : selected.add(c);
      render();
      return;
    }
    const b = e.target.closest('[data-act]');
    if (!b || b.disabled) return;
    const act = b.dataset.act;
    if (act === 'next') hostNext?.();
    else if (act === 'clear') { selected.clear(); render(); }
    else if (act === 'play') { room.toHost({ type: 'play', cards: [...selected] }); selected.clear(); }
    else if (act === 'pass') room.toHost({ type: 'pass' });
  });

  function render() {
    const myTurn = st.phase === 'play' && st.turn === room.myId;
    const sel = [...selected];
    const leadCards = st.lead?.cards || null;
    const playable = myTurn && canBeat(sel, leadCards) && (!st.mustThree || sel.includes(THREE_CLUBS));
    const name = (id) => escapeHtml(st.players.find((p) => p.id === id)?.name || '');

    const seat = (p) => `
      <div class="seat ${st.phase === 'play' && st.turn === p.id ? 'turn' : ''} ${p.finished ? 'out' : ''}" style="--pc:${COLORS[p.color % COLORS.length]}">
        <div class="who"><span class="n">${escapeHtml(p.name)}${p.left ? ' (ออกแล้ว)' : ''}</span>${p.prevTitle ? `<span class="badge">${p.prevTitle}</span>` : ''}</div>
        <div class="meta"><span>🂠 ${p.count} ใบ</span><span>⭐ ${p.score}</span></div>
        <div class="cards">${p.finished ? `<span class="badge gold">${p.title || 'จบแล้ว'}</span>`
          : p.passed ? '<span class="badge">ผ่าน</span>' : backHTML('sm').repeat(Math.min(p.count, 3))}</div>
      </div>`;

    let center;
    if (st.phase === 'over') {
      center = `<div class="pot">จบรอบที่ ${st.round}</div><div class="info">${st.order.map((id, i) =>
        `${i + 1}. ${name(id)} — ${st.players.find((p) => p.id === id)?.title || ''}`).join('<br>')}</div>`;
    } else if (st.lead) {
      center = `<div class="info">${name(st.lead.by)} ลง</div><div class="cards">${cardsHTML(st.lead.cards)}</div>`;
    } else {
      center = `<div class="pot">${name(st.turn)} เริ่มกองใหม่</div><div class="info">ลงได้ทั้งเดี่ยว คู่ ตอง หรือโฟร์</div>`;
    }

    let actions;
    if (st.phase === 'over') {
      actions = room.isHost ? '<button class="btn primary big" data-act="next">เล่นรอบต่อไป</button>' : '<span class="muted">รอหัวหน้าห้องเริ่มรอบต่อไป</span>';
    } else if (myTurn) {
      actions = `<button class="btn primary" data-act="play" ${playable ? '' : 'disabled'}>ลงไพ่${sel.length ? ` (${sel.length})` : ''}</button>
        <button class="btn" data-act="pass" ${st.lead ? '' : 'disabled'}>ผ่าน</button>
        ${sel.length ? '<button class="btn ghost" data-act="clear">ล้าง</button>' : ''}`;
    } else {
      actions = st.hand.length ? `<span class="muted">รอ ${name(st.turn)}...</span>` : '<span class="muted">คุณลงไพ่หมดแล้ว 🎉</span>';
    }

    let hint = '';
    if (myTurn) {
      if (st.mustThree) hint = 'ตาแรก ต้องลงไพ่ที่มี 3♣ ด้วย';
      else if (st.lead) hint = `ต้องลง ${st.lead.cards.length} ใบ ที่ใหญ่กว่า (3 เล็กสุด, 2 ใหญ่สุด, ♣<♦<♥<♠)`;
      else hint = 'คุณได้เริ่มกองใหม่ ลงอะไรก็ได้';
    }

    el.innerHTML = `
      <div class="seats">${st.players.filter((p) => p.id !== room.myId).map(seat).join('')}</div>
      <div class="felt">${center}<div class="info">${escapeHtml(st.log || '')}</div></div>
      <div class="mine ${myTurn ? 'turn' : ''}">
        <div class="label">ไพ่ของคุณ (${st.hand.length} ใบ) · ⭐ ${st.players.find((p) => p.id === room.myId)?.score ?? 0}
          ${st.myTitle ? `· <span class="badge gold">${st.myTitle}</span>` : ''}</div>
        ${st.exchange ? `<div class="log">${escapeHtml(st.exchange)}</div>` : ''}
        <div class="cards fan">${st.hand.map((c) => cardsHTML([c], { clickable: st.phase === 'play', selected: selected.has(c) })).join('')}</div>
        <div class="log">${hint}</div>
        <div class="actions">${actions}</div>
      </div>`;
  }

  if (room.isHost) hostNext = hostLogic(room);
}

// ---------- host: authoritative rules ----------
function hostLogic(room) {
  const S = {
    round: 0, phase: 'play', turn: 0, lead: null, order: [], log: '', mustThree: false,
    players: room.players.map(({ id, name, color }) => ({ id, name, color, score: 0, hand: [] })),
  };
  const P = () => S.players;
  const inPlay = (p) => !p.finished && !p.left;

  function newRound() {
    // previous standings (only if nobody left)
    const prev = S.order.length && S.players.every((p) => !p.left) ? [...S.order] : null;
    S.players = S.players.filter((p) => !p.left);
    if (S.players.length < 2) { S.phase = 'over'; S.log = 'ผู้เล่นไม่พอ'; push(); return; }
    S.round++;
    const titles = titlesFor(S.players.length);
    for (const p of P()) {
      p.prevTitle = prev ? titles[prev.indexOf(p.id)] : null;
      Object.assign(p, { hand: [], finished: false, passed: false, title: null, exchange: null });
    }
    const deck = newDeck();
    deck.forEach((c, i) => P()[i % P().length].hand.push(c));
    for (const p of P()) p.hand = sortHand(p.hand);
    S.order = [];
    S.lead = null;
    S.phase = 'play';

    if (prev) {
      const byPlace = prev.map((id) => P().find((p) => p.id === id));
      const swap = (hi, lo, n) => {
        const give = lo.hand.slice(-n);            // loser gives best cards
        const back = hi.hand.slice(0, n);          // winner gives worst cards
        lo.hand = sortHand(lo.hand.filter((c) => !give.includes(c)).concat(back));
        hi.hand = sortHand(hi.hand.filter((c) => !back.includes(c)).concat(give));
        hi.exchange = `แลกไพ่: ได้ ${give.map(cardLabel).join(' ')} จาก ${lo.name} · ให้ ${back.map(cardLabel).join(' ')}`;
        lo.exchange = `แลกไพ่: ให้ ${give.map(cardLabel).join(' ')} แก่ ${hi.name} · ได้ ${back.map(cardLabel).join(' ')}`;
      };
      const n = byPlace.length;
      swap(byPlace[0], byPlace[n - 1], 2);
      if (n >= 4) swap(byPlace[1], byPlace[n - 2], 1);
      S.turn = P().indexOf(byPlace[n - 1]); // slave starts
      S.mustThree = false;
      S.log = `รอบที่ ${S.round}: สลาฟ ${byPlace[n - 1].name} เริ่มก่อน`;
    } else {
      S.turn = P().findIndex((p) => p.hand.includes(THREE_CLUBS));
      S.mustThree = true;
      S.log = `รอบที่ ${S.round}: ${P()[S.turn].name} มี 3♣ เริ่มก่อน`;
    }
    push();
  }

  // next player after `from` who can still act in this trick
  function nextActor(from) {
    const n = P().length;
    for (let k = 1; k <= n; k++) {
      const i = (from + k) % n;
      if (inPlay(P()[i]) && !P()[i].passed) return i;
    }
    return -1;
  }

  function advance() {
    if (P().filter(inPlay).length <= 1) return endRound();
    const leaderIdx = P().findIndex((p) => p.id === S.lead?.by);
    const nxt = nextActor(S.turn);
    if (!S.lead || (nxt !== -1 && nxt !== leaderIdx)) { S.turn = nxt; return push(); }
    // trick over: the last player to play leads again (or the next one still in)
    for (const p of P()) p.passed = false;
    S.lead = null;
    S.turn = inPlay(P()[leaderIdx]) ? leaderIdx : nextActor(leaderIdx);
    S.log = `${P()[S.turn].name} ได้เริ่มกองใหม่`;
    push();
  }

  function endRound() {
    for (const p of P()) if (!p.finished && !p.left) { p.finished = true; S.order.push(p.id); }
    for (const p of P()) if (p.left && !S.order.includes(p.id)) S.order.push(p.id);
    const titles = titlesFor(P().length);
    S.order.forEach((id, i) => {
      const p = P().find((x) => x.id === id);
      p.title = titles[i];
      if (!p.left) p.score += P().length - 1 - i;
    });
    S.phase = 'over';
    S.lead = null;
    S.log = '';
    push();
  }

  function handle(d, from) {
    if (S.phase !== 'play') return;
    const p = P()[S.turn];
    if (!p || p.id !== from) return;
    if (d.type === 'pass') {
      if (!S.lead) return;
      p.passed = true;
      S.log = `${p.name} ผ่าน`;
      advance();
    } else if (d.type === 'play') {
      const cards = Array.isArray(d.cards) ? [...new Set(d.cards)] : [];
      if (!cards.every((c) => p.hand.includes(c))) return;
      if (!canBeat(cards, S.lead?.cards || null)) return;
      if (S.mustThree && !cards.includes(THREE_CLUBS)) return;
      S.mustThree = false;
      p.hand = p.hand.filter((c) => !cards.includes(c));
      S.lead = { cards: cards.sort((a, b) => power(a) - power(b)), by: p.id };
      S.log = '';
      if (!p.hand.length) {
        p.finished = true;
        S.order.push(p.id);
        p.title = titlesFor(P().length)[S.order.length - 1];
        S.log = `${p.name} ลงหมดแล้ว! ได้เป็น ${p.title}`;
      }
      advance();
    }
  }
  room.on('input', handle);

  // bot: play the lowest cards that work; lead with the lowest whole rank group
  function decide(id) {
    const p = P()[S.turn];
    if (S.phase !== 'play' || !p || p.id !== id) return null;
    const groups = [];
    for (const c of p.hand) { // hand is sorted low → high
      const g = groups[groups.length - 1];
      if (g && rankOf(g[0]) === rankOf(c)) g.push(c); else groups.push([c]);
    }
    if (S.mustThree) return { type: 'play', cards: groups.find((g) => g.includes(THREE_CLUBS)) };
    if (!S.lead) return { type: 'play', cards: groups[0] };
    const L = S.lead.cards.length;
    for (const g of groups) {
      if (g.length < L) continue;
      const pick = g.slice(-L);
      if (canBeat(pick, S.lead.cards)) return { type: 'play', cards: pick };
    }
    return { type: 'pass' };
  }
  const kick = botRunner(room, decide, handle);

  room.on('leave', (id) => {
    const p = P().find((x) => x.id === id);
    if (!p) return;
    p.left = true;
    if (p.hand.includes(THREE_CLUBS)) S.mustThree = false;
    p.hand = [];
    if (S.phase !== 'play') return push();
    if (P()[S.turn] === p) advance();
    else if (P().filter(inPlay).length <= 1) endRound();
    else push();
  });

  function view(id) {
    const me = P().find((p) => p.id === id);
    return {
      type: 'state', phase: S.phase, round: S.round, log: S.log, lead: S.lead, order: S.order,
      mustThree: S.mustThree, turn: P()[S.turn]?.id,
      hand: me?.hand || [], myTitle: me?.title, exchange: S.phase === 'play' ? me?.exchange : null,
      players: P().map((p) => ({
        id: p.id, name: p.name, color: p.color, count: p.hand.length, score: p.score,
        finished: !!p.finished, passed: !!p.passed, left: !!p.left, title: p.title, prevTitle: p.prevTitle,
      })),
    };
  }

  function push() { for (const p of P()) if (!p.left) room.sendTo(p.id, view(p.id)); kick(); }

  newRound();
  return newRound;
}
