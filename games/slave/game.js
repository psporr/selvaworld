import { createLobby } from '../../js/lobby.js';
import { COLORS, escapeHtml } from '../../js/net.js';
import { newDeck, cardsHTML, cardLabel, backHTML, rankOf } from '../../js/cards.js';
import { botRunner } from '../../js/bots.js';
import { t, tl, addStrings, onLang } from '../../js/i18n.js';

addStrings({
  th: {
    'sl.t.king': 'คิง 👑', 'sl.t.queen': 'ควีน', 'sl.t.peasant': 'ไพร่', 'sl.t.slave': 'สลาฟ',
    'sl.cards': '🂠 {n} ใบ', 'sl.done': 'จบแล้ว', 'sl.pass': 'ผ่าน', 'sl.roundOver': 'จบรอบที่ {n}', 'sl.played': '{name} ลง',
    'sl.newPile': '{name} เริ่มกองใหม่', 'sl.anyCombo': 'ลงได้ทั้งเดี่ยว คู่ ตอง หรือโฟร์', 'sl.next': 'เล่นรอบต่อไป',
    'sl.waitNext': 'รอหัวหน้าห้องเริ่มรอบต่อไป', 'sl.play': 'ลงไพ่', 'sl.clear': 'ล้าง', 'sl.allOut': 'คุณลงไพ่หมดแล้ว 🎉',
    'sl.h.three': 'ตาแรก ต้องลงไพ่ที่มี 3♣ ด้วย', 'sl.h.beat': 'ต้องลง {n} ใบ ที่ใหญ่กว่า (3 เล็กสุด, 2 ใหญ่สุด, ♣<♦<♥<♠)',
    'sl.h.lead': 'คุณได้เริ่มกองใหม่ ลงอะไรก็ได้', 'sl.yourCards': 'ไพ่ของคุณ ({n} ใบ)',
    'sl.l.notEnough': 'ผู้เล่นไม่พอ', 'sl.x.got': 'แลกไพ่: ได้ {give} จาก {name} · ให้ {back}', 'sl.x.gave': 'แลกไพ่: ให้ {give} แก่ {name} · ได้ {back}',
    'sl.l.slaveStarts': 'รอบที่ {n}: สลาฟ {name} เริ่มก่อน', 'sl.l.threeStarts': 'รอบที่ {n}: {name} มี 3♣ เริ่มก่อน',
    'sl.l.newPile': '{name} ได้เริ่มกองใหม่', 'sl.l.passed': '{name} ผ่าน', 'sl.l.out': '{name} ลงหมดแล้ว! ได้เป็น {title}',
  },
  en: {
    'sl.t.king': 'King 👑', 'sl.t.queen': 'Queen', 'sl.t.peasant': 'Peasant', 'sl.t.slave': 'Slave',
    'sl.cards': '🂠 {n} cards', 'sl.done': 'Out', 'sl.pass': 'Pass', 'sl.roundOver': 'Round {n} over', 'sl.played': '{name} played',
    'sl.newPile': '{name} starts a new pile', 'sl.anyCombo': 'Play a single, pair, triple or four of a kind', 'sl.next': 'Next round',
    'sl.waitNext': 'Waiting for the host to start the next round', 'sl.play': 'Play', 'sl.clear': 'Clear', 'sl.allOut': "You're out of cards 🎉",
    'sl.h.three': 'First turn: your play must include the 3♣', 'sl.h.beat': 'Play {n} card(s) that beat it (3 lowest, 2 highest, ♣<♦<♥<♠)',
    'sl.h.lead': 'You start a new pile, play anything', 'sl.yourCards': 'Your cards ({n})',
    'sl.l.notEnough': 'Not enough players', 'sl.x.got': 'Card swap: got {give} from {name} · gave {back}', 'sl.x.gave': 'Card swap: gave {give} to {name} · got {back}',
    'sl.l.slaveStarts': 'Round {n}: the Slave, {name}, starts', 'sl.l.threeStarts': 'Round {n}: {name} has the 3♣ and starts',
    'sl.l.newPile': '{name} starts a new pile', 'sl.l.passed': '{name} passed', 'sl.l.out': '{name} is out of cards and becomes {title}!',
  },
});
import { power, sortHand, canBeat, titlesFor, THREE_CLUBS } from './rules.js';

createLobby({ title: 'g.slave', minPlayers: 2, maxPlayers: 6, bots: true, onStart });

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

  onLang(() => st && render());

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
        <div class="who"><span class="n">${escapeHtml(p.name)}${p.left ? ` ${t('c.left')}` : ''}</span>${p.prevTitle ? `<span class="badge">${t(p.prevTitle)}</span>` : ''}</div>
        <div class="meta"><span>${t('sl.cards', { n: p.count })}</span><span>⭐ ${p.score}</span></div>
        <div class="cards">${p.finished ? `<span class="badge gold">${t(p.title || 'sl.done')}</span>`
          : p.passed ? `<span class="badge">${t('sl.pass')}</span>` : backHTML('sm').repeat(Math.min(p.count, 3))}</div>
      </div>`;

    let center;
    if (st.phase === 'over') {
      center = `<div class="pot">${t('sl.roundOver', { n: st.round })}</div><div class="info">${st.order.map((id, i) =>
        `${i + 1}. ${name(id)} — ${t(st.players.find((p) => p.id === id)?.title || '')}`).join('<br>')}</div>`;
    } else if (st.lead) {
      center = `<div class="info">${escapeHtml(t('sl.played', { name: st.players.find((p) => p.id === st.lead.by)?.name }))}</div><div class="cards">${cardsHTML(st.lead.cards)}</div>`;
    } else {
      center = `<div class="pot">${escapeHtml(t('sl.newPile', { name: st.players.find((p) => p.id === st.turn)?.name }))}</div><div class="info">${t('sl.anyCombo')}</div>`;
    }

    let actions;
    if (st.phase === 'over') {
      actions = room.isHost ? `<button class="btn primary big" data-act="next">${t('sl.next')}</button>` : `<span class="muted">${t('sl.waitNext')}</span>`;
    } else if (myTurn) {
      actions = `<button class="btn primary" data-act="play" ${playable ? '' : 'disabled'}>${t('sl.play')}${sel.length ? ` (${sel.length})` : ''}</button>
        <button class="btn" data-act="pass" ${st.lead ? '' : 'disabled'}>${t('sl.pass')}</button>
        ${sel.length ? `<button class="btn ghost" data-act="clear">${t('sl.clear')}</button>` : ''}`;
    } else {
      actions = st.hand.length ? `<span class="muted">${escapeHtml(t('c.waitFor', { name: st.players.find((p) => p.id === st.turn)?.name }))}</span>` : `<span class="muted">${t('sl.allOut')}</span>`;
    }

    let hint = '';
    if (myTurn) {
      if (st.mustThree) hint = t('sl.h.three');
      else if (st.lead) hint = escapeHtml(t('sl.h.beat', { n: st.lead.cards.length }));
      else hint = t('sl.h.lead');
    }

    el.innerHTML = `
      <div class="seats">${st.players.filter((p) => p.id !== room.myId).map(seat).join('')}</div>
      <div class="felt">${center}<div class="info">${escapeHtml(tl(st.log))}</div></div>
      <div class="mine ${myTurn ? 'turn' : ''}">
        <div class="label">${t('sl.yourCards', { n: st.hand.length })} · ⭐ ${st.players.find((p) => p.id === room.myId)?.score ?? 0}
          ${st.myTitle ? `· <span class="badge gold">${t(st.myTitle)}</span>` : ''}</div>
        ${st.exchange ? `<div class="log">${escapeHtml(tl(st.exchange))}</div>` : ''}
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
    if (S.players.length < 2) { S.phase = 'over'; S.log = { k: 'sl.l.notEnough' }; push(); return; }
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
        hi.exchange = { k: 'sl.x.got', p: { give: give.map(cardLabel).join(' '), name: lo.name, back: back.map(cardLabel).join(' ') } };
        lo.exchange = { k: 'sl.x.gave', p: { give: give.map(cardLabel).join(' '), name: hi.name, back: back.map(cardLabel).join(' ') } };
      };
      const n = byPlace.length;
      swap(byPlace[0], byPlace[n - 1], 2);
      if (n >= 4) swap(byPlace[1], byPlace[n - 2], 1);
      S.turn = P().indexOf(byPlace[n - 1]); // slave starts
      S.mustThree = false;
      S.log = { k: 'sl.l.slaveStarts', p: { n: S.round, name: byPlace[n - 1].name } };
    } else {
      S.turn = P().findIndex((p) => p.hand.includes(THREE_CLUBS));
      S.mustThree = true;
      S.log = { k: 'sl.l.threeStarts', p: { n: S.round, name: P()[S.turn].name } };
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
    S.log = { k: 'sl.l.newPile', p: { name: P()[S.turn].name } };
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
      S.log = { k: 'sl.l.passed', p: { name: p.name } };
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
        S.log = { k: 'sl.l.out', p: { name: p.name, title: { k: p.title } } };
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
