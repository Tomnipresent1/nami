// KAMATA (print 3, after Hiroshige's "Plum Garden at Kamata"): the rules. A slow stroll through the plum garden in a breeze, from
// the waiting kago (palanquin) to beyond the third tea hut. Hold a finger to walk; slide it left or right to step around trees, huts
// and people; let go to stand still and watch the petals. Pass close to someone and you both bow. Nothing to win or lose.
// Pure logic: no drawing, no sound, no DOM. tools/selftest.mjs plays it with a bot.
//
// The garden is a flat ground: x = left/right (0 = the middle of the path, roughly), z = how far in. Units are about a metre.
import { clamp } from './ocean.js';
import { MIN_W, MAX_W, PAUSE_Y0, PAUSE_DY } from './sim.js';
import { CHOICE_WAIT, readChoice } from './choice.js';

export const PATH_END = 200;                 // just beyond the third hut
export const HALF = 5.5;                     // how far either side of the path you may wander
/** The path's middle at distance z: it meanders gently. */
export const pathX = (z) => 1.6 * Math.sin(z / 37) + 0.8 * Math.sin(z / 13 + 1);

export const GTUNE = {
  walkSpeed: 1.5,          // a slow stroll (units per second): about 2 minutes to the third hut
  ease: 1.6,               // how gently you start and stop walking
  bodyR: 0.45,             // your size, for stepping round things
  nudge: 0.9,              // walking straight into something slides you gently round it (units per second sideways)
  bowNear: 1.9,            // pass this close to someone and you both bow
  bowSecs: 1.4,
  inkPerUnit: 0.2,         // ink for each unit walked (one stroll ~ 40)
  inkBow: 1.5,
  aimLead: 0.25,           // how far ahead of you the finger can get (small = reversing answers at once)
};
// finger speed (as on the bridge): picture units of finger travel per unit of sideways step, and top sideways speed
export const G_FINGER_OPTS = ['SLOW', 'MEDIUM', 'FAST'];
export const G_FINGER_PX = [60, 44, 32];
export const G_FINGER_SPEED = [1.4, 2.0, 2.8];

export const GARDEN_PAUSE_ROWS = ['resume', 'album', 'finger', 'sound', 'restart'];
export const STROLL_CHOICES = ['WALK AGAIN', 'BACK TO THE ALBUM'];
export const DONE_CHOICES = ['KEEP STROLLING', 'BACK TO THE ALBUM'];
export const DONE_WAIT = 4;

function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ---- the garden itself: the same every visit, like the print ----
export const HUTS = [
  { z: 55, side: -1, double: true },         // the two thatched huts together, as in the print
  { z: 110, side: 1, double: false },
  { z: 165, side: -1, double: false },        // the third hut: the stroll ends just beyond it
].map((h) => ({ ...h, x: pathX(h.z) + h.side * (h.double ? 9.2 : 7.6), hw: h.double ? 5 : 3.2, hd: 2.4 }));
export const KAGO = { x: pathX(4) + 3.6, z: 4, hw: 1.5, hd: 0.8 };      // right by the start, big in the foreground as in the print
export const POND = { x0: -30, x1: -12, z0: 28, z1: 62 };

export function buildGarden() {
  const r = mulberry32(1857);                // the year of the print
  const trees = [];
  const clear = (x, z, pad) => HUTS.every((h) => Math.abs(x - h.x) > h.hw + pad || Math.abs(z - h.z) > h.hd + pad)
    && (Math.abs(x - KAGO.x) > KAGO.hw + pad || Math.abs(z - KAGO.z) > KAGO.hd + pad)
    && !(x > POND.x0 - 1 && x < POND.x1 + 1 && z > POND.z0 - 1 && z < POND.z1 + 1);
  for (let z = 6; z < 330; z += 6 + r() * 5) {
    // one tree on or beside the path now and then: something to step around
    if (z > 14 && z < PATH_END - 4 && r() < 0.6) {
      const x = pathX(z) + (r() - 0.5) * 7;
      if (clear(x, z, 1.5) && trees.every((t) => Math.hypot(t.x - x, t.z - z) > 4)) trees.push({ x, z, r: 0.6, kind: Math.floor(r() * 4), seed: r() * 100 });
    }
    // the orchard either side
    const n = 3 + Math.floor(r() * 4);
    for (let i = 0; i < n; i++) {
      const side = r() < 0.5 ? -1 : 1, x = pathX(z) + side * (HALF + 2 + r() * 38), zz = z + (r() - 0.5) * 4;
      if (clear(x, zz, 1) && trees.every((t) => Math.hypot(t.x - x, t.z - zz) > 3.5)) trees.push({ x, z: zz, r: 0.6, kind: Math.floor(r() * 4), seed: r() * 100 });
    }
  }
  return { trees };
}

export class Garden {
  constructor({ width = 1300, seed = Date.now() } = {}) {
    this.W = clamp(Math.round(width), MIN_W, MAX_W);
    this.rand = mulberry32(seed);
    this.settings = { finger: 1, sound: true, steer: 0, sens: 1 };       // saved by the page (steer/sens: tilt is not used here yet)
    this.onSettings = null;
    this.paused = false; this.pauseRow = 0; this.restartArmed = false;
    this.recentreRequest = false; this.albumRequest = false;
    this.garden = buildGarden();
    this.state = 'title';
    this.reset();
  }

  setWidth(w) { if (Number.isFinite(w)) this.W = clamp(Math.round(w), MIN_W, MAX_W); }
  get tiltSteer() { return false; }
  get tiltFlip() { return false; }
  changed() { if (this.onSettings) this.onSettings(this.settings); }

  reset() {
    this.t = 0; this.tick = 0;
    this.ink = 0; this.inkShown = 0;
    this.events = [];
    this.stats = { strolls: 0, bows: 0, walked: 0 };
    this.endless = false; this.completeT = 0; this.choice = 0;
    this.message = null;
    this.wind = 0.5;
    this.chimeIn = 4; this.birdIn = 12;
    this.newStroll();
  }
  newStroll() {
    this.player = { x: pathX(0), z: 0, v: 0, vx: 0, bowT: 0, bow: 0, fade: 0, step: 0 };
    this.drag = null;
    this.arrivedT = 0;
    // people: some stand admiring the trees, some stroll toward you along the path
    const r = this.rand;
    this.people = [];
    let id = 0;
    for (let z = 22; z < PATH_END + 30; z += 13 + r() * 12) {
      const side = r() < 0.5 ? -1 : 1;
      this.people.push({ id: id++, kind: 'stand', x: pathX(z) + side * (2 + r() * 5), z, vz: 0, bowed: false, bowT: 0, look: Math.floor(r() * 5), phase: r() * 6 });
    }
    for (let k = 0; k < 4; k++) {
      const z = 35 + k * 45 + r() * 15;
      this.people.push({ id: id++, kind: 'walk', x: pathX(z) + (r() - 0.5) * 5, z, vz: -(0.45 + r() * 0.2), bowed: false, bowT: 0, look: Math.floor(r() * 5), phase: r() * 6 });
    }
  }

  say(type, data = {}) { this.events.push({ type, ...data }); }
  msg(text, secs = 3.5) { this.message = { text, t: secs, total: secs }; }

  // ---------- pause + settings ----------
  pauseGame() { if (this.state === 'play' && !this.paused) { this.paused = true; this.pauseRow = 0; this.restartArmed = false; this.say('blip'); } }
  resumeGame() { this.paused = false; this.restartArmed = false; this.say('blip'); }
  togglePause() { if (this.paused) this.resumeGame(); else this.pauseGame(); }
  pauseKey(k) {
    const n = GARDEN_PAUSE_ROWS.length;
    if (k === 'up') this.pauseRow = (this.pauseRow + n - 1) % n;
    else if (k === 'down') this.pauseRow = (this.pauseRow + 1) % n;
    else if (k === 'left') this.pauseChange(-1);
    else if (k === 'right' || k === 'enter') this.pauseChange(1);
    if (GARDEN_PAUSE_ROWS[this.pauseRow] !== 'restart') this.restartArmed = false;
    this.say('blip');
  }
  pauseChange(d) {
    const row = GARDEN_PAUSE_ROWS[this.pauseRow], s = this.settings;
    if (row === 'resume') this.resumeGame();
    else if (row === 'album') { this.albumRequest = true; return; }
    else if (row === 'finger') s.finger = ((s.finger ?? 1) + d + G_FINGER_OPTS.length) % G_FINGER_OPTS.length;
    else if (row === 'sound') s.sound = !s.sound;
    else if (row === 'restart') {
      if (this.restartArmed) { const keep = this.settings; this.reset(); this.settings = keep; this.paused = false; this.state = 'play'; this.say('start'); return; }
      this.restartArmed = true; return;
    }
    this.changed();
  }
  pauseTap(x, y) {
    const idx = Math.floor((y - (PAUSE_Y0 - PAUSE_DY / 2)) / PAUSE_DY);
    if (idx < 0 || idx >= GARDEN_PAUSE_ROWS.length) return;
    if (GARDEN_PAUSE_ROWS[idx] !== 'restart') this.restartArmed = false;
    this.pauseRow = idx;
    this.pauseChange(GARDEN_PAUSE_ROWS[idx] === 'finger' ? (x < this.W / 2 ? -1 : 1) : 1);
    this.say('blip');
  }

  // ---------- one step ----------
  /** inp: { walk: bool (finger held / up key), fingerX (picture units, or null), touchId, across -1..1 (keys), keys, taps, start } */
  update(dt, inp = {}) {
    this.tick++;
    const keys = inp.keys || [], taps = inp.taps || [];
    if (this.paused) { for (const k of keys) this.pauseKey(k); for (const p of taps) this.pauseTap(p.x, p.y); return; }
    if (this.state === 'title') {
      if (keys.length || taps.length || inp.start) { this.reset(); this.state = 'play'; this.say('start'); this.msg('HOLD A FINGER TO WALK. SLIDE IT TO STEP ASIDE', 6); return; }
      this.stepWorld(dt, {}, false);
      return;
    }
    if (this.state === 'arrived') {
      // beyond the third hut: you fade away; walk again, or back to the album
      this.arrivedT += dt;
      this.stepWorld(dt, {}, false);
      if (this.arrivedT < CHOICE_WAIT + 0.8) return;
      const r = readChoice(keys, taps, this.W, this.choice);
      if (r.sel !== this.choice) { this.choice = r.sel; this.say('blip'); }
      if (r.chosen >= 0) {
        this.newStroll(); this.state = 'play'; this.say('blip');
        if (r.chosen === 1) { this.paused = true; this.pauseRow = 0; this.albumRequest = true; }
      }
      return;
    }
    if (this.state === 'complete') {
      this.completeT += dt;
      this.stepWorld(dt, inp, false);
      if (this.completeT < DONE_WAIT) return;
      const r = readChoice(keys, taps, this.W, this.choice);
      if (r.sel !== this.choice) { this.choice = r.sel; this.say('blip'); }
      if (r.chosen >= 0) {
        this.state = 'play'; this.endless = true; this.say('blip');
        if (r.chosen === 1) { this.paused = true; this.pauseRow = 0; this.albumRequest = true; }
        else this.msg('THE GARDEN IS YOURS. STROLL ON.', 5);
      }
      return;
    }
    this.stepWorld(dt, inp, true);
  }

  stepWorld(dt, inp, scoring) {
    const T = GTUNE, p = this.player, playing = this.state === 'play' || this.state === 'complete';
    this.t += dt;
    if (this.message && (this.message.t -= dt) <= 0) this.message = null;

    // ---- the breeze: it rises and falls, with the odd gust that sets the petals swirling ----
    this.wind = clamp(0.4 + 0.22 * Math.sin(this.t * 0.13) + 0.5 * Math.max(0, Math.sin(this.t * 0.31 + 2)) ** 4, 0.15, 1);
    if ((this.chimeIn -= dt * (0.6 + this.wind)) <= 0) { this.say('chime', { n: 2 + Math.floor(this.rand() * 3) }); this.chimeIn = 7 + this.rand() * 10; }
    if ((this.birdIn -= dt) <= 0) { this.say('bird'); this.birdIn = 25 + this.rand() * 25; }

    // ---- you ----
    if (playing) {
      p.fade = Math.min(1, p.fade + dt / 1.5);
      if (p.bowT > 0) { p.bowT -= dt; p.bow = Math.sin(clamp(1 - p.bowT / T.bowSecs, 0, 1) * Math.PI); } else p.bow = 0;
      const walking = !!inp.walk && p.bowT <= 0;
      p.v += ((walking ? T.walkSpeed : 0) - p.v) * Math.min(1, dt * T.ease);
      if (p.v < 0.01 && !walking) p.v = 0;
      // sideways: the finger is a trackpad (as on the bridge): you move with its movement, at once; keys move you too
      const f = this.settings.finger ?? 1;
      let want = 0;
      if (inp.fingerX != null) {
        if (!this.drag || this.drag.id !== inp.touchId) this.drag = { x: inp.fingerX, aim: p.x, id: inp.touchId };
        this.drag.aim += (inp.fingerX - this.drag.x) / G_FINGER_PX[f];
        this.drag.x = inp.fingerX;
        const mid = pathX(p.z);
        this.drag.aim = clamp(clamp(this.drag.aim, mid - HALF, mid + HALF), p.x - T.aimLead, p.x + T.aimLead);
        want = clamp((this.drag.aim - p.x) * 8, -1, 1) * G_FINGER_SPEED[f];
      } else {
        this.drag = null;
        want = clamp(inp.across || 0, -1, 1) * G_FINGER_SPEED[1];
      }
      if (p.bowT > 0) want = 0;
      p.vx += (want - p.vx) * Math.min(1, dt * 20);
      const z0 = p.z;
      p.x += p.vx * dt;
      p.z += p.v * dt;
      p.step += p.v * dt * 1.3;
      this.collide(p, dt, walking);
      const mid = pathX(p.z);
      p.x = clamp(p.x, mid - HALF, mid + HALF);
      const walked = Math.max(0, p.z - z0);
      this.stats.walked += walked;
      if (scoring) this.addInk(walked * T.inkPerUnit);

      // the end of the stroll
      if (p.z >= PATH_END) {
        this.stats.strolls++;
        if (this.state === 'play') { this.state = 'arrived'; this.arrivedT = 0; this.choice = 0; this.drag = null; p.v = 0; p.vx = 0; this.say('arrived'); this.message = null; }
        else this.newStroll();                                     // (the print finished on this stroll: carry on from the start)
      }
    } else if (this.state === 'arrived') p.fade = Math.max(0, p.fade - dt / 1.5);

    // ---- the other people ----
    for (const q of this.people) {
      if (q.bowT > 0) { q.bowT -= dt; continue; }
      if (q.kind === 'walk') {
        q.z += q.vz * dt;
        // they step aside for you, as you do for them
        if (playing && q.z > p.z && q.z - p.z < 6 && Math.abs(q.x - p.x) < 1.3) q.x += Math.sign(q.x - p.x || 1) * 0.7 * dt;
        if (q.z < p.z - 9) {                                     // gone behind you: someone else sets off further up the path
          const nz = p.z + 55 + this.rand() * 40;
          if (nz < PATH_END + 25) { q.z = nz; q.x = pathX(nz) + (this.rand() - 0.5) * 5; q.bowed = false; q.look = Math.floor(this.rand() * 5); }
        }
      }
      if (playing && !q.bowed && p.bowT <= 0 && Math.hypot(q.x - p.x, q.z - p.z) < T.bowNear) {
        q.bowed = true; q.bowT = T.bowSecs; p.bowT = T.bowSecs;
        this.stats.bows++;
        if (scoring) { this.addInk(T.inkBow); this.say('bow'); }
      }
    }
    this.inkShown += (this.ink - this.inkShown) * Math.min(1, dt * 1.6);
  }

  /** Keep you out of trees, huts, the kago and people: you slide round them, never through. */
  collide(p, dt, walking) {
    const R = GTUNE.bodyR;
    let hit = null;
    const pushCircle = (ox, oz, r) => {
      const dx = p.x - ox, dz = p.z - oz, d = Math.hypot(dx, dz);
      if (d >= r + R) return;
      if (d < 1e-6) { p.x += r + R; return; }
      const k = (r + R - d) / d; p.x += dx * k; p.z += dz * k; hit = ox;
    };
    const pushBox = (b) => {
      const cx = clamp(p.x, b.x - b.hw, b.x + b.hw), cz = clamp(p.z, b.z - b.hd, b.z + b.hd);
      const dx = p.x - cx, dz = p.z - cz, d = Math.hypot(dx, dz);
      if (d >= R) return;
      if (d < 1e-6) {                                              // inside (only on a big jump): leave by the nearest side
        const out = [[b.x - b.hw - R - p.x, 0], [b.x + b.hw + R - p.x, 0], [0, b.z - b.hd - R - p.z]].sort((a, c) => Math.hypot(...a) - Math.hypot(...c))[0];
        p.x += out[0]; p.z += out[1]; hit = b.x; return;
      }
      const k = (R - d) / d; p.x += dx * k; p.z += dz * k; hit = b.x;
    };
    for (const t of this.garden.trees) if (Math.abs(t.z - p.z) < 2 && Math.abs(t.x - p.x) < 2) pushCircle(t.x, t.z, t.r);
    for (const h of HUTS) if (Math.abs(h.z - p.z) < h.hd + 1) pushBox(h);
    if (Math.abs(KAGO.z - p.z) < 2) pushBox(KAGO);
    for (const q of this.people) if (Math.abs(q.z - p.z) < 1.5) pushCircle(q.x, q.z, 0.4);
    // walking straight into something: drift gently round it toward the side with more room, so you are never stuck
    if (hit != null && walking) {
      const mid = pathX(p.z);
      let side = Math.sign(p.x - hit);
      if (Math.abs(p.x - hit) < 0.05) side = Math.sign(mid - hit) || 1;
      if ((side > 0 && p.x > mid + HALF - 0.6) || (side < 0 && p.x < mid - HALF + 0.6)) side = -side;   // no room that way: the other way
      p.x += side * GTUNE.nudge * dt;
    }
  }

  addInk(v) {
    if (this.endless) return;
    const before = this.ink;
    this.ink = Math.min(100, this.ink + v);
    if (Math.floor(this.ink / 10) > Math.floor(before / 10)) this.say('ink', { level: Math.floor(this.ink / 10) });
    if (this.ink >= 100 && this.state === 'play') { this.state = 'complete'; this.completeT = 0; this.choice = 0; this.say('complete'); this.msg('THE PRINT IS COMPLETE', 6); }
  }
}
