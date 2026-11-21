// Tiny i18n: Thai is the default, English is available from the toggle in the top bar.
// - t(key, params) looks up the current language ({name}-style placeholders).
// - Host → player messages carry {k, p} objects instead of sentences, so every player
//   reads them in their own language; tl() renders either form.
// - Elements with data-i18n / data-i18n-ph / data-i18n-title are translated automatically.
// - Pages re-render on change via onLang(fn) (no reload, so a running game is not interrupted).

const KEY = 'selvaworld:lang';
export const LANGS = ['th', 'en'];
const dict = { th: {}, en: {} };
const listeners = [];
let cur = 'th';
try { const saved = localStorage.getItem(KEY); if (LANGS.includes(saved)) cur = saved; } catch { /* private mode */ }

// bots keep their (Thai) name in game data; English players see these instead
const BOT_EN = {
  'บอทน้องหมี': 'Bear Bot', 'บอทพี่ช้าง': 'Elephant Bot', 'บอทลุงเสือ': 'Tiger Bot', 'บอทป้าแมว': 'Cat Bot', 'บอทน้าลิง': 'Monkey Bot',
};
export const pname = (n) => (cur === 'en' && BOT_EN[n]) || n;

export const lang = () => cur;

export function t(key, p = {}) {
  const s = dict[cur][key] ?? dict.th[key] ?? key;
  return s.replace(/\{(\w+)\}/g, (_, k) => {
    const v = p[k];
    if (v == null) return '';
    if (Array.isArray(v)) return v.map((x) => pname(String(x))).join(', ');
    if (typeof v === 'object' && v.k) return t(v.k, v.p); // nested translatable value
    return pname(String(v));
  });
}

/** Render a host-sent text: plain string, {k, p} object, an array of those (joined), or null. */
export const tl = (x) => (x == null ? '' : typeof x === 'string' ? x : Array.isArray(x) ? x.map(tl).join('') : t(x.k, x.p));

export function addStrings(strings) {
  for (const l of LANGS) Object.assign(dict[l], strings[l] || {});
  applyDom();
}

export function onLang(fn) { listeners.push(fn); }

export function setLang(l) {
  if (!LANGS.includes(l) || l === cur) return;
  cur = l;
  try { localStorage.setItem(KEY, l); } catch { /* ignore */ }
  applyDom();
  for (const fn of listeners) fn(l);
}

export function applyDom(root = document) {
  document.documentElement.lang = cur;
  for (const el of root.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n) + (el.dataset.i18nAfter || '');
  for (const el of root.querySelectorAll('[data-i18n-ph]')) el.placeholder = t(el.dataset.i18nPh);
  for (const el of root.querySelectorAll('[data-i18n-title]')) el.title = t(el.dataset.i18nTitle);
  const btn = document.getElementById('lang-toggle');
  if (btn) {
    btn.textContent = cur === 'th' ? 'EN' : 'ไทย';
    btn.title = cur === 'th' ? 'Switch to English' : 'เปลี่ยนเป็นภาษาไทย';
  }
}

function mountToggle() {
  if (document.getElementById('lang-toggle')) return;
  const btn = document.createElement('button');
  btn.id = 'lang-toggle';
  btn.className = 'btn ghost lang-toggle';
  btn.type = 'button';
  btn.onclick = () => setLang(cur === 'th' ? 'en' : 'th');
  const bar = document.querySelector('.topbar');
  if (bar) bar.appendChild(btn);
  else { btn.classList.add('floating'); document.body.appendChild(btn); }
}

addStrings({
  th: {
    // game names (portal + page headers)
    'g.tactics': 'สนามยุทธ์', 'g.gems': 'เพชรเรียงสาม', 'g.dice': 'ยอดลูกเต๋า',
    'g.pokdeng': 'ป็อกเด้ง', 'g.slave': 'สลาฟ', 'g.poker': 'โป๊กเกอร์',
    'g.snake': 'งูสี่ทิศ', 'g.reaction': 'นิ้วไว', 'g.dots': 'จุดต่อกล่อง',
    // common
    'c.home': '← หน้าหลัก',
    'c.you': '(คุณ)',
    'c.left': '(ออกแล้ว)',
    'c.again': 'เล่นอีกครั้ง',
    'c.waitHostAgain': 'รอหัวหน้าห้องเริ่มรอบใหม่',
    'c.tie': 'เสมอ! 🤝',
    'c.wins': '🏆 {name} ชนะ!',
    'c.points': '{n} คะแนน',
    'c.cancel': 'ยกเลิก',
    'c.waitFor': 'รอ {name}...',
    // lobby
    'lb.players': 'เล่นได้ {range} คน',
    'lb.soloBots': ' · เล่นคนเดียวได้ เพิ่มบอทเป็นคู่แข่ง',
    'lb.yourName': 'ชื่อของคุณ',
    'lb.namePh': 'เช่น ต้นกล้า',
    'lb.create': 'สร้างห้องใหม่',
    'lb.or': 'หรือเข้าห้องเพื่อน',
    'lb.codePh': 'รหัสห้อง',
    'lb.join': 'เข้าร่วม',
    'lb.needName': 'ใส่ชื่อก่อนนะ',
    'lb.creating': 'กำลังสร้างห้อง...',
    'lb.code5': 'รหัสห้องมี 5 ตัวอักษร',
    'lb.joining': 'กำลังเข้าห้อง...',
    'lb.hostGone': 'หัวหน้าห้องออกจากห้องแล้ว / การเชื่อมต่อหลุด',
    'lb.roomCode': 'รหัสห้อง',
    'lb.copy': 'คัดลอกลิงก์',
    'lb.copied': 'คัดลอกแล้ว ✓',
    'lb.playersH': 'ผู้เล่น',
    'lb.leave': 'ออกจากห้อง',
    'lb.removeBot': 'เอาบอทออก',
    'lb.addBot': '🤖 เพิ่มบอท',
    'lb.start': 'เริ่มเกม',
    'lb.needMore': 'ต้องมีอย่างน้อย {n} คน',
    'lb.countBots': ' (นับบอทด้วย)',
    'lb.waitStart': 'รอหัวหน้าห้องกดเริ่มเกม...',
    'lb.backRoom': 'กลับไปหน้าห้อง',
    'lb.homePage': 'หน้าหลัก',
    // network
    'net.createFail': 'สร้างห้องไม่สำเร็จ ลองใหม่อีกครั้ง',
    'net.started': 'เกมเริ่มไปแล้ว รอรอบหน้านะ',
    'net.full': 'ห้องเต็มแล้ว',
    'net.timeout': 'เชื่อมต่อไม่สำเร็จ (หมดเวลา) ลองตรวจรหัสห้องอีกครั้ง',
    'net.noRoom': 'ไม่พบห้องนี้ ตรวจรหัสอีกครั้ง',
    'net.closed': 'การเชื่อมต่อถูกปิด',
    'net.browser': 'เบราว์เซอร์นี้ไม่รองรับ WebRTC',
    'net.network': 'เชื่อมต่อเซิร์ฟเวอร์จับคู่ไม่ได้ ตรวจอินเทอร์เน็ต',
    'net.server': 'เซิร์ฟเวอร์จับคู่มีปัญหา ลองใหม่อีกครั้ง',
    'net.socket': 'เชื่อมต่อเซิร์ฟเวอร์จับคู่ไม่ได้',
    'net.error': 'เกิดข้อผิดพลาด: {e}',
    'net.player': 'ผู้เล่น',
  },
  en: {
    'g.tactics': 'Tactics Arena', 'g.gems': 'Gem Rush', 'g.dice': 'Dice Master',
    'g.pokdeng': 'Pok Deng', 'g.slave': 'Slave', 'g.poker': 'Poker',
    'g.snake': 'Snake Arena', 'g.reaction': 'Fast Finger', 'g.dots': 'Dots & Boxes',
    'c.home': '← Home',
    'c.you': '(you)',
    'c.left': '(left)',
    'c.again': 'Play again',
    'c.waitHostAgain': 'Waiting for the host to start the next round',
    'c.tie': "It's a tie! 🤝",
    'c.wins': '🏆 {name} wins!',
    'c.points': '{n} points',
    'c.cancel': 'Cancel',
    'c.waitFor': 'Waiting for {name}...',
    'lb.players': '{range} players',
    'lb.soloBots': ' · play solo by adding bots',
    'lb.yourName': 'Your name',
    'lb.namePh': 'e.g. Alex',
    'lb.create': 'Create a room',
    'lb.or': "or join a friend's room",
    'lb.codePh': 'Room code',
    'lb.join': 'Join',
    'lb.needName': 'Enter your name first',
    'lb.creating': 'Creating room...',
    'lb.code5': 'Room codes have 5 characters',
    'lb.joining': 'Joining room...',
    'lb.hostGone': 'The host left the room / connection lost',
    'lb.roomCode': 'Room code',
    'lb.copy': 'Copy link',
    'lb.copied': 'Copied ✓',
    'lb.playersH': 'Players',
    'lb.leave': 'Leave room',
    'lb.removeBot': 'Remove bot',
    'lb.addBot': '🤖 Add bot',
    'lb.start': 'Start game',
    'lb.needMore': 'Needs at least {n} players',
    'lb.countBots': ' (bots count)',
    'lb.waitStart': 'Waiting for the host to start...',
    'lb.backRoom': 'Back to lobby',
    'lb.homePage': 'Home',
    'net.createFail': "Couldn't create a room, please try again",
    'net.started': 'The game has already started, wait for the next one',
    'net.full': 'The room is full',
    'net.timeout': 'Connection timed out, check the room code',
    'net.noRoom': 'Room not found, check the code',
    'net.closed': 'The connection was closed',
    'net.browser': "This browser doesn't support WebRTC",
    'net.network': "Can't reach the matchmaking server, check your internet",
    'net.server': 'The matchmaking server had a problem, try again',
    'net.socket': "Can't connect to the matchmaking server",
    'net.error': 'Error: {e}',
    'net.player': 'Player',
  },
});

mountToggle();
applyDom();
