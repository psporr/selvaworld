# Selva World 🎮

A portal of online web games for playing with up to 6 players (bots can fill seats), hosted free on GitHub Pages with no server.

## How it works

- **No backend at all.** Browsers connect to each other directly over WebRTC using [PeerJS](https://peerjs.com/).
  PeerJS's free public server is used only for matchmaking (signaling) at the start.
- The **room creator (host)** acts as the server. The host's browser runs the game logic, receives inputs from
  the other players and sends state back to everyone. **If the host closes the tab, the game ends for everyone.**
- A room has a 5-character code, and you can also send an invite link (`?room=CODE`).

## Games

| Game | Players | Type |
|---|---|---|
| ⚔️ Tactics Arena (`games/tactics`) | 1–6 | SRPG: knight / archer / mage squads on a grid, forest cover, counterattacks, deterministic damage with a forecast panel |
| 💎 Gem Rush (`games/gems`) | 1–6 | Puzzle: 90-second match-3 race, everyone starts from the same seeded board, cascades multiply points |
| 🎲 Dice Master (`games/dice`) | 1–6 | Tabletop: Yacht-style dice, 3 rolls per turn with holds, 12 categories, upper-section bonus |
| 🐍 Snake Arena (`games/snake`) | 1–6 | Real-time: grow longer, the last snake alive wins (or the longest one after 90 s) |
| ⚡ Fast Finger (`games/reaction`) | 1–6 | Reaction: 5 rounds, tap when the screen turns green |
| 🔲 Dots and Boxes (`games/dots`) | 1–6 | Turn-based: close a box to score a point |
| 🃏 Pok Deng (`games/pokdeng`) | 1–6 | Cards: dealer rotates each round, Pok 8/9, 2–3 deng, tong, straight, sian |
| 👑 Slave (`games/slave`) | 1–6 | Cards: Thai rules (3 lowest, 2 highest, ♣<♦<♥<♠), card exchange between King and Slave |
| ♠️ Poker (`games/poker`) | 1–6 | Texas Hold'em, 1000 chips each, blinds 10/20, side pots |

Card games use `js/cards.js` + `css/cards.css`. Each player's hidden cards are sent privately
with `room.sendTo(id, data)`, so other players' browsers never receive cards they can't see.

Every game supports 1–6 players and can be played solo against bots: the host presses **🤖 Add bot** in the lobby (bots run on the host's browser via `js/bots.js`).
Game rules live in each game's `rules.js` (pure functions shared by host, players and bots).
To give a new game bots, pass `bots: true` to `createLobby` and drive them with `botRunner(room, decide, handle)`.

## Languages (Thai / English)

Thai is the default; the **EN / ไทย** button in the top bar switches language instantly (no reload, so a game in
progress keeps running) and the choice is remembered in the browser.

- `js/i18n.js`: `t(key, params)`, `addStrings({ th: {...}, en: {...} })`, `onLang(render)`; elements with
  `data-i18n="key"` are translated automatically. Shared strings (lobby, game names) live there; each game adds its own
  strings at the top of its `game.js`.
- Text the **host** sends to players (logs, hand names, titles) travels as `{ k: key, p: params }` objects and is
  rendered with `tl()`, so a Thai host and an English guest each read it in their own language.
- Rules files return keys (e.g. `pk.h.flush`, `sl.t.king`, `tc.c.knight`) rather than display text.

## Publishing to GitHub Pages

1. Merge into the `main` branch
2. Go to **Settings → Pages → Build and deployment**
3. Source: **Deploy from a branch** → Branch: `main` / folder `/ (root)` → Save
4. Wait about 1 minute. The site will be at `https://<username>.github.io/selvaworld/`

## Running locally

```bash
python3 -m http.server 8080
# Open http://localhost:8080 in several tabs to test multiplayer
```

(The files use ES modules, so open them through a web server, not by double-clicking the file.)

## Adding a new game

1. Create the folder `games/<id>/` with `index.html` (copy the structure from an existing game: it needs
   `<section id="lobby">`, `<section id="game" hidden>` and the PeerJS script tag)
2. In `game.js`:

```js
import { createLobby } from '../../js/lobby.js';

createLobby({ title: 'My Game', minPlayers: 2, maxPlayers: 4, onStart });

function onStart(room) {
  // every player (host included)
  room.on('message', (m) => { /* render state from the host */ });
  button.onclick = () => room.toHost({ type: 'move', ... });   // send input to the host

  if (room.isHost) {
    room.on('input', (data, fromId) => { /* validate, update state */ room.broadcast(state); });
    room.on('leave', (id) => { /* handle a player leaving mid-game */ });
  }
}
```

3. Add the game card to the `GAMES` list in `index.html`

## Room API (`js/net.js`)

- `room.players`: `[{ id, name, color, host? }]`; `room.myId`; `room.isHost`; `room.code`
- `room.toHost(data)`: send input to the host
- `room.broadcast(data)`: host only, sends to everyone including the host
- `room.addBot()` / `room.removeBot(id)`: host only, in the lobby; bots appear in `room.players` with `bot: true`
- `room.sendTo(id, data)`: host only, sends privately to one player (e.g. their hand)
- Events: `players`, `message`, `input` (host), `join`/`leave` (host), `disconnected` (players)

## Limitations

- Some networks (e.g. strict corporate or school networks, some mobile NATs) may fail to connect because there
  is no TURN server. Most home networks and 4G/5G work fine.
- After a game starts the room is locked, so new players can't join mid-game.
