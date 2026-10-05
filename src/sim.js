// NAMI: the rules. A boat on a rocking sea; every so often a big wave builds, curls and breaks in front of you.
// You rock the phone to move the boat. Get out of the way (or ride over the top) and the print fills with ink.
// Pure logic: no drawing, no sound, no DOM. tools/selftest.mjs plays it with a bot.
import { BASE_Y, VH, clamp, surface, surfaceSlope, waveX, waveZone, waveAmp, T_LAND, T_GONE, T_BREAK_END, WAVE_SPEED, ZONE_FRONT, ZONE_BACK } from './ocean.js';

// The sea rolls right-to-left in the maths. The picture is drawn flipped so on screen the big wave comes from the LEFT, like the print.
export const SCREEN_MIRRORED = true;
export const steerToSim = (screenSteer) => (SCREEN_MIRRORED ? -screenSteer : screenSteer);

export const MIN_W = 800;
export const MAX_W = 1400;
export const widthFor = (aspect) => Math.round(clamp(VH * aspect, MIN_W, MAX_W));

// ---- how the boat feels (all the numbers in one place) ----
export const TUNE = {
  thrust: 270,         // sideways push at full tilt (units/s^2)
  slopePull: 235,      // how hard a slope pulls the boat downhill (climbing a wave face needs a run-up)
  drag: 0.95,          // water drag (per second)
  tide: 0.9,          // a gentle current that drifts the boat back toward the middle (so there is no safe corner)
  home: 0.45,          // where the tide wants the boat (fraction of the picture width)
  maxSpeed: 190,
  margin: 70,          // how close to the screen edge the boat can get
  inkEased: 6,         // ink for getting out of the way
  inkRidden: 12,       // ink for riding over the crest (the brave way)
  inkFoam: 3,          // ink for being on the face of the swell as it peaks (harmless, just a little less)
  inkZenPerSec: 0.55,  // zen mode: ink just flows while you sail
  hitCalm: 32,         // calm lost to a hit
  calmRegen: 1.8,      // calm regained per second
  waveGap: 2.6,        // seconds of quiet between one wave breaking and the next one starting
};

export const PAUSE_ROWS = ['resume', 'album', 'steer', 'sens', 'zen', 'sound', 'recentre', 'restart'];
export const PAUSE_Y0 = 150;
export const PAUSE_DY = 44;
export const SENS_OPTS = ['LOW', 'NORMAL', 'HIGH'];
export const SENS_DEG = [34, 24, 16];                 // degrees of tilt for full steering
export const STEER_OPTS = ['TILT PHONE', 'TILT (FLIPPED)', 'SLIDE'];

function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export class Sea {
  constructor({ width = 1300, seed = Date.now(), sfx = null } = {}) {
    this.W = clamp(Math.round(width), MIN_W, MAX_W);
    this.rand = mulberry32(seed);
    this.sfx = sfx || {};
    this.settings = { steer: 0, sens: 1, zen: false, sound: true };    // saved by the page
    this.onSettings = null;
    this.paused = false; this.pauseRow = 0; this.restartArmed = false;
    this.recentreRequest = false;
    this.albumRequest = false;     // the page shows the album (the game stays paused underneath, so you can carry on later)
    this.state = 'title';
    this.reset();
  }

  setWidth(w) { if (!Number.isFinite(w)) return; this.W = clamp(Math.round(w), MIN_W, MAX_W); this.boat.x = clamp(this.boat.x, TUNE.margin, this.W - TUNE.margin); }
  get zen() { return this.settings.zen || this.endless; }
  get tiltSteer() { return this.settings.steer < 2; }
  get tiltFlip() { return this.settings.steer === 1; }
  changed() { if (this.onSettings) this.onSettings(this.settings); }

  reset() {
    this.t = 0; this.tick = 0;
    this.boat = { x: this.W * 0.42, vx: 0, h: 0, y: BASE_Y, ang: 0, invuln: 0, toss: 0, calmHold: 0, prevDh: 0 };
    this.waves = [];
    this.ink = 0; this.inkShown = 0;
    this.calm = 100;
    this.steer = 0;
    this.nextWaveIn = 3.5; this.waveId = 0;
    this.events = [];
    this.stats = { hits: 0, foam: 0, ridden: 0, eased: 0, waves: 0 };
    this.endless = false;          // after completing the print you can keep sailing
    this.completeT = 0;
    this.message = null;
  }

  say(type, data = {}) { this.events.push({ type, ...data }); }
  msg(text, secs = 3.5) { this.message = { text, t: secs, total: secs }; }

  // ---------- pause + settings ----------
  pauseGame() { if (this.state === 'play' && !this.paused) { this.paused = true; this.pauseRow = 0; this.restartArmed = false; this.say('blip'); } }
  resumeGame() { this.paused = false; this.restartArmed = false; this.say('blip'); }
  togglePause() { if (this.paused) this.resumeGame(); else this.pauseGame(); }
  pauseKey(k) {
    if (k === 'up') this.pauseRow = (this.pauseRow + PAUSE_ROWS.length - 1) % PAUSE_ROWS.length;
    else if (k === 'down') this.pauseRow = (this.pauseRow + 1) % PAUSE_ROWS.length;
    else if (k === 'left') this.pauseChange(-1);
    else if (k === 'right') this.pauseChange(1);
    else if (k === 'enter') this.pauseChange(1, true);
    if (PAUSE_ROWS[this.pauseRow] !== 'restart') this.restartArmed = false;
    this.say('blip');
  }
  pauseChange(d, fromEnter = false) {
    const row = PAUSE_ROWS[this.pauseRow], s = this.settings;
    if (row === 'resume') this.resumeGame();
    else if (row === 'album') { this.albumRequest = true; return; }
    else if (row === 'steer') s.steer = (s.steer + d + STEER_OPTS.length) % STEER_OPTS.length;
    else if (row === 'sens') s.sens = (s.sens + d + SENS_OPTS.length) % SENS_OPTS.length;
    else if (row === 'zen') s.zen = !s.zen;
    else if (row === 'sound') s.sound = !s.sound;
    else if (row === 'recentre') { this.recentreRequest = true; this.msg('STRAIGHT AHEAD SET', 2); }
    else if (row === 'restart') {
      if (this.restartArmed) { const keep = this.settings, w = this.W; this.reset(); this.W = w; this.settings = keep; this.paused = false; this.state = 'play'; this.say('start'); return; }
      this.restartArmed = true; return;
    }
    this.changed();
  }
  pauseTap(x, y) {
    const idx = Math.floor((y - (PAUSE_Y0 - PAUSE_DY / 2)) / PAUSE_DY);
    if (idx < 0 || idx >= PAUSE_ROWS.length) return;
    if (PAUSE_ROWS[idx] !== 'restart') this.restartArmed = false;
    this.pauseRow = idx;
    const row = PAUSE_ROWS[idx];
    const action = row === 'resume' || row === 'album' || row === 'recentre' || row === 'restart' || row === 'zen' || row === 'sound';
    this.pauseChange(action ? 1 : (x < this.W / 2 ? -1 : 1), true);
    this.say('blip');
  }

  // ---------- one step ----------
  /** inp: { steer -1..1, keys: [menu keys], taps: [{x,y} in picture units], start: bool } */
  update(dt, inp = {}) {
    this.tick++;
    const keys = inp.keys || [], taps = inp.taps || [];
    if (this.paused) { for (const k of keys) this.pauseKey(k); for (const p of taps) this.pauseTap(p.x, p.y); return; }
    if (this.state === 'title') { if (keys.length || taps.length || inp.start) { this.reset(); this.state = 'play'; this.say('start'); this.msg('LEAN THE PHONE TO MOVE THE BOAT', 5); } return; }
    if (this.state === 'complete') {
      this.completeT += dt;
      this.stepWorld(dt, inp.steer || 0, false);
      if (this.completeT > 4 && (keys.length || taps.length || inp.start)) { this.state = 'play'; this.endless = true; this.msg('THE SEA IS YOURS. SAIL ON.', 5); }
      return;
    }
    this.stepWorld(dt, inp.steer || 0, true);
  }

  stepWorld(dt, steerIn, scoring) {
    const b = this.boat, T = TUNE;
    this.t += dt;
    if (this.message && (this.message.t -= dt) <= 0) this.message = null;

    // ---- the boat ----
    this.steer += (clamp(steerIn, -1, 1) - this.steer) * Math.min(1, dt * 9);
    const slope = surfaceSlope(this.waves, b.x, this.t);
    let drag = T.drag;
    const ax = T.thrust * this.steer - T.slopePull * slope - drag * b.vx + T.tide * (this.W * T.home - b.x);
    b.vx = clamp(b.vx + ax * dt, -T.maxSpeed, T.maxSpeed);
    b.x += b.vx * dt;
    if (b.x < T.margin) { b.x = T.margin; if (b.vx < 0) b.vx *= -0.2; }
    if (b.x > this.W - T.margin) { b.x = this.W - T.margin; if (b.vx > 0) b.vx *= -0.2; }
    const h = surface(this.waves, b.x, this.t);
    const dh = h - b.h;
    // a crest passing under the boat plays a note (the music is your own rocking)
    if (b.prevDh > 0 && dh <= 0 && h > 3) this.say('crest', { strength: clamp(h / 30, 0.2, 1) });
    b.prevDh = dh;
    b.h = h; b.y = BASE_Y - h;
    b.ang += (-Math.atan(slope) - b.ang) * Math.min(1, dt * 6);
    if (b.invuln > 0) b.invuln -= dt;
    if (b.toss > 0) b.toss = Math.max(0, b.toss - dt);
    b.calmHold = Math.max(0, b.calmHold - dt);

    // ---- big waves ----
    for (const w of this.waves) {
      const before = w.t;
      w.t += dt;
      if (before < T_LAND && w.t >= T_LAND) this.land(w, scoring);
      if (before < 3.2 && w.t >= 3.2 && !w.zenWave) { this.say('warn', { x: waveX(w) }); }
    }
    this.waves = this.waves.filter((w) => w.t < T_GONE);

    this.nextWaveIn -= dt;
    if (this.state === 'play' || this.state === 'complete') {
      const busy = this.waves.some((w) => w.t < T_BREAK_END);
      if (this.nextWaveIn <= 0 && !busy && (this.state === 'play')) this.spawnWave();
    }

    // ---- calm + ink ----
    if (scoring) {
      if (b.calmHold <= 0) this.calm = Math.min(100, this.calm + T.calmRegen * dt);
      if (this.zen && !this.endlessDone) this.addInk(T.inkZenPerSec * dt);
    }
    this.inkShown += (this.ink - this.inkShown) * Math.min(1, dt * 1.6);
  }

  spawnWave() {
    const b = this.boat, T = TUNE, zen = this.zen;
    const id = ++this.waveId;
    this.stats.waves++;
    // aim the landing zone at where the boat would drift to if you did nothing, so there is always something to do
    const jitter = (this.rand() - 0.5) * 220;
    const H = zen ? 55 + this.rand() * 35 : 150 + this.rand() * 55;
    const w = { id, xs: 0, t: 0, H, zen, zone: [0, 0], landed: false, outcome: null };
    let aim = b.x;
    for (let pass = 0; pass < 3; pass++) {
      const mid = clamp(aim + jitter, 260, this.W - 260);
      w.xs = mid + (ZONE_FRONT - ZONE_BACK) / 2 + ZONE_BACK + WAVE_SPEED * T_LAND;
      aim = this.predictIdle(w);
    }
    w.zone = waveZone(w);
    this.waves.push(w);
    this.say('spawn', { id, zen });
  }

  /** Where would the boat be when this wave lands if nobody touched the controls? (a quick private rehearsal) */
  predictIdle(cand) {
    const T = TUNE, dt = 1 / 20;
    const others = this.waves.map((q) => ({ ...q }));
    const c = { ...cand, t: 0 };
    let x = this.boat.x, vx = this.boat.vx, t = this.t;
    for (let i = 0; i < T_LAND * 20; i++) {
      const ws = [...others, c];
      const ax = -T.slopePull * surfaceSlope(ws, x, t) - T.drag * vx + T.tide * (this.W * T.home - x);
      vx = clamp(vx + ax * dt, -T.maxSpeed, T.maxSpeed); x = clamp(x + vx * dt, T.margin, this.W - T.margin);
      t += dt; for (const q of ws) q.t += dt;
    }
    return x;
  }

  land(w, scoring) {
    w.landed = true;
    const b = this.boat, [zl, zr] = w.zone;
    this.nextWaveIn = TUNE.waveGap + (T_BREAK_END - T_LAND);
    this.say('land', { x: (zl + zr) / 2, zen: w.zen });
    if (w.zen) { w.outcome = 'passed'; if (scoring) this.say('passed'); return; }
    if (b.x >= zl && b.x <= zr) {
      // on the face of the swell when it peaks: harmless (Tom's choice; the wave never breaks), just a little less ink
      w.outcome = 'foam'; this.stats.foam++;
      if (scoring) { this.addInk(TUNE.inkFoam); this.say('foam'); this.msg('INTO THE SWELL', 2.5); }
    } else if (b.x > zr) {
      w.outcome = 'ridden'; this.stats.ridden++;
      if (scoring) { this.addInk(TUNE.inkRidden); this.say('ridden'); this.msg('YOU RODE THE WAVE', 3); }
    } else {
      w.outcome = 'eased'; this.stats.eased++;
      if (scoring) { this.addInk(TUNE.inkEased); this.say('eased'); this.msg('LET IT PASS', 2.5); }
    }
  }

  /** The old rule (unused since Tom chose harmless foam): being caught cost calm. Kept for a possible 'challenge' mode. */
  hit() {
    const b = this.boat;
    this.stats.hits++;
    this.calm = Math.max(0, this.calm - TUNE.hitCalm);
    b.invuln = 2.6; b.toss = 2.4; b.calmHold = 3.5;
    b.vx *= 0.5;                       // the wave just slows you: no sideways jolt
    this.say('hit');
    if (this.calm <= 0) {
      // the sea carries you gently back: you lose a little ink, never the game
      this.ink = Math.max(0, this.ink - 8);
      this.calm = 55; b.x = this.W * 0.42; b.vx = 0;
      this.say('drift'); this.msg('THE SEA CARRIES YOU BACK', 4);
    } else this.msg('BREATHE', 2.5);
  }

  addInk(v) {
    if (this.endless) return;
    const before = this.ink;
    this.ink = Math.min(100, this.ink + v);
    if (Math.floor(this.ink / 10) > Math.floor(before / 10)) this.say('ink', { level: Math.floor(this.ink / 10) });
    if (this.ink >= 100 && this.state === 'play') { this.state = 'complete'; this.completeT = 0; this.say('complete'); this.msg('THE PRINT IS COMPLETE', 6); }
  }
}
