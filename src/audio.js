// NAMI's sound, all made live with WebAudio (no files): a breathing sea, plucked koto-like notes in a Japanese scale that
// answer your own rocking, a low swell that builds before a wave breaks, and a soft crash when it lands.
let ac = null, master = null, bed = null, drone = null, muted = false, lastPluck = 0;

// a Japanese "hirajoshi"-style five-note scale (D E F A Bb), two octaves
const SCALE = [293.66, 329.63, 349.23, 440, 466.16, 587.33, 659.25, 698.46, 880, 932.33];

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

/** Call every frame: how close/big the nearest wave is (0..1) and how calm you are (0..1). */
export function ambience(level, calm) {
  if (!ac) return;
  const t = ac.currentTime;
  bed.g.gain.setTargetAtTime(0.09 + level * 0.12, t, 0.4);
  bed.lp.frequency.setTargetAtTime(380 + level * 700 + calm * 120, t, 0.4);
  drone.g.gain.setTargetAtTime(0.012 + calm * 0.012, t, 0.8);
}

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
