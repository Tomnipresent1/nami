// How sharp the paintings are drawn. A modest phone can't paint at full sharpness 60 times a second, and a jittery print is
// not relaxing (v3.22, Tom: Plum Blossom jittered on a budget phone). SHARP = the screen's full sharpness (up to 2x),
// SMOOTH = plain 1x, AUTO starts sharp and quietly steps down if the frames come too slowly, then remembers what this phone needed.
export const QUALITY_OPTS = ['AUTO', 'SMOOTH', 'SHARP'];
export const RES_STEPS = [2, 1.5, 1];             // the most canvas pixels per screen point; AUTO walks down these
export const view = { res: 2 };                    // read by the paintings when they size the canvas

/** Canvas pixels per screen point for this phone right now. */
export function pixelRatio() { return Math.min(window.devicePixelRatio || 1, view.res); }

// AUTO's watcher: frame gaps are collected only while a print is actually being played. After a settling second it looks at
// 2-second windows; two slow windows in a row (typical gap longer than SLOW_MS, i.e. under about 45 frames a second) = one step down.
export const SLOW_MS = 22;
export function createAutoRes(start = 0) {
  const a = { step: Math.max(0, Math.min(RES_STEPS.length - 1, start | 0)), warm: 0, gaps: [], span: 0, slow: 0 };
  a.reset = () => { a.warm = 0; a.gaps.length = 0; a.span = 0; a.slow = 0; };
  /** One frame: gap in ms since the last one, and whether a print is being played. Returns true when it stepped down. */
  a.feed = (gap, active) => {
    if (!active || gap > 250) { a.warm = 0; a.gaps.length = 0; a.span = 0; return false; }   // paused, album, or a hiccup
    if ((a.warm += gap) < 1000) return false;
    a.gaps.push(gap); a.span += gap;
    if (a.span < 2000) return false;
    const sorted = a.gaps.slice().sort((x, y) => x - y), typical = sorted[sorted.length >> 1];
    a.gaps.length = 0; a.span = 0;
    a.slow = typical > SLOW_MS ? a.slow + 1 : 0;
    if (a.slow < 2 || a.step >= RES_STEPS.length - 1) return false;
    a.step++; a.reset();
    return true;
  };
  return a;
}
