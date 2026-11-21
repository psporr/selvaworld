// Runs computer players on the host. `decide(botId)` returns an input object (the same
// shape a human player would send) or null; `handle(input, botId)` is the game's input handler.
// Call the returned kick() after every state change; bots act one at a time with a short delay
// so humans can follow what happened.
export function botRunner(room, decide, handle, delay = 750) {
  let timer = null;
  return function kick() {
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      for (const p of room.players) {
        if (!p.bot) continue;
        const action = decide(p.id);
        if (action) { handle(action, p.id); return; }
      }
    }, delay);
  };
}
