import { createLobby, playerItems } from '../../js/lobby.js';
import { COLORS, escapeHtml } from '../../js/net.js';
import { botRunner } from '../../js/bots.js';
import { t as T, tl, addStrings, onLang } from '../../js/i18n.js';

addStrings({
  th: {
    'tc.c.knight': 'อัศวิน', 'tc.c.archer': 'นักธนู', 'tc.c.mage': 'จอมเวท',
    'tc.n.knight': 'ถึก ตีระยะประชิด', 'tc.n.archer': 'ยิงไกล 2–3 ช่อง ตีประชิดไม่ได้', 'tc.n.mage': 'เวทลดเกราะศัตรูครึ่งหนึ่ง',
    'tc.t.plain': 'ทุ่งหญ้า', 'tc.t.forest': 'ป่า', 'tc.t.rock': 'หิน', 'tc.t.water': 'น้ำ',
    'tc.hp': 'HP', 'tc.atk': 'โจมตี', 'tc.def': 'เกราะ', 'tc.mov': 'เดิน', 'tc.range': 'ระยะ {r} ช่อง', 'tc.inTerrain': ' · ยืนใน{terr} เกราะ +{n}',
    'tc.draw': 'เสมอ!', 'tc.yourTurn': '⚔️ ตาของคุณ', 'tc.round': 'รอบที่ {n}/{max}', 'tc.forecast': 'พยากรณ์การต่อสู้',
    'tc.kill': '💥 กำจัดได้!', 'tc.counter': 'ศัตรูโต้กลับ −{n}', 'tc.youDie': ' (ตัวเราจะตาย!)', 'tc.noCounter': 'ศัตรูโต้กลับไม่ได้',
    'tc.confirm': 'ยืนยันโจมตี', 'tc.choose': 'เลือกการกระทำ', 'tc.tapEnemy': 'แตะศัตรูที่มีกรอบแดงเพื่อดูผลก่อนโจมตี',
    'tc.noTarget': 'ไม่มีศัตรูในระยะจากจุดนี้', 'tc.wait': 'รอ (ไม่โจมตี)', 'tc.tapMove': 'แตะช่องสีฟ้าเพื่อเดิน (แตะตัวเองเพื่ออยู่กับที่)',
    'tc.tapUnit': 'แตะยูนิตของคุณเพื่อสั่งการ · เหลือ {n} ตัวที่ยังไม่ได้เดิน', 'tc.endConfirm': 'ยืนยันจบเทิร์น? ยังมียูนิตเหลือ',
    'tc.end': 'จบเทิร์น', 'tc.hideThreat': 'ซ่อนเขตอันตราย', 'tc.threat': '⚠️ เขตอันตราย', 'tc.again': 'เล่นอีกครั้ง (แผนที่ใหม่)',
    'tc.waitRestart': 'รอหัวหน้าห้องเริ่มเกมใหม่',
    'tc.l.start': 'เริ่มศึก! {name} เดินก่อน', 'tc.l.win': '{name} ชนะ!', 'tc.l.none': 'ไม่มีใครรอด', 'tc.l.timeout': 'ครบ {n} รอบ! ตัดสินจาก HP รวม',
    'tc.l.turn': '— ตาของ {name} —', 'tc.l.attack': '{a} {name} โจมตี {b} {target} −{n}', 'tc.l.ko': ' 💥 ล้ม!', 'tc.l.counter': ' · โต้กลับ −{n}',
    'tc.l.left': '{name} ออกจากเกม',
  },
  en: {
    'tc.c.knight': 'Knight', 'tc.c.archer': 'Archer', 'tc.c.mage': 'Mage',
    'tc.n.knight': 'Tough, melee only', 'tc.n.archer': 'Shoots 2–3 tiles, cannot hit adjacent', 'tc.n.mage': "Magic halves the target's armor",
    'tc.t.plain': 'Grass', 'tc.t.forest': 'Forest', 'tc.t.rock': 'Rock', 'tc.t.water': 'Water',
    'tc.hp': 'HP', 'tc.atk': 'Attack', 'tc.def': 'Armor', 'tc.mov': 'Move', 'tc.range': 'Range {r}', 'tc.inTerrain': ' · in {terr}: armor +{n}',
    'tc.draw': 'Draw!', 'tc.yourTurn': '⚔️ Your turn', 'tc.round': 'Round {n}/{max}', 'tc.forecast': 'Battle forecast',
    'tc.kill': '💥 Defeats the target!', 'tc.counter': 'Counterattack −{n}', 'tc.youDie': ' (your unit falls!)', 'tc.noCounter': "The enemy can't counter",
    'tc.confirm': 'Confirm attack', 'tc.choose': 'Choose an action', 'tc.tapEnemy': 'Tap an enemy outlined in red to preview the attack',
    'tc.noTarget': 'No enemies in range from here', 'tc.wait': "Wait (don't attack)", 'tc.tapMove': 'Tap a blue tile to move (tap the unit to stay put)',
    'tc.tapUnit': 'Tap one of your units to give orders · {n} still to move', 'tc.endConfirm': 'End turn? Some units still have orders',
    'tc.end': 'End turn', 'tc.hideThreat': 'Hide danger zone', 'tc.threat': '⚠️ Danger zone', 'tc.again': 'Play again (new map)',
    'tc.waitRestart': 'Waiting for the host to start a new game',
    'tc.l.start': 'Battle begins! {name} moves first', 'tc.l.win': '{name} wins!', 'tc.l.none': 'Nobody survived', 'tc.l.timeout': '{n} rounds reached! Decided by total HP',
    'tc.l.turn': "— {name}'s turn —", 'tc.l.attack': "{a} {name} attacks {b} {target} −{n}", 'tc.l.ko': ' 💥 defeated!', 'tc.l.counter': ' · counter −{n}',
    'tc.l.left': '{name} left the game',
  },
});
import {
  CLASSES, TERRAIN, MAX_ROUNDS, key, alive, unitAt, tileAt, reachable, targetsFrom, forecast, threatTiles,
  makeBattle, botAction,
} from './rules.js';

createLobby({ title: 'g.tactics', minPlayers: 2, maxPlayers: 6, bots: true, onStart });

const TERR_ICON = { F: '🌲', R: '🪨', W: '🌊' };

function onStart(room) {
  const boardEl = document.getElementById('board');
  const panel = document.getElementById('panel');
  let st = null;
  let sel = null;       // selected unit id (mine, not acted)
  let stage = null;     // [x, y] chosen destination
  let aim = null;       // target unit id
  let info = null;      // unit id shown in the info box
  let threat = false;
  let endConfirm = false;
  let hostNext = null;

  const myTurn = () => st && !st.over && st.turn === room.myId;
  const unit = (id) => st.units.find((u) => u.id === id);
  const color = (owner) => {
    const p = st.players.find((x) => x.id === owner);
    return COLORS[(p?.color ?? 0) % COLORS.length];
  };
  const nameOf = (owner) => escapeHtml(st.players.find((x) => x.id === owner)?.name || '?');
  const reset = () => { sel = null; stage = null; aim = null; endConfirm = false; };

  room.on('message', (m) => {
    if (m.type !== 'state') return;
    st = m;
    window.__st = m;
    const s = sel && unit(sel);
    if (!myTurn() || !s || s.acted || s.hp <= 0) reset();
    render();
  });

  boardEl.addEventListener('click', (e) => {
    const cell = e.target.closest('.cell');
    if (!cell || !st) return;
    const x = Number(cell.dataset.x);
    const y = Number(cell.dataset.y);
    const here = unitAt(st, x, y);
    endConfirm = false;
    if (myTurn()) {
      const s = sel && unit(sel);
      if (s && stage && here && here.owner !== room.myId && targetsFrom(st, s, stage).includes(here)) {
        aim = here.id;
        info = here.id;
        return render();
      }
      if (s && reachable(st, s).has(key(x, y)) && (!here || here === s)) {
        stage = [x, y];
        aim = null;
        return render();
      }
      if (here && here.owner === room.myId && !here.acted) {
        sel = here.id; stage = null; aim = null; info = here.id;
        return render();
      }
    }
    info = here ? here.id : null;
    if (!here) { sel = null; stage = null; aim = null; }
    render();
  });

  panel.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b || b.disabled) return;
    const act = b.dataset.act;
    if (act === 'threat') { threat = !threat; return render(); }
    if (act === 'cancel') { reset(); return render(); }
    if (act === 'again') return hostNext?.();
    if (act === 'end') {
      const left = alive(st).filter((u) => u.owner === room.myId && !u.acted).length;
      if (left && !endConfirm) { endConfirm = true; return render(); }
      room.toHost({ type: 'end' });
      reset();
      return;
    }
    if (act === 'wait' || act === 'attack') {
      room.toHost({ type: 'act', unit: sel, x: stage[0], y: stage[1], target: act === 'attack' ? aim : null });
      reset();
    }
  });

  function render() {
    const s = sel && unit(sel);
    const moves = s && !stage ? reachable(st, s) : null;
    const targets = s && stage ? targetsFrom(st, s, stage) : [];
    const rangeTiles = new Set();
    if (s && stage) {
      const { min, max } = CLASSES[s.cls];
      for (let dx = -max; dx <= max; dx++) for (let dy = -max; dy <= max; dy++) {
        const d = Math.abs(dx) + Math.abs(dy);
        if (d >= min && d <= max) rangeTiles.add(key(stage[0] + dx, stage[1] + dy));
      }
    }
    const danger = threat && !st.over ? threatTiles(st, room.myId) : null;

    const avail = boardEl.parentElement.clientWidth || 600;
    const cell = Math.max(30, Math.min(56, Math.floor((avail - 12 - 2 * (st.size - 1)) / st.size)));
    boardEl.style.setProperty('--n', st.size);
    boardEl.style.setProperty('--cell', `${cell}px`);

    let html = '';
    for (let y = 0; y < st.size; y++) {
      for (let x = 0; x < st.size; x++) {
        const t = tileAt(st, x, y);
        const k = key(x, y);
        let u = unitAt(st, x, y);
        let ghost = false;
        if (s && stage && u === s && (stage[0] !== x || stage[1] !== y)) u = null;
        if (s && stage && stage[0] === x && stage[1] === y) { u = s; ghost = true; }
        const cls = ['cell', `t-${t === '.' ? 'dot' : t}`];
        if (moves?.has(k)) cls.push('mv');
        if (rangeTiles.has(k)) cls.push('rng');
        if (danger?.has(k)) cls.push('threat');
        if (u && targets.includes(u)) cls.push(u.id === aim ? 'aim' : 'tg');
        if (s && !stage && u === s) cls.push('sel');
        let inner = TERR_ICON[t] && !u ? `<span class="terr">${TERR_ICON[t]}</span>` : '';
        if (u) {
          const pct = u.hp / CLASSES[u.cls].hp;
          inner = `<div class="unit ${u.acted && u.owner === st.turn && !st.over ? 'done' : ''} ${ghost ? 'ghost' : ''}" style="--pc:${color(u.owner)}">
            ${CLASSES[u.cls].icon}<span class="hp"><i class="${pct < 0.34 ? 'low' : pct < 0.67 ? 'mid' : ''}" style="width:${pct * 100}%"></i></span></div>`;
        }
        html += `<div class="cell ${cls.join(' ')}" data-x="${x}" data-y="${y}" title="${T(TERRAIN[t].name)}">${inner}</div>`;
      }
    }
    boardEl.innerHTML = html;
    renderPanel(s, targets);
  }

  function statBox(u) {
    const c = CLASSES[u.cls];
    const terr = TERRAIN[tileAt(st, u.x, u.y)];
    return `<div class="box" style="border-left:4px solid ${color(u.owner)}">
      <h4>${c.icon} ${T(c.name)} · <span class="muted">${nameOf(u.owner)}</span></h4>
      <div class="stats"><div>${T('tc.hp')}<b>${u.hp}/${c.hp}</b></div><div>${T('tc.atk')}<b>${c.atk}</b></div><div>${T('tc.def')}<b>${c.def}${terr.def ? `+${terr.def}` : ''}</b></div><div>${T('tc.mov')}<b>${c.mov}</b></div></div>
      <div class="muted" style="font-size:.85rem">${T('tc.range', { r: c.min === c.max ? c.min : `${c.min}–${c.max}` })} · ${T(c.note)}${terr.def ? T('tc.inTerrain', { terr: { k: terr.name }, n: terr.def }) : ''}</div>
    </div>`;
  }

  function renderPanel(s, targets) {
    const turnName = nameOf(st.turn);
    const counts = (owner) => alive(st).filter((u) => u.owner === owner);
    let out = `<div class="banner">${st.over
      ? (st.winner ? T('c.wins', { name: nameOf(st.winner) }) : T('tc.draw'))
      : myTurn() ? T('tc.yourTurn') : T('c.waitFor', { name: turnName })}</div>
      <div class="muted" style="text-align:center">${T('tc.round', { n: Math.min(st.round, MAX_ROUNDS), max: MAX_ROUNDS })}</div>
      <ul class="players">${playerItems(st.players, room.myId, (p) => {
        const us = counts(p.id);
        return `<span class="score">${us.length ? us.map((u) => CLASSES[u.cls].icon).join('') : '💀'}</span>`;
      })}</ul>`;
    const turnIdx = st.players.findIndex((p) => p.id === st.turn);

    if (myTurn()) {
      if (s && stage && aim) {
        const t = unit(aim);
        const f = forecast(st, s, stage, t);
        out += `<div class="box actionbox"><h4>${T('tc.forecast')}</h4>
          <div class="fc">
            <div>${CLASSES[s.cls].icon}<br>HP ${s.hp} → <b>${s.hp - f.counter}</b></div>
            <div class="big dmg">−${f.dmg}</div>
            <div>${CLASSES[t.cls].icon}<br>HP ${t.hp} → <b>${t.hp - f.dmg}</b></div>
          </div>
          <div class="muted" style="text-align:center">${f.kill ? T('tc.kill') : f.counter ? T('tc.counter', { n: f.counter }) + (f.die ? T('tc.youDie') : '') : T('tc.noCounter')}</div>
          <div class="row2"><button class="btn primary" data-act="attack">${T('tc.confirm')}</button><button class="btn ghost" data-act="cancel">${T('c.cancel')}</button></div></div>`;
      } else if (s && stage) {
        out += `<div class="box actionbox"><h4>${CLASSES[s.cls].icon} ${T('tc.choose')}</h4>
          <div class="muted">${targets.length ? T('tc.tapEnemy') : T('tc.noTarget')}</div>
          <div class="row2"><button class="btn" data-act="wait">${T('tc.wait')}</button><button class="btn ghost" data-act="cancel">${T('c.cancel')}</button></div></div>`;
      } else if (s) {
        out += `<div class="box actionbox"><h4>${CLASSES[s.cls].icon} ${T(CLASSES[s.cls].name)}</h4><div class="muted">${T('tc.tapMove')}</div>
          <div class="row2"><button class="btn ghost" data-act="cancel">${T('c.cancel')}</button></div></div>`;
      } else {
        const left = alive(st).filter((u) => u.owner === room.myId && !u.acted).length;
        out += `<div class="box"><div class="muted">${T('tc.tapUnit', { n: left })}</div></div>`;
      }
    }

    const shown = info && unit(info);
    if (shown && shown.hp > 0 && !(aim && shown.id === aim)) out += statBox(shown);

    out += '<div class="row2">';
    if (myTurn()) out += `<button class="btn ${endConfirm ? 'primary' : ''}" data-act="end">${endConfirm ? T('tc.endConfirm') : T('tc.end')}</button>`;
    if (!st.over) out += `<button class="btn ghost" data-act="threat">${threat ? T('tc.hideThreat') : T('tc.threat')}</button>`;
    if (st.over && room.isHost) out += `<button class="btn primary big" data-act="again">${T('tc.again')}</button>`;
    out += '</div>';
    if (st.over && !room.isHost) out += `<p class="muted" style="text-align:center">${T('tc.waitRestart')}</p>`;
    out += `<div class="log">${st.log.slice(-30).reverse().map((l) => `<div>${escapeHtml(tl(l))}</div>`).join('')}</div>`;
    panel.innerHTML = out;
    if (turnIdx >= 0 && !st.over) panel.querySelectorAll('.players li')[turnIdx]?.classList.add('turn');
  }

  window.addEventListener('resize', () => st && render());
  onLang(() => st && render());
  if (room.isHost) hostNext = hostLogic(room);
}

// ---------- host: authoritative rules ----------
function hostLogic(room) {
  let S;
  const name = (id) => S.players.find((p) => p.id === id)?.name || '?';
  const owners = () => [...new Set(alive(S).map((u) => u.owner))];

  function newGame() {
    const players = room.players.map(({ id, name: n, color, bot }) => ({ id, name: n, color, bot: !!bot }));
    S = { ...makeBattle(players.map((p) => p.id)), players, turn: players[0].id, round: 1, over: false, winner: null, log: [] };
    S.log.push({ k: 'tc.l.start', p: { name: players[0].name } });
    push();
  }

  function checkOver() {
    const o = owners();
    if (o.length <= 1) { S.over = true; S.winner = o[0] ?? null; S.log.push(S.winner ? { k: 'tc.l.win', p: { name: name(S.winner) } } : { k: 'tc.l.none' }); return true; }
    return false;
  }

  function nextTurn() {
    const o = owners();
    const order = S.players.map((p) => p.id);
    const cur = order.indexOf(S.turn);
    for (let k = 1; k <= order.length; k++) {
      const i = (cur + k) % order.length;
      if (!o.includes(order[i])) continue;
      if (i <= cur) S.round++;
      if (S.round > MAX_ROUNDS) {
        const hp = (id) => alive(S).filter((u) => u.owner === id).reduce((a, u) => a + u.hp, 0);
        const ranked = o.sort((a, b) => hp(b) - hp(a));
        S.over = true;
        S.winner = hp(ranked[0]) > hp(ranked[1]) ? ranked[0] : null;
        S.log.push({ k: 'tc.l.timeout', p: { n: MAX_ROUNDS } });
        return;
      }
      S.turn = order[i];
      for (const u of S.units) if (u.owner === S.turn) u.acted = false;
      S.log.push({ k: 'tc.l.turn', p: { name: name(S.turn) } });
      return;
    }
  }

  function handle(d, from) {
    if (!S || S.over || from !== S.turn) return;
    if (d.type === 'end') { nextTurn(); return push(); }
    if (d.type !== 'act') return;
    const u = S.units.find((x) => x.id === d.unit && x.owner === from && x.hp > 0 && !x.acted);
    if (!u || !reachable(S, u).has(key(d.x, d.y))) return;
    let t = null;
    if (d.target) {
      t = alive(S).find((x) => x.id === d.target && x.owner !== from);
      if (!t || !targetsFrom(S, u, [d.x, d.y]).includes(t)) return;
    }
    u.x = d.x; u.y = d.y; u.acted = true;
    const c = CLASSES[u.cls];
    if (t) {
      const f = forecast(S, u, [u.x, u.y], t);
      t.hp -= f.dmg;
      u.hp -= f.counter;
      S.log.push([{ k: 'tc.l.attack', p: { a: c.icon, name: name(from), b: CLASSES[t.cls].icon, target: name(t.owner), n: f.dmg } },
        ...(f.kill ? [{ k: 'tc.l.ko' }] : []),
        ...(f.counter ? [{ k: 'tc.l.counter', p: { n: f.counter } }, ...(f.die ? [{ k: 'tc.l.ko' }] : [])] : [])]);
    }
    if (checkOver()) return push();
    if (!alive(S).some((x) => x.owner === from && !x.acted)) nextTurn();
    push();
  }

  const decide = (id) => (S && !S.over && S.turn === id ? botAction(S, id) : null);
  const kick = botRunner(room, decide, handle, 700);

  function push() {
    room.broadcast({ type: 'state', ...S, log: S.log.slice(-40) });
    kick();
  }

  room.on('input', handle);
  room.on('leave', (id) => {
    if (!S) return;
    for (const u of S.units) if (u.owner === id) u.hp = 0;
    S.log.push({ k: 'tc.l.left', p: { name: name(id) } });
    if (!S.over && !checkOver() && S.turn === id) nextTurn();
    push();
  });

  newGame();
  return newGame;
}
