// NAMI's sound, all made live with WebAudio (no files): a breathing sea, plucked koto-like notes in a Japanese scale that
// answer your own rocking, a low swell that builds before a wave breaks, and a soft crash when it lands.
let ac = null, master = null, bed = null, drone = null, rainBed = null, windBed = null, muted = false, lastPluck = 0;

// a Japanese "hirajoshi"-style five-note scale (D E F A Bb), two octaves
const SCALE = [293.66, 329.63, 349.23, 440, 466.16, 587.33, 659.25, 698.46, 880, 932.33];

// the scale carried on up past its two octaves (index 10 = the next D, and so on)
const scaleUp = (i) => SCALE[i % 5] * 2 ** Math.floor(i / 5);

export function setMuted(m) { muted = !!m; if (master) master.gain.value = muted ? 0 : 0.6; }

export function unlock() {
  if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ac = new AC();
  master = ac.createGain(); master.gain.value = muted ? 0 : 0.6; master.connect(ac.destination);

  // the sea: looping noise, filtered low, slowly breathing in and out
  const buf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate), d = buf.getChannelData(0);
  let last = 0; for (let i = 0; i < d.length; i++) { last = last * 0.96 + (Math.random() * 2 - 1) * 0.2; d[i] = last; }
  const src = ac.createBufferSource(); src.buffer = buf; src.loop = true;
  const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520;
  const g = ac.createGain(); g.gain.value = 0.1;
  const lfo = ac.createOscillator(), lfoG = ac.createGain(); lfo.frequency.value = 0.11; lfoG.gain.value = 0.05; lfo.connect(lfoG); lfoG.connect(g.gain); lfo.start();
  src.connect(lp); lp.connect(g); g.connect(master); src.start();
  bed = { g, lp };

  // a very quiet low drone underneath
  const o1 = ac.createOscillator(), o2 = ac.createOscillator(), dg = ac.createGain();
  o1.type = 'sine'; o2.type = 'sine'; o1.frequency.value = 73.42; o2.frequency.value = 110.0; dg.gain.value = 0.018;
  o1.connect(dg); o2.connect(dg); dg.connect(master); o1.start(); o2.start();
  drone = { g: dg };

  // rain (Sudden Shower): bright hiss plus a softer patter body, silent until rain() turns it up
  const rb = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate), rd = rb.getChannelData(0);
  for (let i = 0; i < rd.length; i++) rd[i] = (Math.random() * 2 - 1) * (Math.random() < 0.004 ? 2.5 : 1);   // the odd louder drop
  const rs = ac.createBufferSource(); rs.buffer = rb; rs.loop = true;
  const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 700;
  const rlp = ac.createBiquadFilter(); rlp.type = 'lowpass'; rlp.frequency.value = 5000;
  const rg = ac.createGain(); rg.gain.value = 0;
  rs.connect(hp); hp.connect(rlp); rlp.connect(rg); rg.connect(master); rs.start();
  rainBed = { g: rg, lp: rlp };

  // wind (Kamata): soft, low, breathy noise through a band filter, silent until wind() turns it up
  const ws = ac.createBufferSource(); ws.buffer = buf; ws.loop = true; ws.playbackRate.value = 0.7;
  const wbp = ac.createBiquadFilter(); wbp.type = 'bandpass'; wbp.frequency.value = 420; wbp.Q.value = 0.6;
  const wg = ac.createGain(); wg.gain.value = 0;
  ws.connect(wbp); wbp.connect(wg); wg.connect(master); ws.start();
  windBed = { g: wg, bp: wbp };
}

function pluck(freq, vol = 0.18, delay = 0, len = 1.6) {
  if (!ac) return;
  const t = ac.currentTime + delay;
  const o = ac.createOscillator(), o2 = ac.createOscillator(), g = ac.createGain(), f = ac.createBiquadFilter();
  o.type = 'triangle'; o2.type = 'sine';
  o.frequency.setValueAtTime(freq * 1.012, t); o.frequency.exponentialRampToValueAtTime(freq, t + 0.06);
  o2.frequency.value = freq * 2.003;
  f.type = 'lowpass'; f.frequency.setValueAtTime(freq * 7, t); f.frequency.exponentialRampToValueAtTime(freq * 1.6, t + len * 0.7);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0008, t + len);
  const g2 = ac.createGain(); g2.gain.value = 0.35;
  o.connect(f); o2.connect(g2); g2.connect(f); f.connect(g); g.connect(master);
  o.start(t); o2.start(t); o.stop(t + len + 0.05); o2.stop(t + len + 0.05);
}
function noise(dur, vol, f0, f1, delay = 0) {
  if (!ac) return;
  const t = ac.currentTime + delay, n = Math.floor(ac.sampleRate * dur), buf = ac.createBuffer(1, n, ac.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  const s = ac.createBufferSource(); s.buffer = buf;
  const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.15); g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
  s.connect(f); f.connect(g); g.connect(master); s.start(t);
}
function swell(f0, f1, dur, vol) {
  if (!ac) return;
  const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + dur * 0.8); g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
}

/** Call every frame: how close/big the nearest wave is (0..1), how calm you are (0..1), and how loud the sea bed is (1 = the Great Wave). */
export function ambience(level, calm, bedScale = 1) {
  if (!ac) return;
  const t = ac.currentTime;
  bed.g.gain.setTargetAtTime((0.09 + level * 0.12) * bedScale, t, 0.4);
  bed.lp.frequency.setTargetAtTime(380 + level * 700 + calm * 120, t, 0.4);
  drone.g.gain.setTargetAtTime(0.012 + calm * 0.012, t, 0.8);
}

/** Call every frame: how hard it is raining (0 = no rain sound at all). */
export function rain(level) {
  if (!ac) return;
  const t = ac.currentTime;
  rainBed.g.gain.setTargetAtTime(level * 0.11, t, 0.6);
  rainBed.lp.frequency.setTargetAtTime(2600 + level * 3600, t, 0.6);
}
// a soft knock: a footstep on wet wooden planks
function knock(freq, vol) {
  if (!ac) return;
  const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(freq * 1.4, t); o.frequency.exponentialRampToValueAtTime(freq, t + 0.03);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.12);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.15);
  noise(0.06, vol * 0.4, 1800, 500);
}

// a small bell: a few out-of-tune partials (that is what makes metal sound like metal), ringing out slowly
function bell(freq, vol, delay = 0) {
  if (!ac) return;
  const t = ac.currentTime + delay;
  for (const [ratio, v, len] of [[1, 1, 2.6], [2.76, 0.35, 1.4], [5.4, 0.12, 0.7]]) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = 'sine'; o.frequency.value = freq * ratio;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol * v, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0003, t + len);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + len + 0.05);
  }
}
// a water drip: a quick falling blip
function plip(freq, vol, delay = 0) {
  if (!ac) return;
  const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(freq, t); o.frequency.exponentialRampToValueAtTime(freq * 1.8, t + 0.05);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0003, t + 0.09);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.12);
}

/** Call every frame: how hard the breeze is blowing (0 = no wind sound at all). */
export function wind(level) {
  if (!ac) return;
  const t = ac.currentTime;
  windBed.g.gain.setTargetAtTime(level * 0.16, t, 0.8);
  windBed.bp.frequency.setTargetAtTime(300 + level * 500, t, 0.8);
}
// a hollow wooden chime: a short woody tone with a quick overtone and a soft click
function woodChime(freq, vol, delay = 0) {
  if (!ac) return;
  const t = ac.currentTime + delay;
  for (const [ratio, v, len] of [[1, 1, 0.9], [2.9, 0.3, 0.25]]) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = 'sine'; o.frequency.value = freq * ratio;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol * v, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0003, t + len);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + len + 0.05);
  }
  noise(0.03, vol * 0.3, 2500, 1200, delay);
}
const CHIMES = [392, 440, 523.25, 587.33, 659.25, 784];
// the uguisu (bush warbler), the bird of the plum blossom: a long rising "hoooo", then a quick "ho-ke-kyo"
function whistle(f0, f1, start, len, vol) {
  const t = ac.currentTime + start, o = ac.createOscillator(), g = ac.createGain(), lfo = ac.createOscillator(), lg = ac.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + len);
  lfo.frequency.value = 22; lg.gain.value = f0 * 0.008; lfo.connect(lg); lg.connect(o.frequency);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.15, len * 0.3)); g.gain.setValueAtTime(vol, t + len * 0.8); g.gain.exponentialRampToValueAtTime(0.0003, t + len);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + len + 0.05); lfo.start(t); lfo.stop(t + len + 0.05);
}

/** Kamata's sounds. */
export const gardenSfx = {
  bow() { bell(880, 0.08); bell(1318.5, 0.045, 0.32); },
  chime(n = 3) { let d = 0; for (let i = 0; i < n; i++) { woodChime(CHIMES[Math.floor(Math.random() * CHIMES.length)], 0.045, d); d += 0.18 + Math.random() * 0.35; } },
  bird() {
    if (!ac) return;
    const far = 0.5 + Math.random() * 0.5;
    whistle(1150, 1300, 0, 0.9, 0.035 * far);
    whistle(2350, 2050, 1.05, 0.12, 0.03 * far); whistle(1850, 1800, 1.22, 0.1, 0.03 * far); whistle(2750, 2550, 1.36, 0.22, 0.032 * far);
  },
  arrived() { [0, 2, 4, 6, 8].forEach((i, k) => pluck(SCALE[i], 0.1, k * 0.16, 2.4)); },
  // handing the basket to the tea-house keeper: a soft bell and a gentle rising phrase
  give() { bell(660, 0.05); },
  // each stem set in the vase: one soft note, rising stem by stem (tall, middle, low)
  stem(n = 1) { pluck(SCALE[2 + n * 2], 0.08, 0, 2.4); },
  // little birds flitting past: a few tiny, high, quiet "chii" calls
  flit() { if (!ac) return; const n = 2 + Math.floor(Math.random() * 3); for (let i = 0; i < n; i++) whistle(4200 + Math.random() * 600, 3600 + Math.random() * 400, 0.3 + i * 0.13, 0.07, 0.012); },
  // gathering a sprig: a soft rustle of grass, then one gentle note that climbs a little as the basket fills
  pick(n = 1) { noise(0.35, 0.05, 2600, 900); pluck(SCALE[Math.min(9, 3 + ((n - 1) % 7))], 0.08, 0.2, 2.0); },
  ink(level) { sfx.ink(level); },
  complete() { sfx.complete(); },
  start() { sfx.start(); },
  blip() { sfx.blip(); },
};

// ---- music in the distance (The Lamplighter, Tom v1.4.28): somewhere a few streets away a shamisen plays a lively little tune and
// a drum keeps time now and then; here you only just hear it, muffled by the houses, echoing a little, coming and going on the air:
// mostly very faint, then now and then the air carries it a little nearer and it LINGERS there a while, so you notice it (v1.4.29).
// FAR_MUSIC = how loud it is overall (Tom to judge on the phone).
const FAR_MUSIC = 0.5;
const FAR_LOW = 0.15;                                   // how faint it is most of the time (1 = at its nearest)
const FAR_SWELL = [1.2, 6, 2.5];                        // a swell: seconds rising, lingering near (a phrase plays), fading back
const MIYAKO = [329.63, 349.23, 440, 493.88, 523.25, 659.25, 698.46];   // the miyako-bushi scale (E F A B C), the city's festival sound
let far = null;
function farBus() {
  if (far) return far;
  const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1100; lp.Q.value = 0.3;      // the houses in between
  const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 160;                        // far off: no body
  const dl = ac.createDelay(1), fb = ac.createGain(), wet = ac.createGain();                                  // a little echo off the walls
  dl.delayTime.value = 0.27; fb.gain.value = 0.32; wet.gain.value = 0.45;
  const g = ac.createGain(); g.gain.value = 0;
  const air = ac.createGain(); air.gain.value = FAR_LOW;                                                      // coming and going on the air
  lp.connect(hp); hp.connect(g); hp.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(wet); wet.connect(g); g.connect(air); air.connect(master);
  far = { input: lp, g, air, next: 0, phrase: [], swellAt: ac.currentTime + 4 };
  return far;
}
function farNote(freq, t, vol) {                       // a shamisen-ish pluck: bright and quick to die
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = 'sawtooth'; o.frequency.setValueAtTime(freq * 1.02, t); o.frequency.exponentialRampToValueAtTime(freq, t + 0.03);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.45);
  o.connect(g); g.connect(far.input); o.start(t); o.stop(t + 0.5);
}
function farDrum(t, vol) {                             // a taiko's soft "don" a long way off
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(70, t + 0.25);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.5);
  o.connect(g); g.connect(far.input); o.start(t); o.stop(t + 0.55);
}
/** Call every frame: level 1 while the evening plays, 0 to fade it away (paused, the album, other prints). */
export function distantMusic(level) {
  if (!ac) return;
  const f = farBus(), now = ac.currentTime;
  f.g.gain.setTargetAtTime(level * FAR_MUSIC, now, 0.8);
  if (level <= 0) { f.swellAt = Math.max(f.swellAt, now + 2); f.phrase = []; return; }
  if (now >= f.swellAt) {
    // the air carries it nearer: it rises, LINGERS while one whole phrase plays (Tom v1.4.30: 5-6 s, not 2), then drifts off
    const [up, hold, down] = FAR_SWELL, a = f.air.gain;
    a.cancelScheduledValues(now); a.setValueAtTime(a.value, now);
    a.linearRampToValueAtTime(1, now + up); a.setValueAtTime(1, now + up + hold); a.linearRampToValueAtTime(FAR_LOW, now + up + hold + down);
    f.swellAt = now + up + hold + down + 10 + Math.random() * 12;
    // the phrase: notes stepping round the scale, a few held, a beat of 0.24 s, filling the time it is near
    f.phrase = []; let i = 2 + Math.floor(Math.random() * 3), secs = 0, k = 0;
    while (secs < up + hold - 0.6) {
      const len = Math.random() < 0.2 ? 2 : 1;
      f.phrase.push({ i, len, drum: k++ % 4 === 0 }); secs += 0.24 * len;
      i = Math.max(0, Math.min(MIYAKO.length - 1, i + [-2, -1, -1, 1, 1, 2, 0][Math.floor(Math.random() * 7)]));
    }
    f.phrase[f.phrase.length - 1].len = 3;
    f.next = now + 0.3;
  }
  if (!f.phrase.length || f.next > now + 0.25) return;
  const note = f.phrase.shift(), t = Math.max(f.next, now + 0.02);
  farNote(MIYAKO[note.i], t, 0.05);
  if (note.drum) farDrum(t, 0.09);
  f.next = t + 0.24 * note.len;
}

/** The Lamplighter's sounds. */
export const lampSfx = {
  // a lamp catching: a soft gassy "pop", then a warm bell note that climbs a little with each lamp lit
  // (v1.4.30, Tom: it flattened out after the 8th lamp, the scale ran out; now it carries on up into the next octave to the last)
  light(n = 1) { const f = scaleUp(1 + n); noise(0.25, 0.09, 900, 200); bell(f / 2, 0.06, 0.12); pluck(f, 0.07, 0.16, 2.4); },
  // suzumushi (the bell cricket), somewhere in the dark: a few high silvery trills
  cricket() {
    if (!ac) return;
    const f = 4100 + Math.random() * 500, n = 2 + Math.floor(Math.random() * 3), far = 0.4 + Math.random() * 0.6;
    for (let i = 0; i < n; i++) whistle(f, f * 0.97, i * 0.32, 0.22, 0.007 * far);
  },
  bow() { bell(880, 0.08); bell(1318.5, 0.045, 0.32); },
  arrived() { [0, 2, 4, 6].forEach((i, k) => pluck(SCALE[i], 0.09, k * 0.2, 2.4)); },   // he walks off the edge: the evening is over
  ink() {},                                                                         // (each lamp makes its own sound)
  complete() { sfx.complete(); },
  start() { sfx.start(); },
  blip() { sfx.blip(); },
};

/** Sudden Shower's sounds. */
export const bridgeSfx = {
  step() { knock(130 + Math.random() * 25, 0.05); },
  splash() {                                                                        // a soft slosh, then a couple of little drips
    noise(0.35, 0.17, 1600, 340);                                                   // (Tom: a little louder)
    plip(1300 + Math.random() * 300, 0.055, 0.12); plip(950 + Math.random() * 250, 0.045, 0.26);
  },
  bump() { bell(880, 0.09); bell(1318.5, 0.05, 0.32); },                            // a gentle temple-bell ding as you both bow
  pass() { if (!ac) return; const now = ac.currentTime; if (now - lastPluck < 0.8) return; lastPluck = now; pluck(SCALE[Math.floor(Math.random() * 7)], 0.06, 0, 1.8); },
  crossed() { [0, 2, 4, 6, 8].forEach((i, k) => pluck(SCALE[i], 0.12, k * 0.13, 2.2)); },
  ink(level) { sfx.ink(level); },
  complete() { sfx.complete(); },
  start() { sfx.start(); },
  blip() { sfx.blip(); },
};

export const sfx = {
  crest(strength = 0.5) {
    if (!ac) return; const now = ac.currentTime; if (now - lastPluck < 0.9) return; lastPluck = now;
    pluck(SCALE[Math.floor(Math.random() * 6)], 0.05 + strength * 0.1);
  },
  warn() { swell(55, 90, 2.6, 0.12); noise(2.4, 0.06, 200, 900); },
  land(zen) { noise(2.4, zen ? 0.04 : 0.07, 2600, 900); },           // the crest at its peak: a soft fizz of froth (nothing crashes)
  eased() { pluck(SCALE[3], 0.14); pluck(SCALE[5], 0.12, 0.18); },
  ridden() { [0, 2, 4, 6, 8].forEach((i, k) => pluck(SCALE[i], 0.13, k * 0.11, 2.2)); },
  foam() { noise(1.4, 0.07, 1600, 400); pluck(SCALE[2], 0.07, 0.15, 2.0); },   // a soft fizz and one gentle note
  hit() { pluck(146.83, 0.12, 0, 2.4); swell(110, 70, 2.2, 0.06); },          // a low, soft note: no crack
  ink(level) { pluck(SCALE[Math.min(9, 2 + Math.floor(level / 1.4))], 0.1, 0, 2.0); },
  complete() { [0, 3, 5, 7, 5, 8, 9].forEach((i, k) => pluck(SCALE[i], 0.14, k * 0.28, 2.6)); },
  drift() { swell(120, 60, 2, 0.1); },
  start() { pluck(SCALE[0], 0.12); pluck(SCALE[3], 0.1, 0.25); },
  blip() { pluck(SCALE[5], 0.08, 0, 0.5); },
};
