// SUDDEN SHOWER (print 2, after Hiroshige's "Sudden Shower over Shin-Ohashi Bridge"): the rules.
// You are the lone walker crossing the great bridge in the rain, against the crowd hurrying the other way. You walk on by yourself;
// your finger (or rocking the phone) steps you across the deck, between the near rail and the far rail. Pass people without bumping
// and the print fills with ink; a bump just costs a polite bow. Puddles splash and slow you. Nothing ends the game.
// Pure logic: no drawing, no sound, no DOM. tools/selftest.mjs plays it with a bot.
import { clamp } from './ocean.js';
import { MIN_W, MAX_W, PAUSE_Y0, PAUSE_DY, SENS_OPTS } from './sim.js';

// ---- the bridge in the picture (fixed view, like the print) ----
// Positions on the deck: s = how far along (0 = the near end, bottom left; 1 = the far end, right edge),
// d = how far across (0 = the near rail, 1 = the far rail). The deck rises from lower left to the right and narrows into the distance.
export const deckFront = (x, W) => 560 - 200 * (x / W) - 26 * Math.sin((Math.PI * x) / W);   // y of the deck's near edge
export const deckDepth = (x, W) => 170 - 70 * (x / W);                                         // how tall the deck looks, near edge to far rail
export const deckPoint = (s, d, W) => { const x = s * W; return [x, deckFront(x, W) - (0.1 + 0.8 * d) * deckDepth(x, W)]; };
/** Which d is at picture height y, at distance s along (not clamped). */
export const deckD = (s, y, W) => { const x = s * W; return ((deckFront(x, W) - y) / deckDepth(x, W) - 0.1) / 0.8; };
/** How big a figure looks there (nearer = bigger). */
export const figScale = (s, d) => (1 - 0.32 * s) * (1 - 0.1 * d);

export const BTUNE = {
  crossSecs: 80,            // one crossing at a steady walk
  acrossSpeed: 0.8,         // deck widths per second, at most, with tilt or keys (gentle)
  fingerFollow: 14,         // how tightly you follow the finger's movement (speeds: FINGER_GAIN / FINGER_SPEED below)
  aimLead: 0.06,            // how far ahead of you the finger can get (small = reversing answers at once)
  crowdSpeed: [0.0122, 0.0128],   // nearly one pace for everyone, so nobody catches anyone up and closes a gap
  spawnGap: [3.2, 5.6],     // seconds between people setting out from the far end
  bodyS: 0.016,             // how close (along) counts as bumping (Tom: tightened, it felt wide)
  bodyD: 0.11,              // ... and across (a pair under one mat is wider)
  bumpStop: 1.4,            // seconds you both stop to bow
  splashSlow: 0.45, splashSecs: 0.8,
  inkPass: 1.6,             // ink for each person passed without bumping
  inkCross: 8,              // ink for reaching the far bank
  puddles: 7,
};

export const BRIDGE_PAUSE_ROWS = ['resume', 'album', 'crowd', 'steer', 'finger', 'sens', 'sound', 'recentre', 'restart'];
export const BRIDGE_STEER_OPTS = ['FINGER', 'TILT PHONE', 'TILT (FLIPPED)'];
// how busy the bridge is (Tom asked for a more crowded option): people set out this much more often. There is still always a gap.
export const CROWD_OPTS = ['LIGHT', 'BUSY', 'PACKED'];
export const CROWD_RATE = [1, 1.7, 2.6];
// finger speed (Tom: the feel has to be just right, so it is his choice). Each step sets how far one slide moves you
// (gain 1.0 = sliding the deck's own height on screen crosses all of it) and your top speed (deck widths per second).
export const FINGER_OPTS = ['SLOW', 'MEDIUM', 'FAST'];
export const FINGER_GAIN = [0.6, 0.8, 1.0];
export const FINGER_SPEED = [1.0, 1.5, 2.2];       // FAST = v20
export const KINDS = ['hat', 'hat', 'hat', 'umbrella', 'umbrella', 'pair'];

// ---- the far bank: two choices (Tom: ask, rather than drifting back into play) ----
export const CHOICE_WAIT = 0.8;                       // seconds before the choices answer
export const CROSS_CHOICES = ['CROSS AGAIN', 'BACK TO THE ALBUM'];
/** Where the two choice buttons sit: [centre x, centre y, width, height]. */
export const crossChoiceBox = (i, W) => [W / 2 + (i === 0 ? -175 : 175), 372, 310, 64];
/** Which choice (0 / 1) is at picture point x,y; -1 for neither (generous, for thumbs). */
export function crossChoiceAt(x, y, W) {
  for (let i = 0; i < 2; i++) { const [cx, cy, w, h] = crossChoiceBox(i, W); if (Math.abs(x - cx) <= w / 2 + 10 && Math.abs(y - cy) <= h / 2 + 24) return i; }
  return -1;
}

function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export class Bridge {
  constructor({ width = 1300, seed = Date.now() } = {}) {
    this.W = clamp(Math.round(width), MIN_W, MAX_W);
    this.rand = mulberry32(seed);
    this.settings = { steer: 0, sens: 1, sound: true, crowd: 0, finger: 1 };     // finger by default (Tom); saved by the page
    this.onSettings = null;
    this.paused = false; this.pauseRow = 0; this.restartArmed = false;
    this.recentreRequest = false; this.albumRequest = false;
    this.state = 'title';
    this.reset();
  }

  setWidth(w) { if (Number.isFinite(w)) this.W = clamp(Math.round(w), MIN_W, MAX_W); }
  get tiltSteer() { return this.settings.steer > 0; }
  get tiltFlip() { return this.settings.steer === 2; }
  get crowdRate() { return CROWD_RATE[this.settings.crowd || 0] || 1; }
  changed() { if (this.onSettings) this.onSettings(this.settings); }

  reset() {
    this.t = 0; this.tick = 0;
    this.player = { s: 0.05, d: 0.5, vd: 0, stopT: 0, slowT: 0, invuln: 0, step: 0, puddle: -1, enterT: 1, bow: 0 };
    this.walkers = []; this.nextId = 0;
    this.drag = null;              // where the finger went down, and where you were then
    this.nextSpawn = 1;
    this.puddles = [];
    for (let i = 0; i < BTUNE.puddles; i++) this.puddles.push(this.newPuddle(0.12, 0.5 + this.rand() * 0.5));
    // the crowd is already on the bridge
    for (let s = 0.32; s < 1; s += (0.12 + this.rand() * 0.08) / this.crowdRate) this.spawnWalker(s);
    this.rain = 0.7; this.gusts = [];
    this.ink = 0; this.inkShown = 0;
    this.events = [];
    this.stats = { passed: 0, bumps: 0, splashes: 0, crossings: 0 };
    this.endless = false; this.completeT = 0;
    this.crossedT = 0; this.crossChoice = 0;
    this.message = null;
  }

  say(type, data = {}) { this.events.push({ type, ...data }); }
  msg(text, secs = 3.5) { this.message = { text, t: secs, total: secs }; }

  // ---------- pause + settings (same layout as the Great Wave's) ----------
  pauseGame() { if (this.state === 'play' && !this.paused) { this.paused = true; this.pauseRow = 0; this.restartArmed = false; this.say('blip'); } }
  resumeGame() { this.paused = false; this.restartArmed = false; this.say('blip'); }
  togglePause() { if (this.paused) this.resumeGame(); else this.pauseGame(); }
  pauseKey(k) {
    const n = BRIDGE_PAUSE_ROWS.length;
    if (k === 'up') this.pauseRow = (this.pauseRow + n - 1) % n;
    else if (k === 'down') this.pauseRow = (this.pauseRow + 1) % n;
    else if (k === 'left') this.pauseChange(-1);
    else if (k === 'right' || k === 'enter') this.pauseChange(1);
    if (BRIDGE_PAUSE_ROWS[this.pauseRow] !== 'restart') this.restartArmed = false;
    this.say('blip');
  }
  pauseChange(d) {
    const row = BRIDGE_PAUSE_ROWS[this.pauseRow], s = this.settings;
    if (row === 'resume') this.resumeGame();
    else if (row === 'album') { this.albumRequest = true; return; }
    else if (row === 'crowd') s.crowd = ((s.crowd || 0) + d + CROWD_OPTS.length) % CROWD_OPTS.length;
    else if (row === 'finger') s.finger = ((s.finger ?? 1) + d + FINGER_OPTS.length) % FINGER_OPTS.length;
    else if (row === 'steer') s.steer = (s.steer + d + BRIDGE_STEER_OPTS.length) % BRIDGE_STEER_OPTS.length;
    else if (row === 'sens') s.sens = (s.sens + d + SENS_OPTS.length) % SENS_OPTS.length;
    else if (row === 'sound') s.sound = !s.sound;
    else if (row === 'recentre') { this.recentreRequest = true; this.msg('STRAIGHT AHEAD SET', 2); }
    else if (row === 'restart') {
      if (this.restartArmed) { const keep = this.settings; this.reset(); this.settings = keep; this.paused = false; this.state = 'play'; this.say('start'); return; }
      this.restartArmed = true; return;
    }
    this.changed();
  }
  pauseTap(x, y) {
    const idx = Math.floor((y - (PAUSE_Y0 - PAUSE_DY / 2)) / PAUSE_DY);
    if (idx < 0 || idx >= BRIDGE_PAUSE_ROWS.length) return;
    if (BRIDGE_PAUSE_ROWS[idx] !== 'restart') this.restartArmed = false;
    this.pauseRow = idx;
    const row = BRIDGE_PAUSE_ROWS[idx];
    this.pauseChange(row === 'steer' || row === 'sens' || row === 'crowd' || row === 'finger' ? (x < this.W / 2 ? -1 : 1) : 1);
    this.say('blip');
  }

  // ---------- one step ----------
  /** inp: { across -1..1 (tilt/keys: + = toward the far rail), fingerY (picture units, or null), touchId (changes with each new touch), keys, taps, start } */
  update(dt, inp = {}) {
    this.tick++;
    const keys = inp.keys || [], taps = inp.taps || [];
    if (this.paused) { for (const k of keys) this.pauseKey(k); for (const p of taps) this.pauseTap(p.x, p.y); return; }
    if (this.state === 'title') {
      if (keys.length || taps.length || inp.start) { this.reset(); this.state = 'play'; this.say('start'); this.msg('SLIDE YOUR FINGER UP AND DOWN TO STEP ASIDE', 5); return; }
      this.stepWorld(dt, {}, false);       // the crowd and the rain carry on behind the album
      return;
    }
    if (this.state === 'complete') {
      this.completeT += dt;
      this.stepWorld(dt, inp, false);
      if (this.completeT > 4 && (keys.length || taps.length)) { this.state = 'play'; this.endless = true; this.msg('THE BRIDGE IS YOURS. WALK ON.', 5); }
      return;
    }
    if (this.state === 'crossed') {
      // at the far bank: the rain and the crowd carry on while you choose (a short wait first, so a steering finger can't choose by accident)
      this.crossedT += dt;
      this.stepWorld(dt, {}, false);
      if (this.crossedT < CHOICE_WAIT) return;
      for (const k of keys) {
        if (k === 'left' || k === 'right' || k === 'up' || k === 'down') { this.crossChoice = 1 - this.crossChoice; this.say('blip'); }
        else if (k === 'enter') return this.chooseAfterCrossing(this.crossChoice);
      }
      for (const p of taps) { const c = crossChoiceAt(p.x, p.y, this.W); if (c >= 0) return this.chooseAfterCrossing(c); }
      return;
    }
    this.stepWorld(dt, inp, true);
  }

  /** After a crossing: 0 = cross again, 1 = back to the album (the next crossing waits there, paused, for when you come back). */
  chooseAfterCrossing(c) {
    const p = this.player;
    p.s = 0.05; p.d = 0.5; p.vd = 0; p.enterT = 0; p.invuln = 1.5; p.puddle = -1; p.stopT = 0; this.drag = null;
    this.state = 'play';
    this.say('blip');
    if (c === 1) { this.paused = true; this.pauseRow = 0; this.albumRequest = true; }
  }

  stepWorld(dt, inp, scoring) {
    const T = BTUNE, p = this.player, playing = this.state === 'play' || this.state === 'complete';
    this.t += dt;
    if (this.message && (this.message.t -= dt) <= 0) this.message = null;

    // ---- the weather: the rain swells and eases; now and then a gust sweeps a dense sheet across ----
    this.rain = clamp(0.62 + 0.24 * Math.sin(this.t * 0.11 + 1) + 0.14 * Math.sin(this.t * 0.29 + 4), 0.3, 1);
    if (this.rand() < dt / 16) this.gusts.push({ x: -350, speed: 150 + this.rand() * 90, width: 200 + this.rand() * 200 });
    for (const g of this.gusts) g.x += g.speed * dt;
    this.gusts = this.gusts.filter((g) => g.x < this.W + 400);

    // ---- you ----
    if (playing) {
      if (p.enterT < 1) p.enterT = Math.min(1, p.enterT + dt / 1.2);
      p.invuln = Math.max(0, p.invuln - dt); p.slowT = Math.max(0, p.slowT - dt);
      p.bow = p.stopT > 0 ? Math.sin(Math.min(1, (T.bumpStop - p.stopT) / T.bumpStop) * Math.PI) : 0;
      if (p.stopT > 0) p.stopT -= dt;
      else {
        p.s += (dt / T.crossSecs) * (p.slowT > 0 ? T.splashSlow : 1);
        p.step += dt * 1.9;
        if (Math.floor(p.step) !== Math.floor(p.step - dt * 1.9) && scoring) this.say('step');
      }
      // the finger is a trackpad that you steer with directly: you move with the finger's MOVEMENT, at once. Putting a finger down does
      // nothing (no jump); slide down and you step down; reverse mid-slide and you reverse straight away; stop and you stop.
      // (Tom: heading for the finger's spot jumped when a thumb landed low; then a slow walker lagged behind a quick finger and
      // carried on the old way after he reversed.)
      let want, ease = 10;
      if (inp.fingerY != null) {
        const f = this.settings.finger ?? 1;
        const perD = 0.8 * deckDepth(p.s * this.W, this.W) / FINGER_GAIN[f];  // picture units of finger travel per deck width
        if (!this.drag || this.drag.id !== inp.touchId) this.drag = { y: inp.fingerY, aim: p.d, id: inp.touchId };   // a new touch starts afresh
        this.drag.aim += (this.drag.y - inp.fingerY) / perD;
        this.drag.y = inp.fingerY;
        // the aim never runs off past a rail or far ahead of you, so a change of direction always answers at once
        this.drag.aim = clamp(clamp(this.drag.aim, 0, 1), p.d - T.aimLead, p.d + T.aimLead);
        want = clamp((this.drag.aim - p.d) * T.fingerFollow, -1, 1) * FINGER_SPEED[f];
        ease = 25;
      } else {
        this.drag = null;
        want = clamp(inp.across || 0, -1, 1) * T.acrossSpeed;
      }
      if (p.stopT > 0) want = 0;
      p.vd += (want - p.vd) * Math.min(1, dt * ease);
      p.d = clamp(p.d + p.vd * dt, 0, 1);
      if (p.d === 0 || p.d === 1) p.vd = 0;

      // the far bank: stop and choose (cross again, or back to the album). If this crossing finished the print, the print's
      // own "complete" screen shows instead, and you carry on from the near end afterwards.
      if (p.s >= 0.985) {
        this.stats.crossings++;
        if (scoring) { this.addInk(T.inkCross); this.say('crossed'); }
        if (this.state === 'complete') { p.s = 0.05; p.d = 0.5; p.vd = 0; p.enterT = 0; p.invuln = 1.5; p.puddle = -1; }
        else { this.state = 'crossed'; this.crossedT = 0; this.crossChoice = 0; p.s = 0.985; p.vd = 0; this.drag = null; this.message = null; }
        return;
      }

      // puddles: stepping in splashes and slows you
      const [fx, fy] = deckPoint(p.s, p.d, this.W);
      let inIdx = -1;
      this.puddles.forEach((q, i) => { if (puddleHas(q, fx, fy, this.W)) inIdx = i; });
      if (inIdx >= 0 && inIdx !== p.puddle && p.enterT >= 1) { p.slowT = T.splashSecs; this.stats.splashes++; if (scoring) this.say('splash', { s: p.s, d: p.d }); }
      p.puddle = inIdx;
    }

    // ---- the crowd ----
    for (const w of this.walkers) {
      if (w.stopT > 0) { w.stopT -= dt; continue; }
      w.s -= w.v * dt;
      w.step += dt * 2.1;
      w.d0 += (w.dTarget - w.d0) * Math.min(1, dt * 1.5);
      w.d = clamp(w.d0 + 0.035 * Math.sin(this.t * 0.6 + w.phase), 0, 1);
      if (!playing) continue;
      const ahead = w.s - p.s;
      if (!w.passed && !w.bumped && ahead < -T.bodyS) {
        w.passed = true; this.stats.passed++;
        if (scoring) { this.addInk(T.inkPass); this.say('pass'); }
      }
      if (!w.bumped && !w.passed && p.invuln <= 0 && p.enterT >= 1 && Math.abs(ahead) < T.bodyS && Math.abs(w.d - p.d) < w.bodyD) this.bump(w, scoring);
    }
    this.walkers = this.walkers.filter((w) => w.s > -0.06);
    this.nextSpawn -= dt;
    if (this.nextSpawn <= 0) { this.spawnWalker(1.04); this.nextSpawn = (T.spawnGap[0] + this.rand() * (T.spawnGap[1] - T.spawnGap[0])) / this.crowdRate; }

    // ---- puddles fill while it pours and shrink when it eases; a dried one forms again somewhere else ----
    for (let i = 0; i < this.puddles.length; i++) {
      const q = this.puddles[i];
      q.size = clamp(q.size + (this.rain - 0.55) * dt * 0.05, 0, 1);
      if (q.size < 0.05 && i !== p.puddle) this.puddles[i] = this.newPuddle(0.08, 0.06);
    }

    this.inkShown += (this.ink - this.inkShown) * Math.min(1, dt * 1.6);
  }

  newPuddle(minS, size) {
    // not right where you are about to step on at the near end
    return { s: minS + this.rand() * (0.95 - minS), d: 0.08 + this.rand() * 0.84, size, r: 44 + this.rand() * 36, seed: this.rand() * 100 };
  }

  spawnWalker(s) {
    const T = BTUNE, p = this.player;
    const kind = KINDS[Math.floor(this.rand() * KINDS.length)];
    const bodyD = kind === 'pair' ? T.bodyD * 1.6 : T.bodyD;
    // never a wall: beside anyone setting out at about the same time there is always room to slip through, with some to spare
    // (busier crowds walk in closer rows; each row still has its gap)
    const row = 0.12 / this.crowdRate ** 0.75;
    let d = -1;
    for (let k = 0; k < 14 && d < 0; k++) {
      const c = this.rand() < 0.35 ? clamp(p.d + (this.rand() - 0.5) * 0.3, 0.06, 0.94) : 0.06 + this.rand() * 0.88;
      if (this.walkers.every((o) => Math.abs(o.s - s) > row || Math.abs(o.d - c) > o.bodyD + bodyD + 0.14)) d = c;
    }
    if (d < 0) return;                     // no room just now: nobody sets out this time
    const v = T.crowdSpeed[0] + this.rand() * (T.crowdSpeed[1] - T.crowdSpeed[0]);
    this.walkers.push({ id: ++this.nextId, s, d, d0: d, dTarget: d, v, kind, bodyD, phase: this.rand() * 6.28, step: this.rand() * 4,
      stopT: 0, bumped: false, passed: s < p.s, look: Math.floor(this.rand() * 4) });
  }

  bump(w, scoring) {
    const T = BTUNE, p = this.player;
    w.bumped = true; w.stopT = T.bumpStop;
    w.dTarget = clamp(w.d + (w.d > p.d ? 0.3 : -0.3), 0, 1);     // they step round you afterwards
    p.stopT = T.bumpStop; p.invuln = T.bumpStop + 0.8;
    this.stats.bumps++;
    if (scoring) { this.say('bump'); this.msg('SUMIMASEN', 2.2); }
  }

  addInk(v) {
    if (this.endless) return;
    const before = this.ink;
    this.ink = Math.min(100, this.ink + v);
    if (Math.floor(this.ink / 10) > Math.floor(before / 10)) this.say('ink', { level: Math.floor(this.ink / 10) });
    if (this.ink >= 100 && this.state === 'play') { this.state = 'complete'; this.completeT = 0; this.say('complete'); this.msg('THE PRINT IS COMPLETE', 6); }
  }
}

/** Is picture point x,y (someone's feet) inside puddle q? */
export function puddleHas(q, x, y, W) {
  if (q.size < 0.15) return false;
  const [cx, cy] = deckPoint(q.s, q.d, W), sc = figScale(q.s, q.d);
  const rx = q.r * q.size * sc, ry = rx * 0.32;
  return ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1;
}
