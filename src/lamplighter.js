// THE LAMPLIGHTER (print 4, Meiji Tokyo at night; colour after Kiyochika's "Night Stalls at Asakusa", the close flat-on house
// fronts after Moronobu's teahouse (research 16), Eizan and Yoshiiku): the rules. One screen, seen flat-on and close: three house
// fronts, their ground floors an inset ARCADE with red paper lanterns hanging along its eaves. You are the lamplighter, walking
// the street just outside the arcade: hold a finger and he walks toward it, let go and he stops. Under an unlit lantern the LIGHT
// button shows; tap it and he reaches up with his pole and the lantern catches. Light them all and the print is complete.
// The sky never changes (Tom): the only change of light is the lanterns. Passers-by stroll inside the arcade and along the street.
// Pure logic: no drawing, no sound, no DOM. tools/selftest.mjs plays it with a bot.
//
// Positions are picture units (screen x, and the y of each walking line). He walks one line (WALK_Y), left and right only
// (v1.4.2, Tom). v1.4.3: the view is OBLIQUE like research 16 (depth runs up and to the right, OBLIQUE per unit of depth), so
// nobody changes size wherever they walk; the play is further forward, out on the street.
import { clamp } from './ocean.js';
import { MIN_W, MAX_W, PAUSE_Y0, PAUSE_DY } from './sim.js';
import { readChoice } from './choice.js';

// ---- the picture, top to bottom ----
export const OBLIQUE = [0.55, -0.55];       // one unit of depth (away from you) moves this far across and up the picture
export const EAVE_Y = 222;                   // the front edge of the arcade's roof: the lanterns hang from it
export const LANTERN_Y = 266;                // where a lantern hangs (its middle)
export const ARCADE_DEPTH = 80;              // how deep the arcade is, front posts to the shop fronts
export const SILL_Y = 455;                   // the arcade's front edge (its floor, at the front)
export const ARCADE_Y = SILL_Y + OBLIQUE[1] * 40;   // people walking inside the arcade, halfway in
export const BACK_Y = 494;                   // people walking along the street, between him and the arcade
export const WALK_Y = 542;                   // the lamplighter's line, out on the street
export const STREET_Y = 592;                 // people walking along the street, in front of him

// three house fronts across the screen (fractions of the width) and how many lanterns hang under each one's eaves
// (a..b: the stretch of the front they hang along; the first house's start further in, so he can stand to the left of them)
export const HOUSES = [{ u0: 0, u1: 0.31, n: 3, a: 0.36, b: 0.86 }, { u0: 0.31, u1: 0.67, n: 5, a: 0.14, b: 0.86 }, { u0: 0.67, u1: 1, n: 4, a: 0.14, b: 0.86 }];
export const LANTERNS = HOUSES.flatMap((h, hi) => Array.from({ length: h.n }, (_, i) => ({ house: hi, u: h.u0 + (h.u1 - h.u0) * (h.a + ((h.b - h.a) * i) / (h.n - 1)) })));
export const lanternX = (l, W) => l.u * W;
/** Where he stands to light lantern l (never off the screen's edge). */
export const lightSpot = (l, W) => Math.max(30, lanternX(l, W) - LTUNE.standOff);

export const LTUNE = {
  walkSpeed: 52,           // picture units per second: a slow walk (he crosses the screen in about 25 s)
  start: 10, stop: 18,     // how quickly he gets going, and stops when the finger lifts (quick: nothing slippy, Tom)
  reach: 24,               // how close (across) he must be to a lantern's lighting spot for the LIGHT button to show
  standOff: 46,            // he lights it from the street in front, so (in the slanted view) he stands below and to the left of it
  lightSecs: 2.8,          // stepping into place, raising the pole, the lantern catching, lowering it again
  catchAt: 1.45,
  glowSecs: 1.4,
  doneDelay: 2.2,          // after the last lantern catches, a moment to see the street lit before "complete"
  walkers: { arcade: 3, back: 2, front: 2 },    // passers-by on each line
  nodNear: 40,             // passers-by nod as they pass you this close (they never stop you)
};

// the LIGHT button: round, bottom right, like Plum Blossom's GATHER (centre x, centre y, radius). Taps are generous.
export const lightButton = (W) => [W - 100, 600 - 100, 62];
export const onLightButton = (x, y, W) => { const [cx, cy, r] = lightButton(W); return Math.hypot(x - cx, y - cy) < r + 22; };

export const LAMP_PAUSE_ROWS = ['resume', 'album', 'sound', 'restart'];
export const DONE_CHOICES = ['LIGHT THEM AGAIN', 'BACK TO THE ALBUM'];
export const DONE_WAIT = 4;
// working people, mostly (Tom: less frivolous than the blossom: work, not leisure)
const KINDS = { arcade: ['lantern', 'plain', 'plain', 'pair', 'bundle'], back: ['porter', 'plain', 'lantern', 'rickshaw', 'bundle'], front: ['plain', 'lantern', 'porter', 'bundle'] };
const LANE_Y = { arcade: ARCADE_Y, back: BACK_Y, front: STREET_Y };

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

  setWidth(w) {
    if (!Number.isFinite(w)) return;
    this.W = clamp(Math.round(w), MIN_W, MAX_W);
    if (this.player) this.player.x = clamp(this.player.x, 30, this.W - 30);
  }
  get tiltSteer() { return false; }
  get tiltFlip() { return false; }
  changed() { if (this.onSettings) this.onSettings(this.settings); }

  reset() {
    this.t = 0; this.tick = 0;
    this.ink = 0; this.inkShown = 0;
    this.events = [];
    this.stats = { lit: 0, nods: 0, rounds: 0 };
    this.endless = false; this.completeT = 0; this.choice = 0; this.doneT = 0;
    this.message = null;
    this.cricketIn = 2;
    this.lanterns = null;
    this.newRound();
    this.walkers = [];
    for (const lane in LTUNE.walkers) for (let i = 0; i < LTUNE.walkers[lane]; i++) this.spawnWalker(lane, true);
  }
  newRound() {
    const old = this.lanterns;
    this.lanterns = LANTERNS.map((l, i) => ({ ...l, lit: false, glow: old ? old[i].glow : 0 }));   // (any old glow fades out)
    this.player = { x: this.W * 0.05, vx: 0, face: 1, step: 0, lightT: 0, lantern: -1, raise: 0, fade: 0, nod: 0 };
    this.drag = null;                // the touch now steering (a touch that began on the LIGHT button is left alone)
    this.reachable = -1;             // the unlit lantern within reach (the LIGHT button shows), or -1
    this.doneT = 0;
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
        this.msg('HOLD A FINGER TO WALK. LIGHT EVERY LANTERN', 6);
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
      if (r.chosen === 0) {                                  // the lanterns go out, and a new evening begins
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
        if (!this.drag || this.drag.id !== inp.touchId) this.drag = { id: inp.touchId, button: (this.reachable >= 0 || p.lightT > 0) && onLightButton(inp.fingerX, inp.fingerY ?? 0, this.W) };
      } else this.drag = null;
      if (p.lightT > 0) {
        // lighting: step into place beside the lantern, raise the pole, the lantern catches, lower it again
        const l = this.lanterns[p.lantern], before = p.lightT;
        p.lightT -= dt;
        const e = T.lightSecs - p.lightT, sx = lightSpot(l, this.W);
        if (p.x !== sx) { const mv = clamp(sx - p.x, -T.walkSpeed * dt, T.walkSpeed * dt); p.x += mv; p.step += Math.abs(mv) / 34; }   // (a step or two into place)
        p.face = 1;
        p.raise = e < 0.4 ? 0 : e < 1.2 ? smooth01((e - 0.4) / 0.8) : e < 1.75 ? 1 : smooth01(1 - (e - 1.75) / (T.lightSecs - 1.75));
        if (T.lightSecs - before < T.catchAt && e >= T.catchAt && !l.lit) {
          l.lit = true; this.stats.lit++;
          if (scoring) { this.addInk(100 / this.lanterns.length); this.say('light', { n: this.litCount }); }
          if (this.litCount === this.lanterns.length && scoring) this.doneT = T.doneDelay + (T.lightSecs - e);
          else if (scoring && this.litCount === 1) this.msg('THE FIRST LANTERN IS LIT', 3);
        }
        if (p.lightT <= 0) { p.lightT = 0; p.raise = 0; p.lantern = -1; }
        p.vx = 0;
      } else if (playing) {
        // hold a finger and he walks toward it; let go and he stops (the arrow keys walk him too)
        if (inp.fingerX != null) {
          if (!this.drag.button) { const dx = clamp(inp.fingerX, 30, this.W - 30) - p.x; want = Math.abs(dx) < 3 ? 0 : clamp(dx / 25, -1, 1) * T.walkSpeed; }
        } else want = clamp(inp.steer || 0, -1, 1) * T.walkSpeed;
      }
      if (p.lightT <= 0) {
        p.vx += (want - p.vx) * Math.min(1, dt * (Math.abs(want) > Math.abs(p.vx) ? T.start : T.stop));
        if (!want && Math.abs(p.vx) < 2) p.vx = 0;
        p.x = clamp(p.x + p.vx * dt, 30, this.W - 30);
        if (Math.abs(p.vx) > 3) p.face = Math.sign(p.vx);
        p.step += Math.abs(p.vx) * dt / 34;
      }

      // which unlit lantern is within reach: the LIGHT button shows while there is one
      this.reachable = -1;
      if (playing && p.lightT <= 0) {
        let best = T.reach;
        this.lanterns.forEach((l, i) => {
          if (l.lit) return;
          const d = Math.abs(p.x - lightSpot(l, this.W));
          if (d < best) { best = d; this.reachable = i; }
        });
        if (this.reachable >= 0 && scoring && !this.hinted) { this.hinted = true; this.msg('TAP THE GLOWING BUTTON TO LIGHT THE LANTERN', 5); }
      }

      // the last lantern has caught: a moment to look at the lit street, then the print is complete
      if (this.doneT > 0 && (this.doneT -= dt) <= 0 && playing) {
        this.doneT = 0; this.stats.rounds++;
        this.state = 'complete'; this.completeT = 0; this.choice = 0; this.reachable = -1; p.vx = 0;
        this.say('complete'); this.msg('THE STREET IS LIT', 6);
      }
    }

    // ---- the passers-by: inside the arcade, and along the street behind and in front of you (they never stop you) ----
    for (const w of this.walkers) {
      if (w.wait > 0) { w.wait -= dt; continue; }
      w.x += w.dir * w.speed * dt;
      w.step += w.speed * dt / 40;
      w.swing = Math.sin(this.t * 2.2 + w.phase);
      w.nod = Math.max(0, w.nod - dt / 1.2);
      // a polite nod as they pass close by you
      if (this.state === 'play' && !w.nodded && w.kind !== 'rickshaw' && Math.abs(w.x - p.x) < T.nodNear) {
        w.nodded = true; w.nod = 1; p.nod = 1; this.stats.nods++;
        if (scoring) this.say('bow');
      }
    }
    p.nod = Math.max(0, p.nod - dt / 1.2);
    for (let i = 0; i < this.walkers.length; i++) {
      const w = this.walkers[i];
      if (w.x < -160 || w.x > this.W + 160) { this.walkers.splice(i, 1); i--; this.spawnWalker(w.lane, false); }
    }
    this.inkShown += (this.ink - this.inkShown) * Math.min(1, dt * 1.6);
  }

  /** Someone sets off from one side, inside the arcade or along the street (at the start, already part-way along). */
  spawnWalker(lane, already) {
    const r = this.rand, kinds = KINDS[lane];
    let kind = kinds[Math.floor(r() * kinds.length)];
    if (kind === 'rickshaw' && this.walkers.some((w) => w.kind === 'rickshaw')) kind = 'lantern';      // (one rickshaw at a time)
    const dir = r() < 0.5 ? 1 : -1;
    const x = already ? 80 + r() * (this.W - 160) : dir > 0 ? -140 : this.W + 140;
    this.walkers.push({ lane, kind, dir, x, y: LANE_Y[lane] + (r() - 0.5) * 6,
      speed: kind === 'rickshaw' ? 70 + r() * 12 : kind === 'porter' ? 30 + r() * 8 : 22 + r() * 14, step: r() * 4, phase: r() * 6, swing: 0,
      wait: already ? 0 : 2 + r() * 8, nod: 0, nodded: false,
      // plain working clothes: a muted colour, sometimes striped or checked, sometimes a head cloth or an apron
      robe: Math.floor(r() * 8), pattern: r() < 0.3 ? 'stripe' : r() < 0.45 ? 'check' : '', cloth: r() < 0.35, apron: r() < 0.25 });
  }

  addInk(v) {
    const before = this.ink;
    this.ink = Math.min(100, this.ink + v + 1e-9);
    if (Math.floor(this.ink / 10) > Math.floor(before / 10)) this.say('ink', { level: Math.floor(this.ink / 10) });
  }
}

const smooth01 = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
