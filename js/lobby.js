// Shared lobby UI: name, create/join room, player list, start button.
// A game page needs <section id="lobby"> and <section id="game" hidden>.
import { Room, COLORS, escapeHtml } from './net.js';

const NAME_KEY = 'selvaworld:name';

function loadName() { try { return localStorage.getItem(NAME_KEY) || ''; } catch { return ''; } }
function saveName(n) { try { localStorage.setItem(NAME_KEY, n); } catch { /* ignore */ } }

export function createLobby({ title, minPlayers = 1, maxPlayers = 4, onStart }) {
  const root = document.getElementById('lobby');
  const gameEl = document.getElementById('game');
  const inviteCode = (new URLSearchParams(location.search).get('room') || '').toUpperCase();
  let room = null;
  let started = false;

  renderSetup();

  function renderSetup(error = '') {
    const range = minPlayers === maxPlayers ? `${maxPlayers}` : `${minPlayers}–${maxPlayers}`;
    root.innerHTML = `
      <div class="card lobby">
        <h2>${escapeHtml(title)}</h2>
        <p class="muted">เล่นได้ ${range} คน</p>
        <label class="field"><span>ชื่อของคุณ</span>
          <input id="lb-name" maxlength="16" placeholder="เช่น ต้นกล้า" value="${escapeHtml(loadName())}">
        </label>
        <div class="lobby-actions">
          <button id="lb-create" class="btn ${inviteCode ? '' : 'primary'}">สร้างห้องใหม่</button>
          <div class="or">หรือเข้าห้องเพื่อน</div>
          <div class="join-row">
            <input id="lb-code" maxlength="5" placeholder="รหัสห้อง" autocapitalize="characters" value="${escapeHtml(inviteCode)}">
            <button id="lb-join" class="btn ${inviteCode ? 'primary' : ''}">เข้าร่วม</button>
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
      if (!n) { errEl.textContent = 'ใส่ชื่อก่อนนะ'; nameEl.focus(); return null; }
      saveName(n);
      return n;
    };
    const busy = (msg) => { buttons.forEach((b) => (b.disabled = true)); errEl.className = 'muted'; errEl.textContent = msg; };

    root.querySelector('#lb-create').onclick = async () => {
      const name = getName();
      if (!name) return;
      busy('กำลังสร้างห้อง...');
      try { enter(await Room.host(name, maxPlayers)); } catch (e) { renderSetup(e.message); }
    };
    const join = async () => {
      const name = getName();
      if (!name) return;
      const code = codeEl.value.trim().toUpperCase();
      if (code.length < 5) { errEl.textContent = 'รหัสห้องมี 5 ตัวอักษร'; codeEl.focus(); return; }
      busy('กำลังเข้าห้อง...');
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
    room.on('disconnected', () => showNotice('หัวหน้าห้องออกจากห้องแล้ว / การเชื่อมต่อหลุด'));
    room.on('message', (m) => {
      if (m?.type === '__start' && !started) {
        started = true;
        root.hidden = true;
        gameEl.hidden = false;
        onStart(room);
      }
    });
    renderRoom();
  }

  function renderRoom() {
    const link = `${location.origin}${location.pathname}?room=${room.code}`;
    root.innerHTML = `
      <div class="card lobby">
        <p class="muted">รหัสห้อง</p>
        <div class="code">${room.code}</div>
        <div class="invite">
          <input readonly value="${escapeHtml(link)}">
          <button id="lb-copy" class="btn">คัดลอกลิงก์</button>
        </div>
        <h3>ผู้เล่น <span id="lb-count"></span></h3>
        <ul class="players" id="lb-players"></ul>
        <div id="lb-host-area"></div>
        <button id="lb-leave" class="btn ghost">ออกจากห้อง</button>
      </div>`;
    root.querySelector('#lb-copy').onclick = async (e) => {
      try { await navigator.clipboard.writeText(link); e.target.textContent = 'คัดลอกแล้ว ✓'; }
      catch { root.querySelector('.invite input').select(); }
    };
    root.querySelector('#lb-leave').onclick = () => { room.leave(); room = null; renderSetup(); };
    renderPlayers();
  }

  function renderPlayers() {
    const list = root.querySelector('#lb-players');
    if (!list) return;
    list.innerHTML = playerItems(room.players, room.myId);
    root.querySelector('#lb-count').textContent = `(${room.players.length}/${maxPlayers})`;
    const area = root.querySelector('#lb-host-area');
    if (room.isHost) {
      const enough = room.players.length >= minPlayers;
      area.innerHTML = `<button id="lb-start" class="btn primary big" ${enough ? '' : 'disabled'}>เริ่มเกม</button>
        ${enough ? '' : `<p class="muted">ต้องมีอย่างน้อย ${minPlayers} คน</p>`}`;
      area.querySelector('#lb-start').onclick = () => {
        room.locked = true;
        room.broadcast({ type: '__start' });
      };
    } else {
      area.innerHTML = '<p class="muted waiting">รอหัวหน้าห้องกดเริ่มเกม...</p>';
    }
  }
}

export function playerItems(players, myId, extra = () => '') {
  return players.map((p) => `
    <li style="--pc:${COLORS[p.color % COLORS.length]}">
      <span class="dot"></span>
      <span class="pname">${escapeHtml(p.name)}${p.id === myId ? ' <em>(คุณ)</em>' : ''}${p.host ? ' 👑' : ''}</span>
      ${extra(p)}
    </li>`).join('');
}

export function showNotice(text) {
  let el = document.getElementById('notice');
  if (!el) {
    el = document.createElement('div');
    el.id = 'notice';
    el.className = 'overlay';
    document.body.appendChild(el);
  }
  el.innerHTML = `<div class="card"><p>${escapeHtml(text)}</p>
    <div class="row"><button class="btn primary" onclick="location.href=location.pathname">กลับไปหน้าห้อง</button>
    <a class="btn ghost" href="../../">หน้าหลัก</a></div></div>`;
}
