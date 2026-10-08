// THE LAMPLIGHTER (print 4, Meiji Tokyo at night; colour after Kiyochika's "Night Stalls at Asakusa"; the building after a Meiji
// photograph of a big wooden teahouse on a corner (research 17)): the rules. One screen. The teahouse's front recedes gently to the
// left; along its ground floor runs a covered walkway behind a low railing, red paper lanterns hanging from its front beam. You are
// the lamplighter: you start at the far corner, inside the walkway, and walk toward the right (hold a finger and he walks toward
// it, let go and he stops), lighting the lanterns as you pass (the LIGHT button); walk off the right edge and the evening is over.
// It is a process, not a goal (Tom): light as many as you like; light them all and the print is complete.
// The sky never changes: the only change of light is the lanterns. Gentle life upstairs on the balcony, people along the street.
// Pure logic: no drawing, no sound, no DOM. tools/selftest.mjs plays it with a bot.
//
// The view (v1.4.5, Tom: "build the structure and perspective as we have it in the photo"): true perspective. Positions along the
// building are DEPTH z (0 = the right edge of the picture, bigger = further away along the street). A thing at depth z is drawn at
// scale k(z) = D / (D + z), toward a vanishing point just off the left edge at eye level (HORIZON, low, as in the photo): so he
// grows to about twice his size walking from the start (left of the main door) to the right edge. y0 = how far down the picture
// something is at scale 1 (at the right edge).
import { clamp } from './ocean.js';
import { MIN_W, MAX_W, PAUSE_Y0, PAUSE_DY } from './sim.js';
import { readChoice } from './choice.js';

export const VIEW = { D: 1000, ZC: 960, HORIZON: 470 };   // ZC: the walkway's far (left) end, where he starts
export const EXIT_Z = -24;                  // walk this far (off the right edge) and the evening is over
const VPX = (W) => -0.3 * W;                 // the vanishing point, just off the left edge
/** How big things are at depth z. */
export const scaleAt = (z) => VIEW.D / (VIEW.D + z);
/** Where depth z is across the picture. */
export const zToX = (z, W) => VPX(W) + (W - VPX(W)) * scaleAt(z);
/** Which depth is at picture x. */
export const xToZ = (x, W) => { const k = (x - VPX(W)) / (W - VPX(W)); return k > 0.05 ? VIEW.D / k - VIEW.D : 1e6; };
/** Where something y0 down the picture (at scale 1) is, at depth z. */
export const yAt = (z, y0) => VIEW.HORIZON + (y0 - VIEW.HORIZON) * scaleAt(z);

// ---- the walkway, top to bottom (y0: at scale 1) ----
export const BEAM_Y = 300;                   // the walkway roof's front beam: the lanterns hang from it
export const LANTERN_Y = 336;
export const WALK_Y = 596;                   // where his feet are, inside the walkway
export const RAIL_Y = [545, 612];            // the low railing between the walkway and the street (top, foot): about waist high on him
export const STREET_Y = 630;                 // people walking along the street (near you, their feet run off the bottom)
export const BALCONY_Y = 250;                // people upstairs, on the balcony

// twelve lanterns along the walkway, the first just past the corner
export const LANTERNS = Array.from({ length: 12 }, (_, i) => ({ z: VIEW.ZC - 50 - i * 80 }));
export const ENTRANCE_Z = 700;               // the main door, under its curved gable (he passes it early on)

export const LTUNE = {
  walkSpeed: 30,           // depth units per second: an unhurried walk (on screen, quicker as he comes nearer)
  turn: 16,                // slide the finger back this far (picture units) the other way and he turns round
  start: 10, stop: 18,     // how quickly he gets going, and stops when the finger lifts (quick: nothing slippy, Tom)
  reach: 22,               // how close (in depth) he must be to a lantern's spot for the LIGHT button to show
  standOff: 12,            // he stands just behind it (a little to its left) to light it
  lightSecs: 2.8,
  catchAt: 1.45,
  glowSecs: 1.4,
  endWait: 1.6,            // after he walks off the right edge, a moment before "the evening is over"
  walkers: { street: 5, balcony: 4 },
  nodNear: 30,             // people in the street nod as they pass you this close (they never stop you)
};
/** The depth he stands at to light lantern l. */
export const lightSpot = (l) => l.z + LTUNE.standOff;

// the LIGHT button: round, bottom right, like Plum Blossom's GATHER (centre x, centre y, radius). Taps are generous.
export const lightButton = (W) => [W - 100, 600 - 100, 62];
export const onLightButton = (x, y, W) => { const [cx, cy, r] = lightButton(W); return Math.hypot(x - cx, y - cy) < r + 22; };

export const LAMP_PAUSE_ROWS = ['resume', 'album', 'sound', 'restart'];
export const DONE_CHOICES = ['WALK AGAIN', 'BACK TO THE ALBUM'];
export const DONE_WAIT = 4;                  // the finished print shows on its own for a moment first
export const EVENING_WAIT = 1.4;             // (a shorter wait when the evening is simply over)
const KINDS = { street: ['plain', 'lantern', 'porter', 'bundle', 'lantern', 'rickshaw', 'plain'], balcony: ['sit', 'sit', 'stand', 'stroll'] };

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
  /** A new evening: the lanterns are out (any old glow fades), and he starts again at the corner. */
  newEvening() {
    const old = this.lanterns;
    this.lanterns = LANTERNS.map((l, i) => ({ ...l, lit: false, glow: old ? old[i].glow : 0 }));
    this.player = { z: VIEW.ZC - 10, vz: 0, face: 1, step: 0, lightT: 0, lantern: -1, raise: 0, fade: 0, nod: 0 };
    this.drag = null;                // the touch now steering (a touch that began on the LIGHT button is left alone)
    this.reachable = -1;             // the unlit lantern within reach (the LIGHT button shows), or -1
    this.ink = 0; this.endT = 0; this.allLitSaid = false;
  }
  lightAll() { for (const l of this.lanterns) { l.lit = true; l.glow = 1; } }
  get litCount() { return this.lanterns.filter((l) => l.lit).length; }

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
      // he has walked off the right edge: the street carries on while you choose what next
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
          // a new touch: he heads toward the side of him the finger landed on
          this.drag = { id: inp.touchId, button: (this.reachable >= 0 || p.lightT > 0) && onLightButton(inp.fingerX, inp.fingerY ?? 0, this.W),
            dir: inp.fingerX >= zToX(p.z, this.W) ? 1 : -1, ext: inp.fingerX };
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
        const e = T.lightSecs - p.lightT, sz = lightSpot(l);
        if (p.z !== sz) { const mv = clamp(sz - p.z, -T.walkSpeed * dt, T.walkSpeed * dt); p.z += mv; p.step += Math.abs(mv) / 9; }
        p.face = 1;
        p.raise = e < 0.4 ? 0 : e < 1.2 ? smooth01((e - 0.4) / 0.8) : e < 1.75 ? 1 : smooth01(1 - (e - 1.75) / (T.lightSecs - 1.75));
        if (T.lightSecs - before < T.catchAt && e >= T.catchAt && !l.lit) {
          l.lit = true; this.stats.lit++;
          if (scoring) { this.addInk(100 / this.lanterns.length); this.say('light', { n: this.litCount }); }
          if (scoring && this.litCount === 1) this.msg('THE FIRST LANTERN IS LIT', 3);
          if (scoring && this.litCount === this.lanterns.length) this.msg('EVERY LANTERN IS LIT', 4);
        }
        if (p.lightT <= 0) { p.lightT = 0; p.raise = 0; p.lantern = -1; }
        p.vz = 0;
      } else if (playing) {
        // hold a finger and he walks (toward the side it landed on, or whichever way it last slid); let go and he stops.
        // Right on screen = toward you = less depth. The arrow keys walk him too.
        if (inp.fingerX != null) { if (!this.drag.button) want = -this.drag.dir * T.walkSpeed; }
        else want = -clamp(inp.steer || 0, -1, 1) * T.walkSpeed;
      }
      if (p.lightT <= 0) {
        p.vz += (want - p.vz) * Math.min(1, dt * (Math.abs(want) > Math.abs(p.vz) ? T.start : T.stop));
        if (!want && Math.abs(p.vz) < 0.5) p.vz = 0;
        p.z = Math.min(VIEW.ZC - 10, p.z + p.vz * dt);
        if (p.z === VIEW.ZC - 10 && p.vz > 0) p.vz = 0;
        if (Math.abs(p.vz) > 0.8) p.face = p.vz < 0 ? 1 : -1;
        p.step += Math.abs(p.vz) * dt / 9;
      }

      // which unlit lantern is within reach: the LIGHT button shows while there is one
      this.reachable = -1;
      if (playing && p.lightT <= 0) {
        let best = T.reach;
        this.lanterns.forEach((l, i) => { if (!l.lit) { const d = Math.abs(p.z - lightSpot(l)); if (d < best) { best = d; this.reachable = i; } } });
        if (this.reachable >= 0 && scoring && !this.hinted) { this.hinted = true; this.msg('TAP THE GLOWING BUTTON TO LIGHT THE LANTERN', 5); }
      }

      // walked off the right edge: the evening is over (the print is complete if every lantern is lit)
      if (playing && p.z <= EXIT_Z) {
        p.vz = 0; this.reachable = -1; this.completeT = 0; this.choice = 0; this.stats.evenings++; this.message = null;
        if (this.litCount === this.lanterns.length) { this.state = 'complete'; this.stats.rounds++; this.say('complete'); }
        else { this.state = 'evening'; this.say('arrived'); }
      }
    }

    // ---- the passers-by: along the street (they nod as they pass you), and gentle life on the balcony upstairs ----
    for (const w of this.walkers) {
      w.nod = Math.max(0, w.nod - dt / 1.2);
      w.swing = Math.sin(this.t * 2.2 + w.phase);
      if (w.wait > 0) { w.wait -= dt; continue; }
      if (w.lane === 'balcony') { this.stepBalcony(w, dt); continue; }
      w.z += w.dir * w.speed * dt;
      w.step += w.speed * dt / 9;
      if (this.state === 'play' && !w.nodded && w.kind !== 'rickshaw' && Math.abs(w.z - p.z) < T.nodNear) {
        w.nodded = true; w.nod = 1; p.nod = 1; this.stats.nods++;
        if (scoring) this.say('bow');
      }
    }
    p.nod = Math.max(0, p.nod - dt / 1.2);
    for (let i = 0; i < this.walkers.length; i++) {
      const w = this.walkers[i];
      if (w.lane === 'street' && (w.z > 3200 || w.z < -260)) { this.walkers.splice(i, 1); i--; this.spawnWalker('street', false); }
    }
    this.inkShown += (this.ink - this.inkShown) * Math.min(1, dt * 1.6);
  }

  /** Upstairs: people sit and look out, fan themselves, turn to each other; now and then one strolls a little way along. */
  stepBalcony(w, dt) {
    const r = this.rand;
    w.headT -= dt;
    if (w.headT <= 0) { w.head = w.head ? 0 : (r() < 0.5 ? -1 : 1); w.headT = 2 + r() * 5; }
    if (w.kind === 'stroll' || w.goZ != null) {
      if (w.goZ == null) w.goZ = clamp(w.z + (r() - 0.5) * 240, 30, VIEW.ZC - 30);
      const dz = w.goZ - w.z;
      if (Math.abs(dz) < 1) { w.goZ = null; w.wait = 4 + r() * 8; w.kind = r() < 0.5 ? 'stand' : 'stroll'; }
      else { const mv = Math.sign(dz) * Math.min(Math.abs(dz), 10 * dt); w.z += mv; w.dir = dz > 0 ? 1 : -1; w.step += Math.abs(mv) / 9; }
    } else if (r() < dt / 25) w.goZ = clamp(w.z + (r() - 0.5) * 160, 30, VIEW.ZC - 30);     // (even the ones sitting get up now and then)
  }

  /** Someone sets off along the street (from the far end, beyond the corner, or from the right), or takes a place upstairs. */
  spawnWalker(lane, already) {
    const r = this.rand, kinds = KINDS[lane];
    let kind = kinds[Math.floor(r() * kinds.length)];
    if (kind === 'rickshaw' && this.walkers.some((w) => w.kind === 'rickshaw')) kind = 'lantern';      // (one rickshaw at a time)
    const dir = r() < 0.5 ? 1 : -1;
    const z = lane === 'balcony' ? 40 + r() * (VIEW.ZC - 80) : already ? r() * 2000 : dir > 0 ? -250 : 3100;
    this.walkers.push({ lane, kind, dir, z, speed: kind === 'rickshaw' ? 60 + r() * 10 : 22 + r() * 10, step: r() * 4, phase: r() * 6, swing: 0,
      wait: already || lane === 'balcony' ? r() * 3 : 2 + r() * 8, nod: 0, nodded: false, head: 0, headT: r() * 4, goZ: null,
      // plain working clothes: a muted colour, sometimes striped or checked, sometimes a head cloth or an apron
      robe: Math.floor(r() * 8), pattern: r() < 0.3 ? 'stripe' : r() < 0.45 ? 'check' : '', cloth: lane === 'street' && r() < 0.35, apron: lane === 'street' && r() < 0.25,
      fan: lane === 'balcony' && r() < 0.5 });
  }

  addInk(v) {
    const before = this.ink;
    this.ink = Math.min(100, this.ink + v + 1e-9);
    if (Math.floor(this.ink / 10) > Math.floor(before / 10)) this.say('ink', { level: Math.floor(this.ink / 10) });
  }
}

const smooth01 = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
