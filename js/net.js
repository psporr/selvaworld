// Selva World networking: peer-to-peer rooms over WebRTC (PeerJS).
// The host's browser is the "server": it holds the authoritative game state,
// receives inputs from players and broadcasts state back to everyone.
// No backend is needed, so the site works on GitHub Pages.

const PREFIX = 'selvaworld-v1-';
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export const COLORS = ['#ff5c7a', '#4cc9f0', '#ffd166', '#7bd389', '#c084fc', '#fb923c'];

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}

const BOT_NAMES = ['บอทน้องหมี', 'บอทพี่ช้าง', 'บอทลุงเสือ', 'บอทป้าแมว', 'บอทน้าลิง'];

function makeCode(len = 5) {
  const buf = crypto.getRandomValues(new Uint32Array(len));
  return Array.from(buf, (n) => ALPHABET[n % ALPHABET.length]).join('');
}

class Emitter {
  constructor() { this._h = {}; }
  on(ev, fn) { (this._h[ev] ??= []).push(fn); return () => this.off(ev, fn); }
  off(ev, fn) { this._h[ev] = (this._h[ev] || []).filter((f) => f !== fn); }
  emit(ev, ...args) { for (const fn of [...(this._h[ev] || [])]) fn(...args); }
}

/**
 * Events:
 *  'players'  (players)       player list changed (everyone)
 *  'message'  (data)          host broadcast received (everyone, host included)
 *  'input'    (data, fromId)  player input received (host only, host's own input included)
 *  'join' / 'leave' (id)      (host only)
 *  'disconnected'             lost connection to host (players only)
 */
export class Room extends Emitter {
  constructor() {
    super();
    this.players = [];      // [{ id, name, color, host? }]
    this.conns = new Map(); // host: peerId -> DataConnection
    this.isHost = false;
    this.locked = false;    // host: refuse new joins (game in progress)
    this.maxPlayers = 6;
  }

  get me() { return this.players.find((p) => p.id === this.myId); }
  player(id) { return this.players.find((p) => p.id === id); }

  static async host(name, maxPlayers = 6) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await Room._tryHost(name, maxPlayers, makeCode());
      } catch (err) {
        if (err?.type !== 'unavailable-id') throw new Error(describe(err));
      }
    }
    throw new Error('สร้างห้องไม่สำเร็จ ลองใหม่อีกครั้ง');
  }

  static _tryHost(name, maxPlayers, code) {
    return new Promise((resolve, reject) => {
      const room = new Room();
      room.isHost = true;
      room.code = code;
      room.maxPlayers = maxPlayers;
      const peer = new Peer(PREFIX + code);
      room.peer = peer;
      let opened = false;
      peer.on('open', (id) => {
        opened = true;
        room.myId = id;
        room.players = [{ id, name, color: 0, host: true }];
        // heartbeat so players notice quickly if the host vanishes
        room._ping = setInterval(() => {
          for (const c of room.conns.values()) if (c.open) c.send({ t: 'ping' });
        }, 2000);
        resolve(room);
      });
      peer.on('connection', (conn) => room._accept(conn));
      peer.on('disconnected', () => { if (!peer.destroyed) peer.reconnect(); });
      peer.on('error', (err) => {
        if (!opened) { peer.destroy(); reject(err); } else room.emit('error', err);
      });
    });
  }

  _accept(conn) {
    conn.on('data', (msg) => {
      if (!msg || typeof msg !== 'object') return;
      if (msg.t === 'hello') {
        if (this.locked) return this._refuse(conn, 'เกมเริ่มไปแล้ว รอรอบหน้านะ');
        if (this.players.length >= this.maxPlayers) return this._refuse(conn, 'ห้องเต็มแล้ว');
        const color = this._freeColor();
        const name = String(msg.name || 'ผู้เล่น').slice(0, 16);
        this.conns.set(conn.peer, conn);
        this.players.push({ id: conn.peer, name, color });
        conn.send({ t: 'welcome', id: conn.peer, players: this.players });
        this._syncPlayers();
        this.emit('join', conn.peer);
      } else if (msg.t === 'in' && this.conns.has(conn.peer)) {
        this.emit('input', msg.d, conn.peer);
      }
    });
    conn.on('close', () => this._drop(conn.peer));
    conn.on('error', () => this._drop(conn.peer));
  }

  _freeColor() {
    const used = new Set(this.players.map((p) => p.color));
    let color = 0;
    while (used.has(color)) color++;
    return color;
  }

  /** Host only: add a computer player. The game's host logic plays for it. */
  addBot() {
    if (!this.isHost || this.locked || this.players.length >= this.maxPlayers) return;
    const taken = new Set(this.players.map((p) => p.name));
    const name = BOT_NAMES.find((n) => !taken.has(n)) || `บอท ${this.players.length}`;
    this.players.push({ id: `bot-${makeCode(6)}`, name, color: this._freeColor(), bot: true });
    this._syncPlayers();
  }

  removeBot(id) {
    if (!this.isHost || this.locked) return;
    this.players = this.players.filter((p) => !(p.bot && p.id === id));
    this._syncPlayers();
  }

  _refuse(conn, reason) {
    conn.send({ t: 'reject', reason });
    setTimeout(() => conn.close(), 500);
  }

  _drop(id) {
    if (!this.conns.has(id)) return;
    this.conns.delete(id);
    this.players = this.players.filter((p) => p.id !== id);
    this._syncPlayers();
    this.emit('leave', id);
  }

  _syncPlayers() {
    for (const c of this.conns.values()) if (c.open) c.send({ t: 'players', players: this.players });
    this.emit('players', this.players);
  }

  static join(code, name) {
    return new Promise((resolve, reject) => {
      const room = new Room();
      room.code = String(code).toUpperCase().trim();
      const peer = new Peer();
      room.peer = peer;
      let done = false;
      const fail = (msg) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        peer.destroy();
        reject(new Error(msg));
      };
      const timer = setTimeout(() => fail('เชื่อมต่อไม่สำเร็จ (หมดเวลา) ลองตรวจรหัสห้องอีกครั้ง'), 15000);
      peer.on('error', (err) => {
        if (!done) fail(err?.type === 'peer-unavailable' ? 'ไม่พบห้องนี้ ตรวจรหัสอีกครั้ง' : describe(err));
        else room.emit('error', err);
      });
      peer.on('open', () => {
        const conn = peer.connect(PREFIX + room.code, { reliable: true });
        room.hostConn = conn;
        conn.on('open', () => conn.send({ t: 'hello', name }));
        conn.on('data', (msg) => {
          room._lastSeen = Date.now();
          switch (msg?.t) {
            case 'welcome':
              room._watchHost();
              room.myId = msg.id;
              room.players = msg.players;
              done = true;
              clearTimeout(timer);
              resolve(room);
              break;
            case 'reject': fail(msg.reason); break;
            case 'players': room.players = msg.players; room.emit('players', room.players); break;
            case 'msg': room.emit('message', msg.d); break;
          }
        });
        conn.on('close', () => { if (done) room._lost(); else fail('การเชื่อมต่อถูกปิด'); });
      });
    });
  }

  _watchHost() {
    this._lastSeen = Date.now();
    this._watch = setInterval(() => { if (Date.now() - this._lastSeen > 8000) this._lost(); }, 2000);
  }

  _lost() {
    if (this._gone) return;
    this._gone = true;
    clearInterval(this._watch);
    this.emit('disconnected');
  }

  /** Send player input to the host (works for the host too). */
  toHost(data) {
    if (this.isHost) queueMicrotask(() => this.emit('input', data, this.myId));
    else if (this.hostConn?.open) this.hostConn.send({ t: 'in', d: data });
  }

  /** Host only: send a message to every player, host included. */
  broadcast(data) {
    if (!this.isHost) return;
    for (const c of this.conns.values()) if (c.open) c.send({ t: 'msg', d: data });
    queueMicrotask(() => this.emit('message', data));
  }

  /** Host only: send a private message to one player (e.g. their own cards). */
  sendTo(id, data) {
    if (!this.isHost) return;
    if (id === this.myId) { queueMicrotask(() => this.emit('message', data)); return; }
    const c = this.conns.get(id);
    if (c?.open) c.send({ t: 'msg', d: data });
  }

  leave() {
    clearInterval(this._ping);
    clearInterval(this._watch);
    this._gone = true;
    try { this.peer?.destroy(); } catch { /* ignore */ }
  }
}

function describe(err) {
  const map = {
    'browser-incompatible': 'เบราว์เซอร์นี้ไม่รองรับ WebRTC',
    network: 'เชื่อมต่อเซิร์ฟเวอร์จับคู่ไม่ได้ ตรวจอินเทอร์เน็ต',
    'server-error': 'เซิร์ฟเวอร์จับคู่มีปัญหา ลองใหม่อีกครั้ง',
    'socket-error': 'เชื่อมต่อเซิร์ฟเวอร์จับคู่ไม่ได้',
  };
  return map[err?.type] || `เกิดข้อผิดพลาด: ${err?.type || err?.message || err}`;
}
