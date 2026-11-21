// Shared lobby UI: name, create/join room, player list, start button.
// A game page needs <section id="lobby"> and <section id="game" hidden>.
import { Room, COLORS, escapeHtml } from './net.js';
import { t, onLang } from './i18n.js';

const NAME_KEY = 'selvaworld:name';

function loadName() { try { return localStorage.getItem(NAME_KEY) || ''; } catch { return ''; } }
function saveName(n) { try { localStorage.setItem(NAME_KEY, n); } catch { /* ignore */ } }

export function createLobby({ title, minPlayers = 1, maxPlayers = 6, bots = false, onStart }) {
  const root = document.getElementById('lobby');
  const gameEl = document.getElementById('game');
  const inviteCode = (new URLSearchParams(location.search).get('room') || '').toUpperCase();
  let room = null;
  let started = false;
  let view = 'setup';
  let lastError = '';

  renderSetup();
  onLang(() => {
    if (view === 'setup') {
      const name = root.querySelector('#lb-name')?.value;
      const code = root.querySelector('#lb-code')?.value;
      renderSetup(lastError);
      if (name != null) root.querySelector('#lb-name').value = name;
      if (code != null) root.querySelector('#lb-code').value = code;
    } else if (view === 'room') renderRoom();
  });

  function renderSetup(error = '') {
    view = 'setup';
    lastError = error;
    const range = minPlayers === maxPlayers ? `${maxPlayers}` : `${minPlayers}–${maxPlayers}`;
    root.innerHTML = `
      <div class="card lobby">
        <h2>${escapeHtml(t(title))}</h2>
        <p class="muted">${t('lb.players', { range })}${bots ? t('lb.soloBots') : ''}</p>
        <label class="field"><span>${t('lb.yourName')}</span>
          <input id="lb-name" maxlength="16" placeholder="${t('lb.namePh')}" value="${escapeHtml(loadName())}">
        </label>
        <div class="lobby-actions">
          <button id="lb-create" class="btn ${inviteCode ? '' : 'primary'}">${t('lb.create')}</button>
          <div class="or">${t('lb.or')}</div>
          <div class="join-row">
            <input id="lb-code" maxlength="5" placeholder="${t('lb.codePh')}" autocapitalize="characters" value="${escapeHtml(inviteCode)}">
            <button id="lb-join" class="btn ${inviteCode ? 'primary' : ''}">${t('lb.join')}</button>
          </div>
        </div>
        <p class="error" id="lb-error">${escapeHtml(error)}</p>
      </div>`;
    const nameEl = root.querySelector('#lb-name');
    const codeEl = root.querySelector('#lb-code');
    const errEl = root.querySelector('#lb-error');
    const buttons = root.querySelectorAll('button');
    (nameEl.value ? (inviteCode ? root.querySelector('#lb-join') : root.querySelector('#lb-create')) : nameEl).focus();

    const getName = () => {
      const n = nameEl.value.trim();
      if (!n) { errEl.textContent = t('lb.needName'); nameEl.focus(); return null; }
      saveName(n);
      return n;
    };
    const busy = (msg) => { buttons.forEach((b) => (b.disabled = true)); errEl.className = 'muted'; errEl.textContent = msg; };

    root.querySelector('#lb-create').onclick = async () => {
      const name = getName();
      if (!name) return;
      busy(t('lb.creating'));
      try { enter(await Room.host(name, maxPlayers)); } catch (e) { renderSetup(e.message); }
    };
    const join = async () => {
      const name = getName();
      if (!name) return;
      const code = codeEl.value.trim().toUpperCase();
      if (code.length < 5) { errEl.textContent = t('lb.code5'); codeEl.focus(); return; }
      busy(t('lb.joining'));
      try { enter(await Room.join(code, name)); } catch (e) { renderSetup(e.message); }
    };
    root.querySelector('#lb-join').onclick = join;
    codeEl.onkeydown = (e) => { if (e.key === 'Enter') join(); };
    codeEl.oninput = () => { codeEl.value = codeEl.value.toUpperCase(); };
  }

  function enter(r) {
    room = r;
    window.addEventListener('pagehide', () => room?.leave());
    room.on('players', () => { if (!started) renderPlayers(); });
    room.on('disconnected', () => showNotice('lb.hostGone'));
    room.on('message', (m) => {
      if (m?.type === '__start' && !started) {
        started = true;
        view = 'game';
        root.hidden = true;
        gameEl.hidden = false;
        onStart(room);
      }
    });
    renderRoom();
  }

  function renderRoom() {
    view = 'room';
    const link = `${location.origin}${location.pathname}?room=${room.code}`;
    root.innerHTML = `
      <div class="card lobby">
        <p class="muted">${t('lb.roomCode')}</p>
        <div class="code">${room.code}</div>
        <div class="invite">
          <input readonly value="${escapeHtml(link)}">
          <button id="lb-copy" class="btn">${t('lb.copy')}</button>
        </div>
        <h3>${t('lb.playersH')} <span id="lb-count"></span></h3>
        <ul class="players" id="lb-players"></ul>
        <div id="lb-host-area"></div>
        <button id="lb-leave" class="btn ghost">${t('lb.leave')}</button>
      </div>`;
    root.querySelector('#lb-copy').onclick = async (e) => {
      try { await navigator.clipboard.writeText(link); e.target.textContent = t('lb.copied'); }
      catch { root.querySelector('.invite input').select(); }
    };
    root.querySelector('#lb-leave').onclick = () => { room.leave(); room = null; renderSetup(); };
    renderPlayers();
  }

  function renderPlayers() {
    const list = root.querySelector('#lb-players');
    if (!list) return;
    list.innerHTML = playerItems(room.players, room.myId, (p) =>
      (room.isHost && p.bot ? `<button class="btn ghost rm" data-rm="${p.id}" title="${t('lb.removeBot')}">✕</button>` : ''));
    list.onclick = (e) => { const b = e.target.closest('[data-rm]'); if (b) room.removeBot(b.dataset.rm); };
    root.querySelector('#lb-count').textContent = `(${room.players.length}/${maxPlayers})`;
    const area = root.querySelector('#lb-host-area');
    if (room.isHost) {
      const enough = room.players.length >= minPlayers;
      const canAddBot = bots && room.players.length < maxPlayers;
      area.innerHTML = `${canAddBot ? `<button id="lb-bot" class="btn" style="width:100%">${t('lb.addBot')}</button>` : ''}
        <button id="lb-start" class="btn primary big" ${enough ? '' : 'disabled'} style="margin-top:10px">${t('lb.start')}</button>
        ${enough ? '' : `<p class="muted">${t('lb.needMore', { n: minPlayers })}${bots ? t('lb.countBots') : ''}</p>`}`;
      area.querySelector('#lb-bot')?.addEventListener('click', () => room.addBot());
      area.querySelector('#lb-start').onclick = () => {
        room.locked = true;
        room.broadcast({ type: '__start' });
      };
    } else {
      area.innerHTML = `<p class="muted waiting">${t('lb.waitStart')}</p>`;
    }
  }
}

export function playerItems(players, myId, extra = () => '') {
  return players.map((p) => `
    <li style="--pc:${COLORS[p.color % COLORS.length]}">
      <span class="dot"></span>
      <span class="pname">${p.bot ? '🤖 ' : ''}${escapeHtml(p.name)}${p.id === myId ? ` <em>${t('c.you')}</em>` : ''}${p.left ? ` <em>${t('c.left')}</em>` : ''}${p.host ? ' 👑' : ''}</span>
      ${extra(p)}
    </li>`).join('');
}

export function showNotice(key) {
  let el = document.getElementById('notice');
  if (!el) {
    el = document.createElement('div');
    el.id = 'notice';
    el.className = 'overlay';
    document.body.appendChild(el);
  }
  el.innerHTML = `<div class="card"><p>${escapeHtml(t(key))}</p>
    <div class="row"><button class="btn primary" onclick="location.href=location.pathname">${t('lb.backRoom')}</button>
    <a class="btn ghost" href="../../">${t('lb.homePage')}</a></div></div>`;
  if (!el.dataset.lang) { el.dataset.lang = '1'; onLang(() => showNotice(key)); }
}
