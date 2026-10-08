// THE LAMPLIGHTER (print 4, Meiji Tokyo at night; colour after Kiyochika's "Night Stalls at Asakusa"; the building after a Meiji
// photograph of a big wooden teahouse (research 17)): the rules. One screen. You are the lamplighter, walking the covered walkway
// that runs round the teahouse's ground floor behind a low railing, lighting the red paper lanterns that hang from its front beam
// (the LIGHT button); hold a finger and he walks, slide it back and he turns round, let go and he stops. He comes from the back,
// along the left-hand block; the teahouse's middle is set back (Tom's plan view, research 27), so the walkway turns in, runs along
// the recess past the main door, turns out again and carries on off the right of the picture: then the evening is over.
// It is a process, not a goal (Tom): light as many as you like; light them all and the print is complete.
// The sky never changes: the only change of light is the lanterns. Life upstairs on the balconies, people along the street.
// Pure logic: no drawing, no sound, no DOM. tools/selftest.mjs plays it with a bot.
//
// v1.4.6: a real 3-D scene (Tom: "abandon all notions of orthographic space"). The world is in metres: X along the street (bigger =
// nearer the right of the picture), Y up, Z away from the street into the buildings (the main fronts' railing line is Z = 0). A
// camera stands in the street (CAM) and projects it; everything gets real depth and real sides.
import { clamp } from './ocean.js';
import { MIN_W, MAX_W, PAUSE_Y0, PAUSE_DY } from './sim.js';
import { readChoice } from './choice.js';

// ---- the camera: standing in the street, looking along the fronts toward the far end (verticals stay upright: a level camera,
// with its picture shifted so the eye level sits low, as in the photo) ----
// v1.4.7 (Tom): every screen shows the SAME view, the one a 975-wide picture gets (his first screenshot: intimate, the player in the
// scene from the start, close to the left). A wider screen zooms in on it (a little roof and sky trimmed off the top) rather than
// showing more of the street on the left. refW: that reference width; right: where the view's centre sits, from its right edge.
export const CAM = { x: 28, y: 1.6, z: -14.5, lookX: 10, lookZ: 6, F: 600, eye: 440, right: 640, refW: 975 };
const CAMF = (() => { const dx = CAM.lookX - CAM.x, dz = CAM.lookZ - CAM.z, d = Math.hypot(dx, dz); return [dx / d, dz / d]; })();
/** Camera space: [across (right +), up, depth] for world point X, Y, Z. */
export function toCam(X, Y, Z) {
  const qx = X - CAM.x, qz = Z - CAM.z;
  return [qx * CAMF[1] - qz * CAMF[0], Y - CAM.y, qx * CAMF[0] + qz * CAMF[1]];
}
/** Picture position [x, y] and size factor (picture units per metre) of camera-space point c, on a picture W wide. */
export const fromCam = (c, W) => { const z = W / CAM.refW, k = (CAM.F * z) / c[2]; return [(CAM.refW - CAM.right) * z + c[0] * k, CAM.eye - c[1] * k, k]; };
/** Picture position [x, y, k] of world point X, Y, Z (only for points in front of the camera). */
export const project = (X, Y, Z, W) => fromCam(toCam(X, Y, Z), W);

// ---- the teahouse, in plan (metres) ----
// the set-back middle runs from X = A to X = B, RECESS metres back from the main fronts (one export per line: the bundler needs it)
export const A = 18;
export const B = 30;
export const RECESS = 4;
export const WALKWAY = 2;                    // the walkway's width, railing to the lattice wall
// the path along the middle of the walkway: from the back, along the left block, in, along the recess, out, and on off the picture
export const PATH = [[8, 1], [A + 1, 1], [A + 1, RECESS + 1], [B - 1, RECESS + 1], [B - 1, 1], [70, 1]];
const SEGS = PATH.slice(1).map((p, i) => { const q = PATH[i], len = Math.hypot(p[0] - q[0], p[1] - q[1]); return { q, p, len, dir: [(p[0] - q[0]) / len, (p[1] - q[1]) / len] }; });
SEGS.reduce((s, g) => { g.s0 = s; return s + g.len; }, 0);
export const PATH_LEN = SEGS.reduce((s, g) => s + g.len, 0);
/** Where distance s along the path is: { x, z, dir, out } (out = toward the railing, the open side). */
export function pathAt(s) {
  s = clamp(s, 0, PATH_LEN);
  const g = SEGS.find((q) => s <= q.s0 + q.len) || SEGS[SEGS.length - 1], t = s - g.s0;
  return { x: g.q[0] + g.dir[0] * t, z: g.q[1] + g.dir[1] * t, dir: g.dir, out: [g.dir[1], -g.dir[0]] };
}

// ten lanterns along the way, hanging from the beam over the railing (by distance along the path): four along the left block, one
// where the walkway turns in, four along the recess (one at the main door), one where it turns out (the last stretch is out of view)
export const LANTERNS = [1, 3.5, 6, 8.5, 12.6, 16.8, 18.9, 21, 23.1, 27.4].map((s) => ({ s }));
export const ENTRANCE_X = (A + B) / 2;       // the main door, in the recess, under its curved gable
// heights (metres): the walkway roof's front beam, a lantern, the railing
export const BEAM_H = 2.9;
export const LANTERN_H = 2.45;
export const RAIL_H = 0.9;
/** Where lantern l hangs (world): over the railing, beside the path. */
export function lanternAt(l) { const p = pathAt(l.s); return [p.x + p.out[0] * 1, LANTERN_H, p.z + p.out[1] * 1]; }
// people walking along the street: two lanes, in front of the teahouse
export const LANES = { street: -3.2, far: -6.2 };

export const LTUNE = {
  walkSpeed: 1.1,          // metres per second: an unhurried walk
  start: 10, stop: 18,     // how quickly he gets going, and stops when the finger lifts (quick: nothing slippy, Tom)
  turn: 16,                // slide the finger back this far (picture units) the other way and he turns round
  reach: 0.9,              // how close (metres along the path) he must be to a lantern's spot for the LIGHT button to show
  standOff: 0.5,           // he stands just short of it to light it
  lightSecs: 2.8,
  catchAt: 1.45,
  glowSecs: 1.4,
  walkers: { street: 5, balcony: 4 },
  nodNear: 3,              // people in the street nod as they pass you this close (metres; they never stop you)
};
/** Where (along the path) he stands to light lantern l. */
export const lightSpot = (l) => l.s - LTUNE.standOff;
/** How far along the path he must walk to be off the right of a picture W wide (it depends on the picture's width). */
const exitCache = {};
export function exitS(W) {
  if (exitCache[W]) return exitCache[W];
  let s = SEGS[SEGS.length - 1].s0;
  while (s < PATH_LEN) { const p = pathAt(s), c = toCam(p.x, 0, p.z); if (c[2] < 1 || fromCam(c, W)[0] > W + 45) break; s += 0.1; }
  return (exitCache[W] = s);
}

// the LIGHT button: round, like Plum Blossom's GATHER (centre x, centre y, radius). Taps are generous. Bottom LEFT here (v1.4.6): his
// path ends at the bottom right, where he comes out of the recess, and a button there would cover him
export const lightButton = (W) => [96, 600 - 92, 60];
export const onLightButton = (x, y, W) => { const [cx, cy, r] = lightButton(W); return Math.hypot(x - cx, y - cy) < r + 22; };

export const LAMP_PAUSE_ROWS = ['resume', 'album', 'sound', 'restart'];
export const DONE_CHOICES = ['WALK AGAIN', 'BACK TO THE ALBUM'];
export const DONE_WAIT = 4;                  // the finished print shows on its own for a moment first
export const EVENING_WAIT = 1.4;             // (a shorter wait when the evening is simply over)
const KINDS = { street: ['plain', 'lantern', 'porter', 'bundle', 'lantern', 'rickshaw', 'plain'], balcony: ['sit', 'sit', 'stand', 'stroll'] };
// the balconies people stand on: [from X, to X, Z of the balcony floor's middle]
export const BALCONIES = [[-1, A + 1.2, 0.55], [A + 2.2, B - 2.2, RECESS + 0.55], [B - 1.2, 40, 0.55]];

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
    this.lightAll();                 // behind the album card the street shows finished: every lantern lit
  }

  setWidth(w) { if (Number.isFinite(w)) this.W = clamp(Math.round(w), MIN_W, MAX_W); }
  get tiltSteer() { return false; }
  get tiltFlip() { return false; }
  changed() { if (this.onSettings) this.onSettings(this.settings); }

  reset() {
    this.t = 0; this.tick = 0;
    this.ink = 0; this.inkShown = 0;
    this.events = [];
    this.stats = { lit: 0, nods: 0, evenings: 0, rounds: 0 };
    this.endless = false; this.completeT = 0; this.choice = 0;
    this.message = null;
    this.cricketIn = 2;
    this.lanterns = null;
    this.newEvening();
    this.walkers = [];
    for (let i = 0; i < LTUNE.walkers.street; i++) this.spawnWalker('street', true);
    for (let i = 0; i < LTUNE.walkers.balcony; i++) this.spawnWalker('balcony', true);
  }
  /** A new evening: the lanterns are out (any old glow fades), and he starts again at the back. */
  newEvening() {
    const old = this.lanterns;
    this.lanterns = LANTERNS.map((l, i) => ({ ...l, lit: false, glow: old ? old[i].glow : 0 }));
    this.player = { s: 0, vs: 0, face: 1, step: 0, lightT: 0, lantern: -1, raise: 0, fade: 0, nod: 0 };
    this.drag = null;                // the touch now steering (a touch that began on the LIGHT button is left alone)
    this.reachable = -1;             // the unlit lantern within reach (the LIGHT button shows), or -1
    this.ink = 0;
  }
  lightAll() { for (const l of this.lanterns) { l.lit = true; l.glow = 1; } }
  get litCount() { return this.lanterns.filter((l) => l.lit).length; }
  /** Where he is in the picture: [x, y, k]. */
  playerScreen() { const p = pathAt(this.player.s); return project(p.x, 0, p.z, this.W); }

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
  /** inp: { fingerX (picture units while a finger is down, else null), fingerY, touchId, steer -1..1 (keys), keys, taps, start } */
  update(dt, inp = {}) {
    this.tick++;
    const keys = inp.keys || [], taps = inp.taps || [];
    if (this.paused) { for (const k of keys) this.pauseKey(k); for (const p of taps) this.pauseTap(p.x, p.y); return; }
    if (this.state === 'title') {
      if (keys.length || taps.length || inp.start) {
        this.reset(); this.state = 'play'; this.say('start');
        this.msg('HOLD A FINGER TO WALK. LIGHT THE LANTERNS AS YOU GO', 6);
        return;
      }
      this.stepWorld(dt, {}, false);
      return;
    }
    if (this.state === 'complete' || this.state === 'evening') {
      // he has walked off the right of the picture: the street carries on while you choose what next
      this.completeT += dt;
      this.stepWorld(dt, {}, false);
      if (this.completeT < (this.state === 'complete' ? DONE_WAIT : EVENING_WAIT)) return;
      const r = readChoice(keys, taps, this.W, this.choice);
      if (r.sel !== this.choice) { this.choice = r.sel; this.say('blip'); }
      if (r.chosen === 0) { this.newEvening(); this.state = 'play'; this.say('start'); }
      else if (r.chosen === 1) { this.state = 'title'; this.lightAll(); this.albumRequest = true; this.say('blip'); }   // the street waits in the album, lit
      return;
    }
    // the LIGHT button (or Enter / Space)
    if (keys.includes('enter') || taps.some((t) => onLightButton(t.x, t.y, this.W))) this.startLight();
    this.stepWorld(dt, inp, true);
  }

  /** Reach up to the unlit lantern within reach (does nothing if none is). */
  startLight() {
    const p = this.player;
    if (this.reachable < 0 || p.lightT > 0 || this.state !== 'play') return false;
    p.lightT = LTUNE.lightSecs; p.lantern = this.reachable;
    return true;
  }

  stepWorld(dt, inp, scoring) {
    const T = LTUNE, p = this.player, playing = this.state === 'play';
    this.t += dt;
    if (this.message && (this.message.t -= dt) <= 0) this.message = null;
    if ((this.cricketIn -= dt) <= 0) { this.say('cricket'); this.cricketIn = 3 + this.rand() * 7; }

    // ---- the lanterns: a lit one's glow swells; an unlit one's fades away (a new evening) ----
    for (const l of this.lanterns) l.glow = clamp(l.glow + (l.lit ? dt / T.glowSecs : -dt / 1.2), 0, 1);

    // ---- you ----
    if (this.state !== 'title') {
      p.fade = Math.min(1, p.fade + dt / 1.2);
      let want = 0;
      // each new touch: one that lands on the LIGHT button (while it shows, or while he is lighting) never walks him
      if (inp.fingerX != null) {
        if (!this.drag || this.drag.id !== inp.touchId) {
          // a new touch: on his right he walks on (toward the end of the path), on his left he walks back
          this.drag = { id: inp.touchId, button: (this.reachable >= 0 || p.lightT > 0) && onLightButton(inp.fingerX, inp.fingerY ?? 0, this.W),
            dir: inp.fingerX >= this.playerScreen()[0] ? 1 : -1, ext: inp.fingerX };
        }
        // slide the finger back the other way (even a little) and he turns round: back along the same path (Tom, v1.4.5)
        const d = this.drag;
        if (d.dir > 0) { d.ext = Math.max(d.ext, inp.fingerX); if (inp.fingerX < d.ext - T.turn) { d.dir = -1; d.ext = inp.fingerX; } }
        else { d.ext = Math.min(d.ext, inp.fingerX); if (inp.fingerX > d.ext + T.turn) { d.dir = 1; d.ext = inp.fingerX; } }
      } else this.drag = null;
      if (p.lightT > 0) {
        // lighting: a step into place under the lantern, raise the pole, it catches, lower the pole again
        const l = this.lanterns[p.lantern], before = p.lightT;
        p.lightT -= dt;
        const e = T.lightSecs - p.lightT, ss = lightSpot(l);
        if (p.s !== ss) { const mv = clamp(ss - p.s, -T.walkSpeed * dt, T.walkSpeed * dt); p.s += mv; p.step += Math.abs(mv) / 0.7; }
        p.face = 1;
        p.raise = e < 0.4 ? 0 : e < 1.2 ? smooth01((e - 0.4) / 0.8) : e < 1.75 ? 1 : smooth01(1 - (e - 1.75) / (T.lightSecs - 1.75));
        if (T.lightSecs - before < T.catchAt && e >= T.catchAt && !l.lit) {
          l.lit = true; this.stats.lit++;
          if (scoring) { this.addInk(100 / this.lanterns.length); this.say('light', { n: this.litCount }); }
          if (scoring && this.litCount === 1) this.msg('THE FIRST LANTERN IS LIT', 3);
          if (scoring && this.litCount === this.lanterns.length) this.msg('EVERY LANTERN IS LIT', 4);
        }
        if (p.lightT <= 0) { p.lightT = 0; p.raise = 0; p.lantern = -1; }
        p.vs = 0;
      } else if (playing) {
        // hold a finger and he walks (on, or back, by which side of him it landed, or whichever way it last slid); let go and he
        // stops. The arrow keys walk him too (right = on).
        if (inp.fingerX != null) { if (!this.drag.button) want = this.drag.dir * T.walkSpeed; }
        else want = clamp(inp.steer || 0, -1, 1) * T.walkSpeed;
      }
      if (p.lightT <= 0) {
        p.vs += (want - p.vs) * Math.min(1, dt * (Math.abs(want) > Math.abs(p.vs) ? T.start : T.stop));
        if (!want && Math.abs(p.vs) < 0.03) p.vs = 0;
        p.s = Math.max(0, p.s + p.vs * dt);
        if (p.s === 0 && p.vs < 0) p.vs = 0;
        if (Math.abs(p.vs) > 0.05) p.face = p.vs > 0 ? 1 : -1;
        p.step += Math.abs(p.vs) * dt / 0.7;
      }

      // which unlit lantern is within reach: the LIGHT button shows while there is one
      this.reachable = -1;
      if (playing && p.lightT <= 0) {
        let best = T.reach;
        this.lanterns.forEach((l, i) => { if (!l.lit) { const d = Math.abs(p.s - lightSpot(l)); if (d < best) { best = d; this.reachable = i; } } });
        if (this.reachable >= 0 && scoring && !this.hinted) { this.hinted = true; this.msg('TAP THE GLOWING BUTTON TO LIGHT THE LANTERN', 5); }
      }

      // walked off the right of the picture: the evening is over (the print is complete if every lantern is lit)
      if (playing && p.s >= exitS(this.W)) {
        p.vs = 0; this.reachable = -1; this.completeT = 0; this.choice = 0; this.stats.evenings++; this.message = null;
        if (this.litCount === this.lanterns.length) { this.state = 'complete'; this.stats.rounds++; this.say('complete'); }
        else { this.state = 'evening'; this.say('arrived'); }
      }
    }

    // ---- the passers-by: along the street (they nod as they pass you), and gentle life on the balconies upstairs ----
    const pp = pathAt(p.s);
    for (const w of this.walkers) {
      w.nod = Math.max(0, w.nod - dt / 1.2);
      w.swing = Math.sin(this.t * 2.2 + w.phase);
      if (w.wait > 0) { w.wait -= dt; continue; }
      if (w.lane === 'balcony') { this.stepBalcony(w, dt); continue; }
      w.x += w.dir * w.speed * dt;
      w.step += w.speed * dt / 0.7;
      if (this.state === 'play' && !w.nodded && w.kind !== 'rickshaw' && Math.hypot(w.x - pp.x, w.z - pp.z) < T.nodNear) {
        w.nodded = true; w.nod = 1; p.nod = 1; this.stats.nods++;
        if (scoring) this.say('bow');
      }
    }
    p.nod = Math.max(0, p.nod - dt / 1.2);
    for (let i = 0; i < this.walkers.length; i++) {
      const w = this.walkers[i];
      if (w.lane !== 'balcony' && (w.x > 52 || w.x < -170)) { this.walkers.splice(i, 1); i--; this.spawnWalker('street', false); }
    }
    this.inkShown += (this.ink - this.inkShown) * Math.min(1, dt * 1.6);
  }

  /** Upstairs: people sit and look out, fan themselves, turn to each other; now and then one strolls a little way along. */
  stepBalcony(w, dt) {
    const r = this.rand, [x0, x1] = BALCONIES[w.balcony];
    w.headT -= dt;
    if (w.headT <= 0) { w.head = w.head ? 0 : (r() < 0.5 ? -1 : 1); w.headT = 2 + r() * 5; }
    if (w.kind === 'stroll' || w.goX != null) {
      if (w.goX == null) w.goX = clamp(w.x + (r() - 0.5) * 6, x0 + 0.5, x1 - 0.5);
      const dx = w.goX - w.x;
      if (Math.abs(dx) < 0.05) { w.goX = null; w.wait = 4 + r() * 8; w.kind = r() < 0.5 ? 'stand' : 'stroll'; }
      else { const mv = Math.sign(dx) * Math.min(Math.abs(dx), 0.6 * dt); w.x += mv; w.dir = dx > 0 ? 1 : -1; w.step += Math.abs(mv) / 0.7; }
    } else if (r() < dt / 25) w.goX = clamp(w.x + (r() - 0.5) * 4, x0 + 0.5, x1 - 0.5);     // (even the ones sitting get up now and then)
  }

  /** Someone sets off along the street (from the far end, or from behind you on the right), or takes a place on a balcony. */
  spawnWalker(lane, already) {
    const r = this.rand, kinds = KINDS[lane];
    let kind = kinds[Math.floor(r() * kinds.length)];
    if (kind === 'rickshaw' && this.walkers.some((w) => w.kind === 'rickshaw')) kind = 'lantern';      // (one rickshaw at a time)
    const dir = r() < 0.5 ? 1 : -1;
    const w = { lane, kind, dir, step: r() * 4, phase: r() * 6, swing: 0, nod: 0, nodded: false, head: 0, headT: r() * 4, goX: null,
      wait: already || lane === 'balcony' ? r() * 3 : 2 + r() * 8,
      // plain working clothes: a muted colour, sometimes striped or checked, sometimes a head cloth or an apron
      robe: Math.floor(r() * 8), pattern: r() < 0.3 ? 'stripe' : r() < 0.45 ? 'check' : '', cloth: lane === 'street' && r() < 0.35, apron: lane === 'street' && r() < 0.25,
      fan: lane === 'balcony' && r() < 0.5 };
    if (lane === 'balcony') {
      w.balcony = Math.floor(r() * BALCONIES.length);
      const [x0, x1, z] = BALCONIES[w.balcony];
      w.x = x0 + 0.5 + r() * (x1 - x0 - 1); w.z = z; w.speed = 0;
    } else {
      w.z = r() < 0.55 ? LANES.street : LANES.far; w.z += (r() - 0.5) * 0.8;
      w.x = already ? -40 + r() * 80 : dir > 0 ? -165 : 50;
      w.speed = kind === 'rickshaw' ? 2.6 + r() * 0.4 : 0.9 + r() * 0.5;
    }
    this.walkers.push(w);
  }

  addInk(v) {
    const before = this.ink;
    this.ink = Math.min(100, this.ink + v + 1e-9);
    if (Math.floor(this.ink / 10) > Math.floor(before / 10)) this.say('ink', { level: Math.floor(this.ink / 10) });
  }
}

const smooth01 = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
