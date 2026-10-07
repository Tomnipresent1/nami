// KAMATA (print 3, after Hiroshige's "Plum Garden at Kamata"): the rules. A slow stroll through the plum garden in a breeze, from
// the waiting kago (palanquin) to beyond the third tea hut. Hold a finger to walk; slide it left or right to step around trees, huts
// and people; let go to stand still and watch the petals. Pass close to someone and you both bow. Nothing to win or lose.
// Pure logic: no drawing, no sound, no DOM. tools/selftest.mjs plays it with a bot.
//
// The garden is a flat ground: x = left/right (0 = the middle of the path, roughly), z = how far in. Units are about a metre.
import { clamp } from './ocean.js';
import { MIN_W, MAX_W, PAUSE_Y0, PAUSE_DY } from './sim.js';
import { CHOICE_WAIT, readChoice } from './choice.js';

// just beyond the second hut: about 1½ minutes' stroll (Tom, v3.8: it was too long at 200, beyond the third hut, ~2½ min)
export const PATH_END = 120;
export const HALF = 5.5;                     // how far either side of the path you may wander
/** The path's middle at distance z: it meanders gently. */
export const pathX = (z) => 1.6 * Math.sin(z / 37) + 0.8 * Math.sin(z / 13 + 1);

export const GTUNE = {
  walkSpeed: 1.5,          // a slow stroll (units per second): about 2 minutes to the third hut
  ease: 1.6,               // how gently you start and stop walking
  bodyR: 0.45,             // your size, for stepping round things
  nudge: 0.9,              // walking straight into something slides you gently round it (units per second sideways)
  bowNear: 1.8,            // pass this close to someone and you both bow
  bowSecs: 1.4,
  bowGap: 9,               // at least this long between bows (so a busy garden doesn't keep stopping you)
  inkPerUnit: 0.2,         // ink for each unit walked (one stroll ~ 24)
  inkBow: 1.5,
  // gathering fallen sprigs of plum blossom into her basket (Tom's wife's idea, 2026-10-07)
  sprigs: 10,              // about this many along each stroll (as many per minute as before; the stroll is shorter now)
  reach: 1.4,              // how close one must be to pick it
  pickSecs: 1.6,           // she stops, bends, picks it up and puts it in her basket
  inkPick: 1.5,
  inkGift: 3,              // for handing your basket to the tea-house keeper
  // the tea-house ending, unhurried: seconds for each part (v3.11, Tom: the pause before the bow was too long)
  // v3.15 (Tom): after the bow she arranges the vase like ikebana: three stems, one at a time (~1 s each), then a moment to regard it
  tea: { settle: 0.05, stem: 1.25, regard: 0.9, linger: 1.6 },          // (v3.16, Tom: the twigs moved a touch too fast at 1.0)
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
// the pick button: a round button in the bottom-right corner (centre x, centre y, radius, in picture units). Taps are generous.
export const pickButton = (W) => [W - 100, 600 - 100, 62];
export const onPickButton = (x, y, W) => { const [cx, cy, r] = pickButton(W); return Math.hypot(x - cx, y - cy) < r + 22; };

export const HUTS = [
  { z: 55, side: -1, double: true },         // the two thatched huts together, as in the print
  { z: 110, side: 1, double: false },
  { z: 165, side: -1, double: false },        // the third hut, glimpsed through the trees beyond the end of the stroll
].map((h) => ({ ...h, x: pathX(h.z) + h.side * (h.double ? 9.2 : 7.6), hw: h.double ? 5 : 3.2, hd: 2.4 }));
// ---- the tea house (Tom, v3.9-v3.11): the second hut is a chaya. In front of it stands a small round table with a vase of
// blossom on it, and the keeper (a man, in a dark haori) at the tea house's front. The stroll closes there: she arrives, bows to
// him (he bows back), then puts the blossom she gathered into the vase herself, in two gentle movements; a moment, then the fade.
export const TEA = HUTS[1];
// (v3.20, Tom: back where it was in v3.18; a step further out (v3.19) looked out of place beside the tea house)
export const TABLE = { x: TEA.x - TEA.hw - 0.3, z: TEA.z - TEA.hd - 1.3, r: 0.45, top: 0.58 };
export const KEEPER = { x: TEA.x - TEA.hw + 0.9, z: TEA.z - TEA.hd - 0.25 };             // at the front of the tea house
export const OFFER_SPOT = { x: TABLE.x - 0.55, z: TABLE.z - 0.8 };                       // where she stands, just in front of the table
export const VASE = { x: TABLE.x, y: TABLE.top, z: TABLE.z };                            // on the table
export const VASE_START = 0;              // the vase waits empty each stroll, so what ends up in it is what she gathered (Tom, v3.12)
export const OFFER_FROM = OFFER_SPOT.z - 5;            // walking this far in, she makes her way over to the tea house by herself
// a clear space in front of the tea house: nobody lingers here, and passers-by give it a wide berth while you are there (Tom)
// (v3.14, Tom: two people still stood near the table and faded as she arrived: the space is bigger, and kept clear from the start)
export const TEA_CLEAR = { x: (OFFER_SPOT.x + KEEPER.x) / 2, z: (OFFER_SPOT.z + KEEPER.z) / 2, r: 7 };
const FAR_LANE = (z) => pathX(z) - TEA.side * 3.3;      // passers-by keep to this side of the path as they pass the tea house
// The strip of garden that shows BEHIND the vase in the final shot (as the camera sees it from where it settles): nobody stands
// or walks there, so the blossom has clean green behind it (v3.19, Tom). Narrow at the vase, widening with distance.
const FINAL_CAM = { x: (OFFER_SPOT.x + KEEPER.x) / 2, z: OFFER_SPOT.z - 19.5 };
export function behindVase(x, z, pad = 0) {
  if (z < VASE.z + 0.4) return false;
  const t = (z - FINAL_CAM.z) / (VASE.z - FINAL_CAM.z);
  if (t > 2.4 + pad * 0.2) return false;                           // much further off, people are small and well above the blossom
  const rayX = FINAL_CAM.x + (VASE.x - FINAL_CAM.x) * t;
  return Math.abs(x - rayX) < 0.9 * t + 0.6 + pad;
}
const inTeaClear = (x, z, pad = 0) => Math.hypot(x - TEA_CLEAR.x, z - TEA_CLEAR.z) < TEA_CLEAR.r + pad;

// the kago stands just beside where you begin, so at the start it is big and cropped by the right edge, framing the view as in the print
// (v3.13, Tom: its top was too close and got in the way of the view; moved further right so it frames the edge instead)
export const KAGO = { x: pathX(-5) + 5.3, z: -5, hw: 1.5, hd: 0.8 };
// v3.15 (Tom): trying the opening without the kago, with a big plum tree standing in its place. true = bring the kago back.
export const SHOW_KAGO = false;
export const POND = { x0: -22, x1: -9.5, z0: 30, z1: 62 };

export const TREE_KINDS = 8;                 // different painted trees (each with its own trunk tone and blossom)

export function buildGarden() {
  const r = mulberry32(1857);                // the year of the print
  const trees = [], fences = [];
  const clear = (x, z, pad) => HUTS.every((h) => Math.abs(x - h.x) > h.hw + pad || Math.abs(z - h.z) > h.hd + pad)
    && (Math.abs(x - KAGO.x) > KAGO.hw + pad || Math.abs(z - KAGO.z) > KAGO.hd + pad)       // (kept clear either way: kago, or its tree)
    && !(x > POND.x0 - 1 && x < POND.x1 + 1 && z > POND.z0 - 1 && z < POND.z1 + 1);
  const tree = (x, z, extra = {}) => ({ x, z, r: 0.6, kind: Math.floor(r() * TREE_KINDS), seed: r() * 100,
    size: 0.82 + r() * 0.42, flip: r() < 0.5, ...extra });       // every tree a little different: size, mirrored or not
  // you start enclosed on both sides (Tom: there was open space to the left at the start): the kago on the right, and on the left
  // a big trunk cropped by the screen's edge, like the print's left-hand tree, with more close behind it
  for (const [dx, z] of [[-4.4, -9], [-6.6, -3], [-7.2, 4], [-9.5, 9], [6.8, 2], [8.5, 8]]) trees.push(tree(pathX(z) + dx, z, { edge: true }));
  // without the kago, a big plum tree stands where it was, its trunk framing the right edge of the opening view
  if (!SHOW_KAGO) trees.push(tree(KAGO.x - 0.3, KAGO.z, { edge: true, size: 1.2 }));
  // the garden starts well behind where you begin, so you start in the middle of it, not walking up to it (Tom)
  for (let z = -45; z < 330; z += 2 + r() * 3.5) {
    // beyond the end of the stroll the orchard closes across the path, so the avenue never opens onto a bare horizon (Tom)
    if (z > PATH_END + 10) for (let k = 0; k < 3; k++) {
      const x = pathX(z) + (r() - 0.5) * 2 * (HALF + 6);
      if (trees.every((t) => Math.hypot(t.x - x, t.z - z) > 3)) trees.push(tree(x, z));
    }
    // now and then a tree on or right beside the path: something to step around
    if (z > 14 && z < PATH_END - 4 && r() < 0.22) {
      const x = pathX(z) + (r() - 0.5) * 7;
      if (clear(x, z, 1.5) && trees.every((t) => Math.hypot(t.x - x, t.z - z) > 4)) trees.push(tree(x, z));
    }
    // the orchard either side: irregular, no rows (Tom: they looked like a line). Most trees crowd in fairly close, some stand
    // right by the path (their trunks sweep past the screen's edges, cropped, like the print's big foreground tree), a few far back
    for (const side of [-1, 1, -1, 1, -1, 1]) {
      if (r() < 0.2) continue;
      const u = r();
      // (a good share stand far back, so the distance is always a thicket of trunks and blossom, never open horizon)
      const off = u < 0.16 ? HALF + 0.7 + r() * 1.5 : u < 0.55 ? HALF + 2.2 + r() * 6 : u < 0.8 ? HALF + 8 + r() * 9 : HALF + 17 + r() * 30;
      const x = pathX(z) + side * off, zz = z + (r() - 0.5) * 2;
      if (!clear(x, zz, 1) || !trees.every((t) => Math.hypot(t.x - x, t.z - zz) > 2.8)) continue;
      trees.push(tree(x, zz, { edge: off < HALF + 3 }));
      // a low bamboo fence beside some of the trees, as in the print
      if (off > HALF + 1.5 && off < HALF + 14 && r() < 0.3) fences.push({ x: x + side * (0.8 + r()), z: zz - 0.6 - r(), w: 1.4 + r() * 1.8, seed: r() * 100 });
    }
  }
  return { trees, fences };
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
    this.stats = { strolls: 0, bows: 0, walked: 0, picked: 0 };
    this.endless = false; this.completeT = 0; this.choice = 0;
    this.message = null;
    this.wind = 0.5;
    this.chimeIn = 4; this.birdIn = 12;
    // little birds flitting across the picture now and then (Tom; v3.8 mejiro, v3.9 softer brown/russet and further off).
    // They live in picture units (x across, y down) since they only cross the screen; the painting draws them.
    this.birds = []; this.flitIn = 6 + this.rand() * 6;
    this.newStroll();
  }
  newStroll() {
    this.player = { x: pathX(0), z: 0, v: 0, vx: 0, bowT: 0, bow: 0, fade: 0, step: 0, look: 0, lookTo: 0, lookT: 4, pickT: 0, pick: 0 };
    this.drag = null;
    this.arrivedT = 0;
    this.basket = 0;                 // sprigs gathered on this stroll
    this.vase = VASE_START;          // sprigs in the vase on the tea house's table (empty until she fills it)
    this.reachable = -1;             // the sprig within reach right now (the pick button shows), or -1
    this.offer = null;               // the hand-over at the tea house, once it begins: { phase: walk | bow | give | thanks, t }
    this.handedOver = false;         // the basket has gone to the keeper
    this.keeper = { x: KEEPER.x, z: KEEPER.z, bowT: 0, head: 0 };
    const r = this.rand;
    // fallen sprigs of plum blossom along the way: never inside a tree, hut or the kago, always on or near the path
    this.sprigs = [];
    const free = (x, z) => this.garden.trees.every((t) => Math.hypot(t.x - x, t.z - z) > 1.3)
      && HUTS.every((h) => Math.abs(x - h.x) > h.hw + 0.8 || Math.abs(z - h.z) > h.hd + 0.8);
    const gap = (PATH_END - 15) / GTUNE.sprigs;
    for (let z = 8; z < PATH_END - 6; z += gap * (0.5 + r())) {
      for (let k = 0; k < 6; k++) {
        const x = pathX(z) + (r() - 0.5) * 2 * (HALF - 0.8);
        if (free(x, z)) { this.sprigs.push({ x, z, picked: false, seed: r() * 100, angle: (r() - 0.5) * 2 }); break; }
      }
    }
    // people: some linger admiring the trees (shifting about, glancing around, wandering a few steps now and then); some stroll
    // the path, coming toward you or ambling on ahead of you (Tom: more gentle movement)
    this.people = [];
    let id = 0;
    const nearSprig = (x, z, d) => this.nearSprig(x, z, d);
    const person = (kind, x, z, extra = {}) => ({ id: id++, kind, x, z, homeX: x, homeZ: z, vx: 0, vz: 0, tx: x, tz: z, wait: 1 + r() * 6,
      bowed: false, bowT: 0, dress: Math.floor(r() * 30), phase: r() * 6, step: r() * 4, head: 0, headTo: 0, headT: r() * 4,
      face: r() < 0.6, ...extra });
    for (let z = 3; z < PATH_END + 30; z += 6 + r() * 7) {           // (from just ahead of you: anyone behind you would be right in front of the camera)
      const side = r() < 0.5 ? -1 : 1, x = pathX(z) + side * (2 + r() * 6);
      // nobody lingers anywhere near the tea house, on fallen blossom, or where they'd stand behind the vase in the final shot
      const keepOff = (px, pz) => inTeaClear(px, pz, 3) || nearSprig(px, pz, 2.2) || behindVase(px, pz);
      if (keepOff(x, z)) continue;
      this.people.push(person('stand', x, z));
      // often in pairs, admiring the blossom together
      if (r() < 0.45 && !keepOff(x + side * 0.8, z + 0.4)) this.people.push(person('stand', x + side * 0.8, z + 0.4));
    }
    for (let k = 0; k < 7; k++) {
      const z = 20 + k * 28 + r() * 12, away = k % 3 === 1;
      this.people.push(person('walk', pathX(z) + (r() - 0.5) * 5, z, { vz: away ? 0.5 + r() * 0.2 : -(0.6 + r() * 0.3), face: !away }));
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
      // beyond the second hut: you fade away; walk again, or back to the album
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
        if (this.strollDone) { this.strollDone = false; this.newStroll(); }   // (finished at the tea house: the next stroll starts afresh)
        this.state = 'play'; this.endless = true; this.say('blip');
        if (r.chosen === 1) { this.paused = true; this.pauseRow = 0; this.albumRequest = true; }
        else this.msg('THE GARDEN IS YOURS. STROLL ON.', 5);
      }
      return;
    }
    if (this.state === 'offering') { this.stepWorld(dt, {}, true); return; }     // at the tea house: it plays out by itself
    // the pick button (or the Enter / Space key): gather the sprig within reach
    if (inp.pick || keys.includes('enter') || taps.some((t) => onPickButton(t.x, t.y, this.W))) this.startPick();
    this.stepWorld(dt, inp, true);
  }

  /** Is there fallen blossom (not yet gathered) within d of x,z? People keep off it, so gathering always flows (Tom). */
  nearSprig(x, z, d) { return (this.sprigs || []).some((s) => !s.picked && Math.hypot(s.x - x, s.z - z) < d); }

  /** Stop, bend down, and gather the sprig within reach into the basket (does nothing if none is within reach). */
  startPick() {
    const p = this.player;
    if (this.reachable < 0 || p.pickT > 0 || p.bowT > 0 || this.state !== 'play') return false;
    p.pickT = GTUNE.pickSecs; p.pickIdx = this.reachable; p.lookTo = 0;
    return true;
  }

  stepWorld(dt, inp, scoring) {
    const T = GTUNE, p = this.player, playing = this.state === 'play' || this.state === 'complete';
    this.t += dt;
    if (this.message && (this.message.t -= dt) <= 0) this.message = null;

    // ---- the breeze: it rises and falls, with the odd gust that sets the petals swirling ----
    this.wind = clamp(0.4 + 0.22 * Math.sin(this.t * 0.13) + 0.5 * Math.max(0, Math.sin(this.t * 0.31 + 2)) ** 4, 0.15, 1);
    if ((this.chimeIn -= dt * (0.6 + this.wind)) <= 0) { this.say('chime', { n: 2 + Math.floor(this.rand() * 3) }); this.chimeIn = 7 + this.rand() * 10; }
    if ((this.birdIn -= dt) <= 0) { this.say('bird'); this.birdIn = 25 + this.rand() * 25; }
    this.stepBirds(dt);

    // ---- you ----
    if (playing) {
      p.fade = Math.min(1, p.fade + dt / 1.5);
      if (p.bowT > 0) { p.bowT -= dt; p.bow = Math.sin(clamp(1 - p.bowT / T.bowSecs, 0, 1) * Math.PI); } else p.bow = 0;
      // gathering a sprig: she stops, bends down, and halfway through it goes into her basket
      if (p.pickT > 0) {
        const before = p.pickT; p.pickT -= dt;
        p.pick = Math.sin(clamp(1 - p.pickT / T.pickSecs, 0, 1) * Math.PI);
        const s = this.sprigs[p.pickIdx];
        if (before > T.pickSecs / 2 && p.pickT <= T.pickSecs / 2 && s && !s.picked) {
          s.picked = true; this.basket++; this.stats.picked++;
          if (scoring) { this.addInk(T.inkPick); this.say('pick', { n: this.basket }); }
        }
      } else p.pick = 0;
      const busy = p.bowT > 0 || p.pickT > 0;
      const walking = !!inp.walk && !busy;
      p.v += ((walking ? T.walkSpeed : 0) - p.v) * Math.min(1, dt * (p.pickT > 0 ? 6 : T.ease));
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
      if (busy) want = 0;
      p.vx += (want - p.vx) * Math.min(1, dt * 20);
      const z0 = p.z;
      p.x += p.vx * dt;
      p.z += p.v * dt;
      p.step += p.v * dt * 1.3;
      this.collide(p, dt, walking);
      const mid = pathX(p.z);
      p.x = clamp(p.x, mid - HALF, mid + HALF);
      // now and then you glance to one side (often toward someone nearby), then look ahead again (Tom: a bit more life)
      if ((p.lookT -= dt) <= 0) {
        if (p.lookTo !== 0) { p.lookTo = 0; p.lookT = 3 + this.rand() * 5; }
        else {
          const near = this.people.filter((q) => q.z > p.z - 1 && q.z - p.z < 9).sort((a, b) => Math.abs(a.z - p.z) - Math.abs(b.z - p.z))[0];
          const side = near && this.rand() < 0.7 ? Math.sign(near.x - p.x) || 1 : this.rand() < 0.5 ? -1 : 1;
          p.lookTo = side * (0.6 + this.rand() * 0.4); p.lookT = 1.2 + this.rand() * 1.6;
        }
      }
      if (busy) p.lookTo = 0;
      p.look += (p.lookTo - p.look) * Math.min(1, dt * 3);
      const walked = Math.max(0, p.z - z0);
      this.stats.walked += walked;
      if (scoring) this.addInk(walked * T.inkPerUnit);

      // which fallen sprig is within reach (just ahead of you or beside you): the pick button shows while there is one
      this.reachable = -1;
      if (p.pickT <= 0) {
        let best = T.reach;
        this.sprigs.forEach((s, i) => { if (!s.picked && s.z > p.z - 0.7) { const d = Math.hypot(s.x - p.x, s.z - p.z); if (d < best) { best = d; this.reachable = i; } } });
      }
      if (this.reachable >= 0 && scoring && !this.pickHinted) { this.pickHinted = true; this.msg('FALLEN BLOSSOM: TAP THE GLOWING BUTTON TO GATHER IT', 5); }

      // nearly at the tea house: she makes her way over to the keeper by herself
      if (this.state === 'play' && p.z >= OFFER_FROM && !this.offer) {
        this.state = 'offering'; this.offer = { phase: 'walk', t: 0 };
        this.drag = null; this.reachable = -1; p.vx = 0; p.lookTo = 0; this.message = null;
        return;
      }
      // the end of the stroll (only reached this way after the print was finished mid-stroll: carry on from the start)
      if (p.z >= PATH_END) {
        this.stats.strolls++;
        if (this.state === 'play') { this.state = 'arrived'; this.arrivedT = 0; this.choice = 0; this.drag = null; p.v = 0; p.vx = 0; this.reachable = -1; this.say('arrived'); this.message = null; }
        else this.newStroll();                                     // (the print finished on this stroll: carry on from the start)
      }
    } else if (this.state === 'offering') this.stepOffering(dt, scoring);
    else if (this.state === 'arrived') p.fade = Math.max(0, p.fade - dt / 1.5);
    if (this.keeper.bowT > 0) this.keeper.bowT -= dt;

    // ---- the other people ----
    const r = this.rand;
    for (const q of this.people) {
      // everyone glances about now and then
      if ((q.headT -= dt) <= 0) { q.headTo = q.headTo ? 0 : (r() < 0.5 ? -1 : 1) * (0.5 + r() * 0.5); q.headT = q.headTo ? 1 + r() * 2 : 2 + r() * 5; }
      q.head += (q.headTo - q.head) * Math.min(1, dt * 3);
      if (q.bowT > 0) { q.bowT -= dt; continue; }
      // nobody walks into you: close by, people step out of your way (they never just freeze, which could box you in)
      // while you are at (or nearly at) the tea house, everyone keeps out of the space in front of it, moving off to the side
      // away from the keeper (Tom: someone passing awkwardly close there, with no bow, felt off)
      // passers-by keep to the far side of the path all the way past the tea house (always, not only once you are there)
      if (q.kind === 'walk' && Math.abs(q.z - TEA_CLEAR.z) < TEA_CLEAR.r + 4) {
        const lane = FAR_LANE(q.z);
        q.x += clamp(lane - q.x, -1, 1) * 0.9 * dt;
      }
      // passers-by step out of the strip behind the vase well before you get there (sideways, the shorter way out)
      if (q.kind === 'walk' && p.z > OFFER_FROM - 30 && behindVase(q.x, q.z, 1.2)) {           // (with a margin: they steer clear before they reach it)
        const t = (q.z - FINAL_CAM.z) / (VASE.z - FINAL_CAM.z), rayX = FINAL_CAM.x + (VASE.x - FINAL_CAM.x) * t;
        q.x += (q.x < rayX ? -1 : 1) * 1.2 * dt;
      }
      // (and should anyone lingering ever end up in the clear space, they wander off to the far side)
      if (q.kind === 'stand' && inTeaClear(q.x, q.z, 0.5)) {
        q.x -= TEA.side * 1.1 * dt; q.step += 1.1 * dt * 1.4;
        q.tx = q.x; q.tz = q.z; q.homeX = q.x; q.homeZ = q.z;
        continue;
      }
      const ax = q.x - p.x, az = q.z - p.z, ad = Math.hypot(ax, az), near = playing && ad < 1.6;
      if (near) {
        const side = Math.abs(ax) > 0.05 ? Math.sign(ax) : Math.sign(q.x - pathX(q.z)) || 1;
        q.x += side * 0.9 * dt; q.step += 0.9 * dt * 1.4;
        if (q.kind === 'stand') { q.tx = q.x; q.tz = q.z; q.homeX += side * 0.9 * dt; }
      }
      if (q.kind === 'walk') {
        if (!near) { q.z += q.vz * dt; q.step += Math.abs(q.vz) * dt * 1.4; }
        // they step aside for you, as you do for them
        if (playing && Math.abs(q.z - p.z) < 6 && Math.sign(q.z - p.z) === -Math.sign(q.vz) && Math.abs(q.x - p.x) < 1.3) q.x += Math.sign(q.x - p.x || 1) * 0.7 * dt;
        // gone behind you: someone else sets off further up the path (coming toward you, or ambling on ahead)
        if (q.z < p.z - 3 || q.z > p.z + 110) {                          // (soon after passing you: behind you, they'd be up against the lens)
          const nz = q.vz < 0 ? p.z + 55 + r() * 40 : p.z + 25 + r() * 30;
          // (near the end of the stroll there's no room up the path: they set off from beyond the far trees instead)
          const z2 = nz < PATH_END + 25 ? nz : PATH_END + 45 + r() * 25;
          q.z = z2; q.x = Math.abs(z2 - TEA_CLEAR.z) < TEA_CLEAR.r + 4 ? FAR_LANE(z2) : pathX(z2) + (r() - 0.5) * 5;
          q.bowed = false; q.dress = Math.floor(r() * 30);
        }
      } else {
        // lingering: wait a while, then wander a few steps to a new spot near where they were, and admire from there
        const dx = q.tx - q.x, dz = q.tz - q.z, d = Math.hypot(dx, dz);
        if (d > 0.05 && !near) {
          const sp = Math.min(0.55, d * 2);
          q.x += (dx / d) * sp * dt; q.z += (dz / d) * sp * dt; q.step += sp * dt * 1.4;
          q.face = dz < 0 || (Math.abs(dz) < 0.2 ? q.face : false);
        } else if ((q.wait -= dt) <= 0) {
          q.tx = q.homeX + (r() - 0.5) * 5; q.tz = q.homeZ + (r() - 0.5) * 4; q.wait = 4 + r() * 8;
          const off = q.tx - pathX(q.tz);                                    // they keep to the sides, off the middle of the path
          if (Math.abs(off) < 2.2) q.tx = pathX(q.tz) + (Math.sign(off) || 1) * 2.2;
          if (inTeaClear(q.tx, q.tz, 1) || this.nearSprig(q.tx, q.tz, 1.8) || behindVase(q.tx, q.tz)) { q.tx = q.x; q.tz = q.z; }   // never wander to the tea house, onto blossom, or behind the vase
          if (r() < 0.3) { q.tx = q.x; q.tz = q.z; q.face = !q.face; }     // or just turn round to look the other way
        }
      }
      if (playing && !q.bowed && p.bowT <= 0 && this.t - (this.lastBow ?? -99) > T.bowGap && Math.hypot(q.x - p.x, q.z - p.z) < T.bowNear) {
        q.bowed = true; q.bowT = T.bowSecs; p.bowT = T.bowSecs; this.lastBow = this.t;
        this.stats.bows++;
        if (scoring) { this.addInk(T.inkBow); this.say('bow'); }
      }
    }
    this.inkShown += (this.ink - this.inkShown) * Math.min(1, dt * 1.6);
  }

  /** At the tea house: she walks over to the keeper, they bow, she hands over her basket (the blossom goes in the vase), the
   *  keeper bows her thanks, and the stroll ends. With an empty basket they simply bow. */
  stepOffering(dt, scoring) {
    const T = GTUNE, p = this.player, o = this.offer;
    o.t += dt;
    if (p.bowT > 0) { p.bowT -= dt; p.bow = Math.sin(clamp(1 - p.bowT / T.bowSecs, 0, 1) * Math.PI); } else p.bow = 0;
    // (while she puts blossom in the vase, she leans gently toward the table)
    p.pick = o.phase === 'arrange' ? 0.3 * Math.sin(Math.PI * clamp(o.t / T.tea.stem, 0, 1)) : 0; p.v = 0;
    p.look += (0 - p.look) * Math.min(1, dt * 3);
    const S = T.tea, next = (phase) => { o.phase = phase; o.t = 0; };
    if (o.phase === 'walk') {
      const dx = OFFER_SPOT.x - p.x, dz = OFFER_SPOT.z - p.z, d = Math.hypot(dx, dz);
      if (d < 0.06 || o.t > 9) { p.x = OFFER_SPOT.x; p.z = OFFER_SPOT.z; next('settle'); }   // (never wander forever: after 9 s she is simply there)
      else {
        // an easy pace, easing off only over the last half step, so she arrives properly (v3.13: she used to creep the last bit
        // for ~3 s, which felt like a long pause before the bow)
        const sp = Math.min(1.1, Math.max(0.5, d * 2));
        p.x += (dx / d) * sp * dt; p.z += (dz / d) * sp * dt; p.step += sp * dt * 1.3;
        this.collide(p, dt, true);
      }
    } else if (o.phase === 'settle' && o.t >= S.settle) {             // the briefest moment, then she bows to the keeper and he bows back
      next('bow'); p.bowT = T.bowSecs; this.keeper.bowT = T.bowSecs;
      if (scoring) this.say('bow');
    } else if (o.phase === 'bow' && o.t >= T.bowSecs + 0.2) {
      if (this.basket > 0) {
        next('arrange'); o.stem = 1; o.stems = Math.min(3, this.basket); o.placed = 0; o.moved = 0; this.handedOver = true;
        if (scoring) this.say('give', { n: this.basket });
      } else next('linger');                                             // nothing to give: the bow was enough
    } else if (o.phase === 'arrange') {
      // ikebana: she places the stems one at a time, tall (shin), middle (soe), low (hikae); her gathered blossom is shared
      // between them, so more gathered = fuller branches
      const share = Math.floor(this.basket / o.stems) + (o.stem <= this.basket % o.stems ? 1 : 0);
      if (o.t >= S.stem * 0.65 && !o.landed) { o.landed = true; o.placed++; this.vase += share; o.moved += share; if (scoring) this.say('stem', { n: o.placed }); }
      if (o.t >= S.stem) {
        o.landed = false;
        if (o.stem < o.stems) { o.stem++; o.t = 0; }
        else { if (scoring) this.addInk(T.inkGift); next('regard'); }
      }
    } else if (o.phase === 'regard' && o.t >= S.regard) {           // a moment of stillness to look at what she has made
      next('linger');
    } else if (o.phase === 'linger' && o.t >= S.linger) {
      this.stats.strolls++;
      this.arrivedT = 0; this.choice = 0;
      if (this.ink >= 100 && !this.endless) {                          // this stroll finished the print: its own screen instead
        this.state = 'complete'; this.completeT = 0; this.strollDone = true; this.say('complete'); this.msg('THE PRINT IS COMPLETE', 6);
      } else { this.state = 'arrived'; this.say('arrived'); }
    }
  }

  /** Mejiro: one, or a pair, flit across every 15-35 s in little bursts of wingbeats with short dipping glides between. */
  stepBirds(dt) {
    const r = this.rand;
    if ((this.flitIn -= dt) <= 0) {
      this.flitIn = 15 + r() * 20;
      const dir = r() < 0.5 ? 1 : -1, y = 70 + r() * 180, speed = 110 + r() * 50, size = 0.8 + r() * 0.4;   // (further off: smaller, slower across)
      const n = r() < 0.35 ? 2 : 1;
      for (let i = 0; i < n; i++) this.birds.push({ x: dir > 0 ? -40 - i * 70 : this.W + 40 + i * 70, y: y + i * (r() - 0.5) * 50, base: y, dir, speed, size: size * (1 - i * 0.1),
        phase: r() * 6, flap: 0, wingT: r() });
      this.say('flit');
    }
    for (const b of this.birds) {
      b.phase += dt;
      // bounding flight: flap for a moment (rising a little), then fold the wings and dip
      const cycle = (b.phase * 1.6) % 1, flapping = cycle < 0.55;
      b.flap = flapping ? Math.sin(b.phase * 55) : -0.9;
      b.y += (flapping ? -22 : 34) * dt + Math.sin(b.phase * 2) * 4 * dt;
      b.y += (b.base - b.y) * Math.min(1, dt * 0.6);           // drifts back toward its line, so it never climbs or falls away
      b.x += b.dir * b.speed * (flapping ? 1.05 : 0.9) * dt;
    }
    this.birds = this.birds.filter((b) => b.x > -150 && b.x < this.W + 150);
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
    if (Math.abs(TABLE.z - p.z) < 2) pushCircle(TABLE.x, TABLE.z, TABLE.r);
    if (SHOW_KAGO && Math.abs(KAGO.z - p.z) < 2) pushBox(KAGO);
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
