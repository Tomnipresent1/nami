// THE RIVER (print 5, after Hiroshige's "Kawaguchi Ferry and Zenkoji Temple", 100 Famous Views of Edo): the rules.
// A PORTRAIT trial (Tom, 2026-10-09: "just to see how awkward the phone turn is, and what gameplay is like in portrait").
// You pole a timber raft down the river with a few boxes on board. The current carries you; slide a finger to pole across the
// stream, round the slower rafts, the reed beds and the ferry. At the landing on the near bank (bottom left) you hand the
// boxes up one at a time (the UNLOAD button) to the porters waiting there, who carry them off. Nothing to lose.
// Pure logic: no drawing, no sound, no DOM. tools/selftest.mjs plays it with a bot.
//
// Picture space: RIVER_W (600) wide and H tall (800-1400, the phone's own upright shape; see heightFor). Positions on the river:
// s = how far down it (0 = where you start, top left; 1 = the landing), d = how far across (0 = the near bank, bottom/left;
// 1 = the far bank, up/right).
import { clamp, smooth } from './ocean.js';

export const RIVER_W = 600;
export const MIN_H = 800;
export const MAX_H = 1400;
/** The picture's height for a screen of this shape (long side / short side). */
export const heightFor = (aspect) => Math.round(clamp(RIVER_W * aspect, MIN_H, MAX_H));

// the river's middle line, as fractions of the picture (u across, v down), traced from the print and Tom's route (research 13).
// A SCROLLER (v1.5.8, Tom: "maybe just the length of two back to back screens... like we have a birds eye view and are slowly
// drifting down the river"): the print is the LOWER screen (v 0..1, unchanged); UP is a new screen of river above it (v -1..0),
// winding down from the top right. The view follows the raft down and settles on the print at the landing.
// (the print's first point moved in from the very edge, 0.02 -> 0.11: scrolling, you pass through there and were half off screen)
// (v1.5.9, Tom: wider and more centred: the whole course pulled in toward the middle; the print's lower half is as it was)
// (v1.5.14, Tom: further toward the centre and a harder curve: down the right of centre, a tight swing left, then back right to
// the landing, which stays where it was)
const UP = [[0.63, -1.74], [0.63, -1.56], [0.63, -1.36], [0.63, -1.18], [0.64, -1.0], [0.65, -0.82], [0.64, -0.64], [0.6, -0.45], [0.43, -0.25]];
const CL = [...UP, [0.31, -0.06], [0.29, 0.10], [0.32, 0.27], [0.5, 0.41], [0.65, 0.53], [0.7, 0.67], [0.70, 0.81], [0.72, 0.97], [0.74, 1.12], [0.76, 1.27], [0.78, 1.42], [0.8, 1.57]];
const S_PER_SEG = 0.2;              // s from one point to the next; s = 0 at the print's CL[1], s = 1 (the landing) at its CL[6]
/** Where you set off: near the top of the upper screen (s < 0 is the stretch above the print). */
export const START_S = -0.5;   // (Tom: trip shorter: v1.5.10 a quarter, v1.5.11 to ~70 s like the other prints)
/** How far the view can scroll up above the print (picture heights). */
export const SCROLL_UP = 0.67;
/** Where the camera comes to rest (v1.5.15, Tom): the landing in the middle of the screen, a little below the print's own frame. */
export const camEnd = (H) => riverPoint(1, 0.5, H)[1] - H * 0.5;   // the camera's top: you start ~0.32 of the way down it, so it follows you from the first moment
const cat = (a, b, c, d, t) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
function centreUV(s) {
  const f = clamp(1 + UP.length + s / S_PER_SEG, 0, CL.length - 1.0001), i = Math.floor(f), t = f - i;
  const P = (k) => CL[clamp(k, 0, CL.length - 1)];
  return [cat(P(i - 1)[0], P(i)[0], P(i + 1)[0], P(i + 2)[0], t), cat(P(i - 1)[1], P(i)[1], P(i + 1)[1], P(i + 2)[1], t)];
}
/** The middle of the river at s: [x, y] in picture units. */
export const centre = (s, H) => { const [u, v] = centreUV(s); return [u * RIVER_W, v * H]; };
/** Half the river's width at s (picture units): narrow far away at the top, wide near the bottom. */
// (a little narrower on a shorter screen, where the bends are squeezed tighter, so the inside bank never folds back)
export const halfWidth = (s, H = 1300) => RIVER_W * (0.145 + 0.115 * smooth((s + 0.1) / 0.75)) * (0.66 + 0.34 * smooth((H - 800) / 500));
/** Which way the water flows at s (unit vector) and the way across toward the far bank (d = 1). */
export function frame(s, H) {
  const a = centre(s - 0.004, H), b = centre(s + 0.004, H);
  let tx = b[0] - a[0], ty = b[1] - a[1]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
  return { tx, ty, nx: ty, ny: -tx };
}
/** A point on the river: s down, d across. */
export function riverPoint(s, d, H) {
  const [cx, cy] = centre(s, H), f = frame(s, H), o = (d - 0.5) * 2 * halfWidth(s, H);
  return [cx + f.nx * o, cy + f.ny * o];
}
/** How big things look there (a high view: further up the picture = further away). */
export const scaleAt = (s) => 0.6 + 0.4 * clamp(s, 0, 1.2);

export const RTUNE = {
  // (v1.5.4, Tom: "far too slippy... you can't rush it, you have to go with the river"; not a race: everyone at one languid pace)
  easeIn: 3,                // seconds for the raft (and the camera following it) to come up to the river's pace from a standstill (v1.5.22)
  journeySecs: 43,          // s per second = 1 / this: the river's pace, the same for every raft, you included (whole trip ~70 s)
  others: 4,                // other timber rafts on the river (drifting at the same pace, holding their lines)
  acrossSpeed: 0.085,       // river widths per second at most (v1.5.14: a little slower again, was 0.11), poling across (keys or finger): a heavy raft, a pole on the riverbed
  pickUp: 0.9,              // how quickly it gathers way across (1/s): slow to get going
  settle: 2.8,              // ... and how quickly the water stops it when you stop poling (1/s): no sliding on
  fingerFollow: 14, aimLead: 0.08,   // the finger is a trackpad, like the bridge's
  // steered from the back (v1.5.5, Tom: it moved sideways as a block): poling swings the STERN out at once and the raft turns
  // about its bow, then it gathers way across in the direction it now points; let go and it straightens
  // (v1.5.6, Tom: v1.5.5 felt like a rally car drifting: slowed right down, and it only moves across as far as it points)
  maxYaw: 0.22,             // the most it turns from the line of the river (radians, about 13 degrees)
  yawRate: 0.85,            // how quickly it swings round as he pushes (1/s): about 2 s to come round (v1.5.14, was 1.1)
  yawBack: 1.6,             // ... and how quickly it straightens once he stops
  bodyS: 0.05, bodyD: 0.16, // how close counts as bumping another raft (along, across)
  bumpStop: 1.1,
  reedSlow: 0.5,
  landingFrom: 0.92,        // from here the current eases and carries you in to the landing
  boxes: 3,
  liftSecs: 1.5,            // handing one box up to a porter
  porterSpeed: 30,          // picture units a second
};
// (v1.5.23, Tom: the rushes slowed the raft down: none now; the rules for them stay, should any come back)
export const REEDS = [];
export const REED_S = 0.05;                         // a reed bed's size (along, across)
export const REED_D = 0.2;
export const FERRY_S = 0.76;                        // the ferry crosses back and forth here
// v1.5.2 (Tom): the ferry lay right across everyone's path: taken out for now (it still runs in the rules, unseen and harmless)
export const SHOW_FERRY = false;
export const RIVER_PAUSE_ROWS = ['resume', 'album', 'sound', 'restart'];
/** Where pause row i sits (picture y). */
export const pauseRowY = (i, H) => H * 0.3 + i * 92;
export const DONE_CHOICES = ['SAIL AGAIN', 'BACK TO THE ALBUM'];
export const DONE_WAIT = 3.5;
/** The two buttons at the end, one above the other: [centre x, centre y, width, height]. */
export const doneButton = (i, H) => [RIVER_W / 2, H * 0.52 + i * 100, 400, 70];
export function doneButtonAt(x, y, H) {
  for (let i = 0; i < 2; i++) { const [cx, cy, w, h] = doneButton(i, H); if (Math.abs(x - cx) <= w / 2 + 10 && Math.abs(y - cy) <= h / 2 + 14) return i; }
  return -1;
}
/** The round UNLOAD button (bottom right, under the thumb): [x, y, r]. */
export const unloadButton = (H) => [RIVER_W * 0.76, H - 170, 60];
export const onUnloadButton = (x, y, H) => { const [bx, by, r] = unloadButton(H); return Math.hypot(x - bx, y - by) <= r + 22; };

function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export class River {
  constructor({ height = 1200, seed = Date.now() } = {}) {
    this.W = RIVER_W; this.H = clamp(Math.round(height), MIN_H, MAX_H);
    this.portrait = true;
    this.rand = mulberry32(seed);
    this.settings = { sound: true };
    this.onSettings = null;
    this.paused = false; this.pauseRow = 0; this.restartArmed = false;
    this.recentreRequest = false; this.albumRequest = false;
    this.tiltSteer = false; this.tiltFlip = false;
    this.state = 'title';
    this.reset();
  }

  setWidth() {}                                            // (always RIVER_W wide)
  setHeight(h) { if (Number.isFinite(h)) this.H = clamp(Math.round(h), MIN_H, MAX_H); }
  changed() { if (this.onSettings) this.onSettings(this.settings); }

  reset() {
    this.t = 0;
    this.tripT = 0;                                       // seconds since setting off (the gentle start)
    this.player = { s: START_S, d: 0.5, vd: 0, yaw: 0, stopT: 0, inReed: -1, pole: 0, docked: false };
    this.drag = null;
    this.others = [];
    for (let i = 0; i < RTUNE.others; i++) this.spawnRaft(START_S + 0.3 + i * 0.42 + this.rand() * 0.08);
    this.nextRaft = 9;
    this.ferry = { d: 0.2, dir: 1, waitT: 3 };
    this.boxes = RTUNE.boxes; this.lift = null;         // lift = { t, n }: a box on its way up to porter n
    this.porters = [0, 1, 2].map((i) => ({ i, state: 'wait', walk: 0 }));
    this.ink = 0; this.inkShown = 0;
    this.events = [];
    this.stats = { passed: 0, bumps: 0, reeds: 0 };
    this.endless = false; this.completeT = 0; this.doneChoice = 0;
    this.message = null;
  }

  say(type, data = {}) { this.events.push({ type, ...data }); }
  msg(text, secs = 3.5) { this.message = { text, t: secs, total: secs }; }

  // ---------- pause ----------
  pauseGame() { if ((this.state === 'play' || this.state === 'unload') && !this.paused) { this.paused = true; this.pauseRow = 0; this.restartArmed = false; this.say('blip'); } }
  resumeGame() { this.paused = false; this.restartArmed = false; this.say('blip'); }
  togglePause() { if (this.paused) this.resumeGame(); else this.pauseGame(); }
  pauseKey(k) {
    const n = RIVER_PAUSE_ROWS.length;
    if (k === 'up') this.pauseRow = (this.pauseRow + n - 1) % n;
    else if (k === 'down') this.pauseRow = (this.pauseRow + 1) % n;
    else if (k === 'left' || k === 'right' || k === 'enter') this.pauseChange();
    if (RIVER_PAUSE_ROWS[this.pauseRow] !== 'restart') this.restartArmed = false;
    this.say('blip');
  }
  pauseChange() {
    const row = RIVER_PAUSE_ROWS[this.pauseRow];
    if (row === 'resume') this.resumeGame();
    else if (row === 'album') { this.albumRequest = true; return; }
    else if (row === 'sound') { this.settings.sound = !this.settings.sound; this.changed(); }
    else if (row === 'restart') {
      if (this.restartArmed) { this.reset(); this.paused = false; this.state = 'play'; this.say('start'); return; }
      this.restartArmed = true;
    }
  }
  pauseTap(x, y) {
    const idx = Math.round((y - pauseRowY(0, this.H)) / 92);
    if (idx < 0 || idx >= RIVER_PAUSE_ROWS.length || Math.abs(y - pauseRowY(idx, this.H)) > 40) return;
    if (RIVER_PAUSE_ROWS[idx] !== 'restart') this.restartArmed = false;
    this.pauseRow = idx; this.pauseChange(); this.say('blip');
  }

  // ---------- one step ----------
  /** inp: { fingerX, fingerY (picture units, or null), touchId, steer (-1..1, keys: + = right), vert (+ = up), keys, taps, start } */
  update(dt, inp = {}) {
    const keys = inp.keys || [], taps = inp.taps || [];
    if (this.paused) { for (const k of keys) this.pauseKey(k); for (const p of taps) this.pauseTap(p.x, p.y); return; }
    if (this.state === 'title') {
      if (keys.length || taps.length || inp.start) { this.reset(); this.state = 'play'; this.say('start'); this.msg('SLIDE A FINGER TO POLE ACROSS', 5); return; }
      this.stepWorld(dt, {}, false);
      return;
    }
    if (this.state === 'complete') {
      this.completeT += dt;
      this.stepWorld(dt, {}, false);
      if (this.completeT < DONE_WAIT) return;
      for (const k of keys) {
        if (k === 'up' || k === 'down' || k === 'left' || k === 'right') { this.doneChoice = 1 - this.doneChoice; this.say('blip'); }
        else if (k === 'enter') return this.chooseDone(this.doneChoice);
      }
      for (const p of taps) { const c = doneButtonAt(p.x, p.y, this.H); if (c >= 0) return this.chooseDone(c); }
      return;
    }
    if (this.state === 'unload') {
      const want = keys.includes('enter') || taps.some((p) => onUnloadButton(p.x, p.y, this.H));
      if (want) this.unloadOne();
    }
    this.stepWorld(dt, inp, true);
  }

  /** 0 = sail again, 1 = back to the album (the print waits there, finished, for next time). */
  chooseDone(c) {
    this.say('blip');
    this.reset();
    if (c === 0) { this.state = 'play'; this.say('start'); }
    else { this.state = 'title'; this.albumRequest = true; }
  }

  unloadOne() {
    if (this.lift || this.boxes <= 0) return;
    const n = RTUNE.boxes - this.boxes;
    this.lift = { t: 0, n };
    this.porters[n].state = 'reach';
    this.say('unload', { n: n + 1 });
  }

  stepWorld(dt, inp, scoring) {
    const T = RTUNE, p = this.player, H = this.H, playing = this.state === 'play';
    this.t += dt;
    if (this.message && (this.message.t -= dt) <= 0) this.message = null;
    const base = 1 / T.journeySecs;

    // ---- you ----
    if (playing) {
      const f = frame(p.s, H), hw = halfWidth(p.s, H);
      // the finger is a trackpad: you move with the finger's movement, measured ACROSS the river where you are (so when the river
      // runs sideways in the middle of the picture, sliding up and down poles you across)
      let want;
      if (inp.fingerX != null && inp.fingerY != null) {
        if (!this.drag || this.drag.id !== inp.touchId) this.drag = { x: inp.fingerX, y: inp.fingerY, aim: p.d, id: inp.touchId };
        this.drag.aim += ((inp.fingerX - this.drag.x) * f.nx + (inp.fingerY - this.drag.y) * f.ny) / (2 * hw);
        this.drag.x = inp.fingerX; this.drag.y = inp.fingerY;
        this.drag.aim = clamp(clamp(this.drag.aim, 0, 1), p.d - T.aimLead, p.d + T.aimLead);
        want = clamp((this.drag.aim - p.d) * T.fingerFollow, -1, 1) * T.acrossSpeed;
      } else {
        this.drag = null;
        const kx = clamp(inp.steer || 0, -1, 1), ky = -clamp(inp.vert || 0, -1, 1);
        want = clamp(kx * f.nx + ky * f.ny, -1, 1) * T.acrossSpeed;
      }
      if (p.stopT > 0) { p.stopT -= dt; want = 0; }
      // the last stretch: the current eases and draws you in to the landing on the near bank
      const landing = smooth((p.s - T.landingFrom) / (1 - T.landingFrom));
      if (landing > 0) want = want * (1 - 0.6 * landing) - 0.5 * landing;
      // the stern swings first (yaw, + = bow toward the far bank), then the raft gathers way across
      const yawTo = clamp(want / T.acrossSpeed, -1, 1) * T.maxYaw;
      p.yaw += (yawTo - p.yaw) * Math.min(1, dt * (Math.abs(yawTo) > Math.abs(p.yaw) ? T.yawRate : T.yawBack));
      // it moves across only as much as it points (no sliding sideways ahead of the turn); the shore's pull at the landing still adds
      const landingPull = want - clamp(want, -T.acrossSpeed, T.acrossSpeed);
      want = (p.yaw / T.maxYaw) * T.acrossSpeed + landingPull;
      const gathering = Math.abs(want) > Math.abs(p.vd) && want * p.vd >= 0;
      p.vd += (want - p.vd) * Math.min(1, dt * (gathering ? T.pickUp : T.settle));
      p.d = clamp(p.d + p.vd * dt, 0, 1);
      if (p.d === 0 || p.d === 1) p.vd = 0;
      p.pole += dt * (0.8 + Math.abs(p.vd) * 2);

      // the current: one steady pace for everyone (v1.5.4), slower in the reeds; it eases at the landing
      // (v1.5.22, Tom: it started too abruptly) setting off, the raft gathers way gently from a standstill
      this.tripT += dt;
      let pace = base * smooth(this.tripT / T.easeIn);
      let inReed = -1;
      REEDS.forEach((r, i) => { if (Math.abs(p.s - r.s) < REED_S && Math.abs(p.d - r.d) < REED_D) inReed = i; });
      if (inReed >= 0) { pace *= T.reedSlow; if (inReed !== p.inReed) { this.stats.reeds++; if (scoring) this.say('reed'); } }
      p.inReed = inReed;
      if (p.stopT > 0) pace *= 0.3;
      if (landing > 0) pace *= Math.max(0.12, 1 - 0.85 * landing);
      p.s = Math.min(1, p.s + pace * dt);

      if (p.s >= 0.999 && p.d < 0.2) {
        p.s = 1; p.vd = 0; p.yaw = 0; p.docked = true; this.drag = null;
        this.state = 'unload';
        if (scoring) { this.say('dock'); this.msg('TAP UNLOAD TO HAND UP A BOX', 6); }
      }
      this.ink = Math.max(this.ink, 75 * clamp((p.s - START_S) / (1 - START_S), 0, 1));
    }

    // ---- the boxes going up to the porters, who carry them away along the bank ----
    if (this.lift) {
      this.lift.t += dt;
      const q = this.porters[this.lift.n];
      if (this.lift.t >= T.liftSecs * 0.6 && q.state === 'reach') q.state = 'carry';
      if (this.lift.t >= T.liftSecs) {
        this.lift = null; this.boxes--;
        this.ink = 75 + 25 * (T.boxes - this.boxes) / T.boxes;
        if (this.boxes === 0 && scoring) this.msg('THE LAST BOX IS ASHORE', 4);
      }
    }
    for (const q of this.porters) if (q.state === 'carry') { q.walk += T.porterSpeed * dt; if (q.walk > 420) q.state = 'gone'; }
    if (this.state === 'unload' && this.boxes === 0 && !this.lift && this.porters[T.boxes - 1].walk > 120) {
      this.state = 'complete'; this.completeT = 0; this.doneChoice = 0; this.ink = 100;
      if (scoring) this.say('complete');
    }

    // ---- the other rafts drift down at the river's pace, holding their line; any change of line is a slow glide (Tom v1.5.4:
    // they slipped one way or the other) ----
    for (const o of this.others) {
      if (o.stopT > 0) o.stopT -= dt;
      else o.s += base * dt;
      if (o.s > 0.85) o.dTarget = Math.max(o.dTarget, 0.6);            // they keep off the landing and carry on downstream
      o.d0 += clamp(o.dTarget - o.d0, -0.05 * dt, 0.05 * dt);          // at most 5% of the river's width a second
      o.d = clamp(o.d0, 0.05, 0.95);
      o.pole += dt;
      if (!playing) continue;
      const ahead = o.s - p.s;
      if (!o.passed && ahead < -T.bodyS) { o.passed = true; this.stats.passed++; if (scoring) this.say('pass'); }
      if (!o.passed && p.stopT <= 0 && Math.abs(ahead) < T.bodyS && Math.abs(o.d - p.d) < T.bodyD) {
        // a soft knock: both stop for a moment and they ease away to one side
        p.stopT = T.bumpStop; o.stopT = T.bumpStop * 0.6; o.passed = true;
        o.dTarget = clamp(o.d + (o.d > p.d ? 0.3 : -0.3), 0.08, 0.92);
        this.stats.bumps++;
        if (scoring) { this.say('bump'); this.msg('SUMIMASEN', 2); }
      }
    }
    this.others = this.others.filter((o) => o.s < 1.6);
    if ((this.nextRaft -= dt) <= 0) { this.spawnRaft(START_S - 0.15); this.nextRaft = 10 + this.rand() * 8; }

    // ---- the ferry goes back and forth across, resting at each bank ----
    const fy = this.ferry;
    if (fy.waitT > 0) fy.waitT -= dt;
    else {
      fy.d += fy.dir * 0.045 * dt;
      if (fy.d > 0.88 || fy.d < 0.12) { fy.d = clamp(fy.d, 0.12, 0.88); fy.dir *= -1; fy.waitT = 4 + this.rand() * 3; }
    }
    if (SHOW_FERRY && playing && p.stopT <= 0 && Math.abs(p.s - FERRY_S) < T.bodyS * 0.8 && Math.abs(fy.d - p.d) < T.bodyD) {
      p.stopT = T.bumpStop; fy.waitT = Math.max(fy.waitT, 1); this.stats.bumps++;
      if (scoring) { this.say('bump'); this.msg('SUMIMASEN', 2); }
    }

    this.inkShown += (this.ink - this.inkShown) * Math.min(1, dt * 1.6);
  }

  spawnRaft(s) {
    // never right on top of another, and not right in front of you as you set off
    let d = -1;
    for (let k = 0; k < 12 && d < 0; k++) {
      const c = 0.15 + this.rand() * 0.7;
      if (this.others.every((o) => Math.abs(o.s - s) > 0.12 || Math.abs(o.d - c) > 0.3)) d = c;
    }
    if (d < 0) return;
    const T = RTUNE;
    this.others.push({ s, d, d0: d, dTarget: d, phase: this.rand() * 6.28, wood: Math.floor(this.rand() * 6),
      pole: this.rand() * 4, stopT: 0, passed: s < this.player.s, len: 0.85 + this.rand() * 0.35 });
  }
}
