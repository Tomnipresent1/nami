// THE LAMPLIGHTER (print 4, Meiji Tokyo at night; colour after Kiyochika, the street front after Hiroshige III's Shintomi theatre
// and the flat-on house fronts of Eizan, Yoshiiku and Moronobu): the rules. One street, seen flat-on, all on one screen. You are the
// lamplighter: tap the street and he walks there; next to an unlit gas lamp the LIGHT button shows; tap it and he raises his long
// pole and the lamp catches. Each lamp warms the street and the house fronts around it. Light them all and the print is complete.
// The sky never changes (Tom): the only change of light is the lamps. A few quiet passers-by; meet one and you both bow.
// Pure logic: no drawing, no sound, no DOM. tools/selftest.mjs plays it with a bot.
//
// Positions are picture units: x across (0..W), y = where the feet are, down the picture (STREET_BACK at the house fronts,
// STREET_FRONT nearest you). People nearer the front are drawn a little bigger (streetScale).
import { clamp } from './ocean.js';
import { MIN_W, MAX_W, PAUSE_Y0, PAUSE_DY } from './sim.js';
import { readChoice } from './choice.js';

export const STREET_BACK = 352;              // the foot of the house fronts
export const STREET_FRONT = 566;             // the nearest you can walk
/** How big someone standing at y looks (nearer = bigger). */
export const streetScale = (y) => 0.82 + 0.4 * (y - STREET_BACK) / (STREET_FRONT - STREET_BACK);

export const LTUNE = {
  walkSpeed: 62,           // picture units per second (an unhurried walk)
  ease: 7,                 // how gently he starts and stops
  reachX: 70, reachY: 44,  // how close to a lamp's foot he must be for the LIGHT button to show
  lightSecs: 2.6,          // stepping to the post, raising the pole, the flame catching, lowering it again
  catchAt: 1.35,           // ... the moment the lamp catches
  glowSecs: 1.6,           // a lit lamp's light spreads over this long
  doneDelay: 2.2,          // after the last lamp catches, a moment to see the street lit before "complete"
  bowNear: [34, 18],       // meet someone this close (across, depth) and you both bow
  bowSecs: 1.4,
  bowGap: 6,
  walkers: 4,              // passers-by on the street at once
};

// the lamps: a zigzag along the street, some by the house fronts, some nearer you (u = how far across, 0..1)
export const LAMPS = [
  { u: 0.08, y: 382 }, { u: 0.22, y: 508 }, { u: 0.36, y: 386 }, { u: 0.5, y: 516 },
  { u: 0.64, y: 384 }, { u: 0.78, y: 510 }, { u: 0.92, y: 388 },
];
export const lampX = (lamp, W) => lamp.u * W;
/** Where he stands to light lamp i (just to the left of its post, a step nearer you). */
export const lightSpot = (lamp, W) => [lampX(lamp, W) - 30 * streetScale(lamp.y), lamp.y + 6];

// the LIGHT button: round, bottom right, like Plum Blossom's GATHER (centre x, centre y, radius). Taps are generous.
export const lightButton = (W) => [W - 100, 600 - 100, 62];
export const onLightButton = (x, y, W) => { const [cx, cy, r] = lightButton(W); return Math.hypot(x - cx, y - cy) < r + 22; };

export const LAMP_PAUSE_ROWS = ['resume', 'album', 'sound', 'restart'];
export const DONE_CHOICES = ['LIGHT THEM AGAIN', 'BACK TO THE ALBUM'];
export const DONE_WAIT = 4;
export const WALKER_KINDS = ['lantern', 'lantern', 'plain', 'umbrella', 'rickshaw'];

function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export class Street {
  constructor({ width = 1300, seed = Date.now() } = {}) {
    this.W = clamp(Math.round(width), MIN_W, MAX_W);
    this.rand = mulberry32(seed);
    this.settings = { sound: true, steer: 0, sens: 1 };       // saved by the page (steer/sens: tilt is not used here)
    this.onSettings = null;
    this.paused = false; this.pauseRow = 0; this.restartArmed = false;
    this.recentreRequest = false; this.albumRequest = false;
    this.state = 'title';
    this.reset();
    this.lightAll();                 // behind the album card the street shows finished: every lamp lit
  }

  setWidth(w) {
    if (!Number.isFinite(w)) return;
    this.W = clamp(Math.round(w), MIN_W, MAX_W);
    if (this.player) this.player.x = clamp(this.player.x, 20, this.W - 20);
  }
  get tiltSteer() { return false; }
  get tiltFlip() { return false; }
  changed() { if (this.onSettings) this.onSettings(this.settings); }

  reset() {
    this.t = 0; this.tick = 0;
    this.ink = 0; this.inkShown = 0;
    this.events = [];
    this.stats = { lit: 0, bows: 0, rounds: 0 };
    this.endless = false; this.completeT = 0; this.choice = 0; this.doneT = 0;
    this.message = null;
    this.cricketIn = 2;
    this.newRound();
    this.walkers = [];
    for (let i = 0; i < LTUNE.walkers; i++) this.spawnWalker(true);
  }
  newRound() {
    this.lamps = LAMPS.map((l) => ({ ...l, lit: false, glow: this.lamps ? (this.lamps.find((o) => o.u === l.u)?.glow ?? 0) : 0 }));   // (any old glow fades out)
    this.player = { x: this.W * 0.03, y: 470, vx: 0, vy: 0, face: 1, step: 0, lightT: 0, lamp: -1, raise: 0, bowT: 0, bow: 0, fade: 0 };
    this.target = null;              // where he is walking to (picture units), or null
    this.drag = null;                // the touch now steering (so a touch that began on the LIGHT button is left alone)
    this.reachable = -1;             // the unlit lamp within reach (the LIGHT button shows), or -1
    this.doneT = 0;
  }
  lightAll() { for (const l of this.lamps) { l.lit = true; l.glow = 1; } }
  get litCount() { return this.lamps.filter((l) => l.lit).length; }

  say(type, data = {}) { this.events.push({ type, ...data }); }
  msg(text, secs = 3.5) { this.message = { text, t: secs, total: secs }; }

  // ---------- pause + settings ----------
  pauseGame() { if (this.state === 'play' && !this.paused) { this.paused = true; this.pauseRow = 0; this.restartArmed = false; this.say('blip'); } }
  resumeGame() { this.paused = false; this.restartArmed = false; this.say('blip'); }
  togglePause() { if (this.paused) this.resumeGame(); else this.pauseGame(); }
  pauseKey(k) {
    const n = LAMP_PAUSE_ROWS.length;
    if (k === 'up') this.pauseRow = (this.pauseRow + n - 1) % n;
    else if (k === 'down') this.pauseRow = (this.pauseRow + 1) % n;
    else if (k === 'left') this.pauseChange(-1);
    else if (k === 'right' || k === 'enter') this.pauseChange(1);
    if (LAMP_PAUSE_ROWS[this.pauseRow] !== 'restart') this.restartArmed = false;
    this.say('blip');
  }
  pauseChange() {
    const row = LAMP_PAUSE_ROWS[this.pauseRow], s = this.settings;
    if (row === 'resume') this.resumeGame();
    else if (row === 'album') { this.albumRequest = true; return; }
    else if (row === 'sound') s.sound = !s.sound;
    else if (row === 'restart') {
      if (this.restartArmed) { const keep = this.settings; this.reset(); this.settings = keep; this.paused = false; this.state = 'play'; this.say('start'); return; }
      this.restartArmed = true; return;
    }
    this.changed();
  }
  pauseTap(x, y) {
    const idx = Math.floor((y - (PAUSE_Y0 - PAUSE_DY / 2)) / PAUSE_DY);
    if (idx < 0 || idx >= LAMP_PAUSE_ROWS.length) return;
    if (LAMP_PAUSE_ROWS[idx] !== 'restart') this.restartArmed = false;
    this.pauseRow = idx;
    this.pauseChange(1);
    this.say('blip');
  }

  // ---------- one step ----------
  /** inp: { fingerX, fingerY (picture units while a finger is down, else null), touchId, steer -1..1 / vert -1..1 (keys), keys, taps, start } */
  update(dt, inp = {}) {
    this.tick++;
    const keys = inp.keys || [], taps = inp.taps || [];
    if (this.paused) { for (const k of keys) this.pauseKey(k); for (const p of taps) this.pauseTap(p.x, p.y); return; }
    if (this.state === 'title') {
      if (keys.length || taps.length || inp.start) {
        this.reset(); this.state = 'play'; this.say('start');
        this.msg('TAP THE STREET TO WALK. LIGHT EVERY LAMP', 6);
        return;
      }
      this.stepWorld(dt, {}, false);
      return;
    }
    if (this.state === 'complete') {
      this.completeT += dt;
      this.stepWorld(dt, {}, false);
      if (this.completeT < DONE_WAIT) return;
      const r = readChoice(keys, taps, this.W, this.choice);
      if (r.sel !== this.choice) { this.choice = r.sel; this.say('blip'); }
      if (r.chosen === 0) {                                  // the lamps go out, and a new evening begins
        this.newRound(); this.ink = 0; this.state = 'play'; this.say('start');
      } else if (r.chosen === 1) {                           // back to the album: the street waits there, finished, for next time
        this.state = 'title'; this.lightAll(); this.albumRequest = true; this.say('blip');
      }
      return;
    }
    // the LIGHT button (or Enter / Space)
    if (keys.includes('enter') || taps.some((t) => onLightButton(t.x, t.y, this.W))) this.startLight();
    this.stepWorld(dt, inp, true);
  }

  /** Raise the pole to the unlit lamp within reach (does nothing if none is). */
  startLight() {
    const p = this.player;
    if (this.reachable < 0 || p.lightT > 0 || p.bowT > 0 || this.state !== 'play') return false;
    p.lightT = LTUNE.lightSecs; p.lamp = this.reachable; this.target = null;
    return true;
  }

  /** Where a finger at picture x,y sends him: onto the street; a touch on a lamp (anywhere up its post) goes to its foot. */
  aimFor(x, y) {
    for (const l of this.lamps) {
      const lx = lampX(l, this.W), sc = streetScale(l.y);
      if (Math.abs(x - lx) < 34 * sc && y < l.y + 10 && y > l.y - 200 * sc) return lightSpot(l, this.W);
    }
    return [clamp(x, 20, this.W - 20), clamp(y, STREET_BACK + 6, STREET_FRONT)];
  }

  stepWorld(dt, inp, scoring) {
    const T = LTUNE, p = this.player, playing = this.state === 'play';
    this.t += dt;
    if (this.message && (this.message.t -= dt) <= 0) this.message = null;
    if ((this.cricketIn -= dt) <= 0) { this.say('cricket'); this.cricketIn = 3 + this.rand() * 7; }

    // ---- the lamps: a lit lamp's light spreads; an unlit one's fades away (a new evening) ----
    for (const l of this.lamps) l.glow = clamp(l.glow + (l.lit ? dt / T.glowSecs : -dt / 1.2), 0, 1);

    // ---- you ----
    if (this.state !== 'title') {
      p.fade = Math.min(1, p.fade + dt / 1.2);
      if (p.bowT > 0) { p.bowT -= dt; p.bow = Math.sin(clamp(1 - p.bowT / T.bowSecs, 0, 1) * Math.PI); } else p.bow = 0;
      let wantX = 0, wantY = 0;
      if (p.lightT > 0) {
        // lighting: step to the spot beside the post, raise the pole, the flame catches, lower it again
        const l = this.lamps[p.lamp], before = p.lightT;
        p.lightT -= dt;
        const e = T.lightSecs - p.lightT;                     // seconds since it began
        const [sx, sy] = lightSpot(l, this.W);
        if (e < 0.45) { p.x += (sx - p.x) * Math.min(1, dt * 9); p.y += (sy - p.y) * Math.min(1, dt * 9); p.step += dt * 1.5; }
        p.face = 1;
        p.raise = e < 0.35 ? 0 : e < 1.15 ? smooth01((e - 0.35) / 0.8) : e < 1.65 ? 1 : smooth01(1 - (e - 1.65) / (T.lightSecs - 1.65));
        if (T.lightSecs - before < T.catchAt && e >= T.catchAt && !l.lit) {
          l.lit = true; this.stats.lit++;
          if (scoring) { this.addInk(100 / this.lamps.length); this.say('light', { n: this.litCount }); }
          if (this.litCount === this.lamps.length && scoring) this.doneT = T.doneDelay + (T.lightSecs - e);
          else if (scoring && this.litCount === 1) this.msg('THE FIRST LAMP IS LIT', 3);
        }
        if (p.lightT <= 0) { p.lightT = 0; p.raise = 0; p.lamp = -1; }
        p.vx = 0; p.vy = 0;
      } else if (playing && p.bowT <= 0) {
        // where to walk: a finger on the street (held or just tapped: he keeps going to where you touched), or the arrow keys
        if (inp.fingerX != null) {
          if (!this.drag || this.drag.id !== inp.touchId) this.drag = { id: inp.touchId, button: this.reachable >= 0 && onLightButton(inp.fingerX, inp.fingerY, this.W) };
          if (!this.drag.button) this.target = this.aimFor(inp.fingerX, inp.fingerY);
        } else this.drag = null;
        const kx = clamp(inp.steer || 0, -1, 1), ky = clamp(inp.vert || 0, -1, 1);
        if (inp.fingerX == null && (kx || ky)) { this.target = null; wantX = kx * T.walkSpeed; wantY = -ky * T.walkSpeed * 0.7; }
        else if (this.target) {
          const dx = this.target[0] - p.x, dy = this.target[1] - p.y, d = Math.hypot(dx, dy);
          if (d < 2) this.target = null;
          else { const sp = Math.min(T.walkSpeed, d * 3); wantX = (dx / d) * sp; wantY = (dy / d) * sp; }
        }
      }
      if (p.lightT <= 0) {
        p.vx += (wantX - p.vx) * Math.min(1, dt * T.ease); p.vy += (wantY - p.vy) * Math.min(1, dt * T.ease);
        p.x = clamp(p.x + p.vx * dt, 20, this.W - 20); p.y = clamp(p.y + p.vy * dt, STREET_BACK + 6, STREET_FRONT);
        const sp = Math.hypot(p.vx, p.vy);
        if (sp < 1 && !wantX && !wantY) { p.vx = 0; p.vy = 0; }
        if (Math.abs(p.vx) > 4) p.face = Math.sign(p.vx);
        p.step += sp * dt / 42;
      }

      // which unlit lamp is within reach: the LIGHT button shows while there is one
      this.reachable = -1;
      if (playing && p.lightT <= 0) {
        let best = Infinity;
        this.lamps.forEach((l, i) => {
          if (l.lit) return;
          const [sx, sy] = lightSpot(l, this.W), dx = Math.abs(p.x - sx), dy = Math.abs(p.y - sy);
          if (dx < T.reachX && dy < T.reachY && dx + dy < best) { best = dx + dy; this.reachable = i; }
        });
        if (this.reachable >= 0 && scoring && !this.hinted) { this.hinted = true; this.msg('TAP THE GLOWING BUTTON TO LIGHT THE LAMP', 5); }
      }

      // the last lamp has caught: a moment to look at the lit street, then the print is complete
      if (this.doneT > 0 && (this.doneT -= dt) <= 0 && playing) {
        this.doneT = 0; this.stats.rounds++;
        this.state = 'complete'; this.completeT = 0; this.choice = 0; this.target = null; this.reachable = -1;
        this.say('complete'); this.msg('THE STREET IS LIT', 6);
      }
    }

    // ---- the passers-by ----
    for (const w of this.walkers) {
      if (w.wait > 0) { w.wait -= dt; continue; }
      if (w.bowT > 0) { w.bowT -= dt; continue; }
      w.x += w.dir * w.speed * dt;
      w.step += w.speed * dt / 40;
      w.y += (w.lane - w.y) * Math.min(1, dt * 1.2);
      w.swing = Math.sin(this.t * 2.2 + w.phase);
      if (this.state === 'title' || this.state === 'complete') continue;
      // they step out of your way if you are in theirs (they never walk into you)
      const ahead = (p.x - w.x) * w.dir, sc = streetScale(w.y);
      if (ahead > -10 && ahead < 110 * sc && Math.abs(p.y - w.y) < 26) w.lane = clamp(w.y + (w.y <= p.y ? -1 : 1) * 40, STREET_BACK + 10, STREET_FRONT - 4);
      // meet someone close and you both bow (not while you are lighting a lamp, and not too often)
      if (playing && !w.bowed && w.kind !== 'rickshaw' && p.lightT <= 0 && p.bowT <= 0 && this.t - (this.lastBow ?? -99) > T.bowGap
        && Math.abs(p.x - w.x) < T.bowNear[0] * sc && Math.abs(p.y - w.y) < T.bowNear[1]) {
        w.bowed = true; w.bowT = T.bowSecs; p.bowT = T.bowSecs; this.lastBow = this.t; this.stats.bows++;   // (afterwards he carries on to where you sent him)
        if (scoring) this.say('bow');
      }
    }
    for (let i = 0; i < this.walkers.length; i++) {
      const w = this.walkers[i];
      if (w.x < -140 || w.x > this.W + 140) { this.walkers.splice(i, 1); i--; this.spawnWalker(false); }
    }
    this.inkShown += (this.ink - this.inkShown) * Math.min(1, dt * 1.6);
  }

  /** Someone sets off along the street from one side (or, at the start, is already part-way along). */
  spawnWalker(already) {
    const r = this.rand, kind = WALKER_KINDS[Math.floor(r() * WALKER_KINDS.length)];
    // (only one rickshaw at a time)
    const k = kind === 'rickshaw' && this.walkers.some((w) => w.kind === 'rickshaw') ? 'lantern' : kind;
    const dir = r() < 0.5 ? 1 : -1;
    // a lane not too close to anyone else's, so nobody walks through anybody
    let lane = STREET_BACK + 16 + r() * (STREET_FRONT - STREET_BACK - 20);
    for (let n = 0; n < 8 && this.walkers.some((w) => Math.abs(w.lane - lane) < 30); n++) lane = STREET_BACK + 16 + r() * (STREET_FRONT - STREET_BACK - 20);
    const x = already ? 60 + r() * (this.W - 120) : dir > 0 ? -120 : this.W + 120;
    this.walkers.push({ kind: k, dir, x, y: lane, lane, speed: k === 'rickshaw' ? 62 + r() * 12 : 24 + r() * 14, step: r() * 4, phase: r() * 6, swing: 0,
      wait: already ? 0 : 1 + r() * 6, bowT: 0, bowed: false, robe: Math.floor(r() * 5) });
  }

  addInk(v) {
    const before = this.ink;
    this.ink = Math.min(100, this.ink + v + 1e-9);
    if (Math.floor(this.ink / 10) > Math.floor(before / 10)) this.say('ink', { level: Math.floor(this.ink / 10) });
  }
}

const smooth01 = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
