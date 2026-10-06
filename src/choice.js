// The pair of buttons shown when a crossing or a print is finished ("carry on" / "back to the album"), shared by every print.
// Pure layout + hit-testing (tools/selftest.mjs checks it); ui.js draws them.
export const CHOICE_WAIT = 0.8;          // seconds before the buttons answer, so a finger still steering can't choose by accident
/** Where button i (0 = left, 1 = right) sits: [centre x, centre y, width, height], in picture units. */
export const choiceBox = (i, W) => [W / 2 + (i === 0 ? -175 : 175), 372, 310, 64];
/** Which button (0 / 1) is at picture point x,y; -1 for neither (generous, for thumbs). */
export function choiceAt(x, y, W) {
  for (let i = 0; i < 2; i++) { const [cx, cy, w, h] = choiceBox(i, W); if (Math.abs(x - cx) <= w / 2 + 10 && Math.abs(y - cy) <= h / 2 + 24) return i; }
  return -1;
}
/** Read keys + taps for a pair of buttons: returns the chosen button, or -1; arrow keys move `sel` (returned in .sel). */
export function readChoice(keys, taps, W, sel) {
  for (const k of keys) {
    if (k === 'left' || k === 'right' || k === 'up' || k === 'down') sel = 1 - sel;
    else if (k === 'enter') return { chosen: sel, sel };
  }
  for (const p of taps) { const c = choiceAt(p.x, p.y, W); if (c >= 0) return { chosen: c, sel: c }; }
  return { chosen: -1, sel };
}
