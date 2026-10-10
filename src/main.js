import { Sea, widthFor, SENS_DEG, steerToSim } from './sim.js';
import { Bridge } from './bridge.js';
import { Garden } from './garden.js';
import { Street } from './lamplighter.js';
import { River, heightFor } from './river.js';
import { createArt } from './art.js';
import { createBridgeArt } from './bridgeart.js';
import { createGardenArt } from './gardenart.js';
import { createLampArt } from './lampart.js';
import { createRiverArt } from './riverart.js';
import { input, tilt, setupInput, pollInput, recentreTilt, setSteerMode, requestTiltPermission } from './input.js';
import { sfx, bridgeSfx, gardenSfx, lampSfx, riverSfx, unlock, setMuted, ambience, rain, wind, distantMusic, sleepAudio } from './audio.js';
import { waveAmp, T_GONE, VH as PICTURE_H } from './ocean.js';
import { PRINTS, cardAt, drawAlbum } from './album.js';
import { BUILD } from './version.js';
import { view, RES_STEPS, createAutoRes } from './quality.js';

const canvas = document.getElementById('screen');
const params = new URLSearchParams(location.search);
const load = (key) => { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; } };
const save = (key, v) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch {} };
const mute = params.has('mute');
// the screen's shape; if the phone briefly reports a zero size (rotating, going fullscreen, hidden) assume 16:9 instead of breaking
const aspect = () => { const w = innerWidth, h = innerHeight; return w > 0 && h > 0 ? Math.max(w, h) / Math.min(w, h) : 16 / 9; };
const seed = params.has('seed') ? +params.get('seed') : Date.now();

// ---- the prints (levels): each has its own game rules, painting and saved settings ----
const sea = new Sea({ width: widthFor(aspect()), seed });
const bridge = new Bridge({ width: widthFor(aspect()), seed: seed + 1 });
const garden = new Garden({ width: widthFor(aspect()), seed: seed + 2 });
const street = new Street({ width: widthFor(aspect()), seed: seed + 3 });
const river = new River({ height: heightFor(aspect()), seed: seed + 4 });
const levels = {
  wave: { id: 'wave', sim: sea, art: createArt(canvas), key: 'nami.settings', sfx },
  shower: { id: 'shower', sim: bridge, art: createBridgeArt(canvas), key: 'nami.shower.settings', sfx: bridgeSfx },
  kamata: { id: 'kamata', sim: garden, art: createGardenArt(canvas), key: 'nami.kamata.settings', sfx: gardenSfx },
  lamp: { id: 'lamp', sim: street, art: createLampArt(canvas), key: 'nami.lamp.settings', sfx: lampSfx },
  // print 5 is played with the phone UPRIGHT (a portrait trial, 2026-10-09): the page turns the screen round for it
  river: { id: 'river', sim: river, art: createRiverArt(canvas), key: 'nami.river.settings', sfx: riverSfx, portrait: true },
};
const all = Object.values(levels);
for (const L of all) {
  const s = load(L.key);
  if (s) Object.assign(L.sim.settings, s);
  L.sim.onSettings = () => save(L.key, L.sim.settings);
}
let cur = levels.wave;
window.__sea = sea; window.__bridge = bridge; window.__garden = garden; window.__street = street; window.__river = river;      // for tests
window.__art = levels.wave.art;                     // for tests (draw a frame on demand)

// ---- the album (start screen): choose a print ----
const album = { open: true, sel: 0, note: null };
const progress = load('nami.progress') || {};                  // { wave: { best, done }, shower: {...} }
const prog = (id) => (progress[id] = progress[id] || { best: 0, done: 0 });
const saveProgress = () => save('nami.progress', progress);
const thumbs = {};
let albumTurn = 0;                                             // a live miniature of each print for its card
window.__album = album;      // for tests
window.__open = (i) => openPrint(i);
function openPrint(i) {
  const p = PRINTS[i];
  if (!p) return;
  album.sel = i;
  if (!p.ready || !levels[p.id]) { album.note = { text: p.title + ' IS STILL BEING CARVED', t: 3 }; return; }
  album.open = false; album.note = null;
  cur = levels[p.id];
  const s = cur.sim;
  if (s.state === 'title') {                                                                      // a fresh print
    s.update(STEP, { start: true }); recentreTilt(); keepAwake();
    if (s.tiltSteer && !tilt.ok) s.msg('NO TILT SENSOR - SLIDE YOUR FINGER TO STEER', 5);
  } else s.resumeGame();                                                                          // carry on where you left off
  turnScreen(); orient();
}
function stepAlbum(dt, inp) {
  if (album.note && (album.note.t -= dt) <= 0) album.note = null;
  for (const L of all) if (L.sim.state === 'title') L.sim.update(dt, {});      // the scenes stay alive behind their cards
  for (const k of inp.keys) {
    if (k === 'left') album.sel = (album.sel + PRINTS.length - 1) % PRINTS.length;
    else if (k === 'right') album.sel = (album.sel + 1) % PRINTS.length;
    else if (k === 'enter') openPrint(album.sel);
  }
  for (const p of inp.taps) { const i = cardAt(p.x, p.y, sea.W); if (i >= 0) openPrint(i); }
}
function drawAlbumScreen(now) {
  // each card is the real game picture, drawn full size then shrunk onto the card
  // (one print is repainted per frame, in turn, so the album costs no more than playing a print: v3.22, for modest phones)
  const tw = 480, th = Math.max(1, Math.round((tw * canvas.height) / Math.max(1, canvas.width)));
  albumTurn = (albumTurn + 1) % all.length;
  all.forEach((L, i) => {
    const c0 = thumbs[L.id], [w, h] = L.portrait ? [th, tw] : [tw, th];       // (an upright card = a sideways one turned on end)
    if (c0 && c0.width === w && c0.height === h && i !== albumTurn) return;
    L.art.draw(L.sim, { bare: true }, now);
    const c = thumbs[L.id] || (thumbs[L.id] = document.createElement('canvas'));
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    if (L.portrait) {      // an upright print: the picture cut to the card's shape (on a phone that is nearly all of it)
      const [x, y, pw, ph] = L.art.pictureRect(), sh = Math.min(ph, (pw * h) / w), sw = (sh * w) / h;
      c.getContext('2d').drawImage(canvas, x + (pw - sw) / 2, y + (ph - sh) / 2, sw, sh, 0, 0, w, h);
    } else c.getContext('2d').drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, w, h);
  });
  levels.wave.art.paper();
  const info = {};
  for (const L of all) info[L.id] = { ...prog(L.id), inProgress: L.sim.state !== 'title' && !L.sim.endless, ink: L.sim.ink };
  drawAlbum(canvas.getContext('2d'), { W: sea.W, thumbs, sel: album.sel, time: now / 1000, note: album.note, touch: input.touch, build: BUILD, info });
}

setupInput({
  canvas,
  onPause: () => { if (!album.open) cur.sim.togglePause(); },
  onTap: (e) => {
    if (!album.open && cur.art.toPicture) { const [x, y] = cur.art.toPicture(e.clientX, e.clientY); taps.push({ x, y }); return; }   // (an upright print)
    const r = canvas.getBoundingClientRect(); taps.push({ x: ((e.clientX - r.left) / r.width) * (album.open ? sea.W : cur.sim.W), y: ((e.clientY - r.top) / r.height) * PICTURE_H });
  },
});
const taps = [];
const pictureY = (clientY) => { const r = canvas.getBoundingClientRect(); return ((clientY - r.top) / (r.height || 1)) * PICTURE_H; };
const pictureX = (clientX) => { const r = canvas.getBoundingClientRect(); return ((clientX - r.left) / (r.width || 1)) * cur.sim.W; };
['pointerdown', 'keydown'].forEach((ev) => addEventListener(ev, unlock, { passive: true }));
// screen off / app in the background: pause, and silence the sound completely (v1.5.8); back again: the sound wakes (still paused)
document.addEventListener('visibilitychange', () => { if (document.hidden) { cur.sim.pauseGame(); sleepAudio(true); } else sleepAudio(false); });
addEventListener('pagehide', () => sleepAudio(true));
addEventListener('pageshow', () => { if (!document.hidden) sleepAudio(false); });

// ---- fill the screen: the picture is 600 tall and exactly as wide as the screen's shape needs ----
function fit() {
  const w = widthFor(aspect());
  for (const L of all) if (L.portrait) L.sim.setHeight(heightFor(aspect())); else if (w !== L.sim.W) L.sim.setWidth(w);
  canvas.style.width = innerWidth + 'px'; canvas.style.height = innerHeight + 'px';
  for (const L of all) L.art.resize(w);
}
// Which way up the phone should be: sideways for the album and most prints, upright for a portrait print (the river).
// Held the wrong way, a "turn your phone" card covers the screen: a sideways print pauses, an upright one just waits.
let wrongWay = false;
const wantUpright = () => !album.open && !!cur.portrait;
function orient() {
  const upright = innerHeight > innerWidth, want = wantUpright();
  wrongWay = !!input.touch && upright !== want;
  document.body.classList.toggle('wrongway', wrongWay);
  const say = document.getElementById('rotatemsg');
  if (say) say.innerHTML = want ? 'TURN YOUR PHONE UPRIGHT<br>for this print' : 'TURN YOUR PHONE SIDEWAYS<br>to sail NAMI';
  document.getElementById('rotate')?.classList.toggle('up', want);
  if (wrongWay && !want && !album.open) cur.sim.pauseGame();
  fit();
}
/** Ask the phone to turn the screen round for what is showing (works full screen or installed; if not, the card asks you to). */
function turnScreen() { try { screen.orientation.lock(wantUpright() ? 'portrait' : 'landscape').catch(() => {}); } catch {} }
addEventListener('resize', orient); addEventListener('orientationchange', orient);
setTimeout(orient, 0);

// first tap on a phone: fullscreen + landscape (Chrome only allows it from a tap) + sensor permission (iPhones)
let triedFs = false;
addEventListener('pointerdown', async () => {
  requestTiltPermission();
  if (triedFs || !input.touch) return; triedFs = true;
  try { if (!document.fullscreenElement) await document.documentElement.requestFullscreen({ navigationUI: 'hide' }); } catch {}
  turnScreen();
  orient();
}, { passive: true });
document.getElementById('pausebtn')?.addEventListener('click', (e) => { e.stopPropagation(); cur.sim.pauseGame(); });
document.getElementById('fs')?.addEventListener('click', (e) => { e.stopPropagation(); const el = document.documentElement; (document.fullscreenElement ? document.exitFullscreen() : el.requestFullscreen && el.requestFullscreen({ navigationUI: 'hide' })).catch?.(() => {}); });
for (const id of ['pausebtn', 'fs']) document.getElementById(id)?.addEventListener('pointerdown', (e) => e.stopPropagation());
let wake = null;
async function keepAwake() { try { if ('wakeLock' in navigator && !wake) { wake = await navigator.wakeLock.request('screen'); wake.addEventListener('release', () => (wake = null)); } } catch {} }

// ---- sound reacts to what happens in each print ----
function playEvents(L) {
  for (const e of L.sim.events.splice(0)) {
    if (e.type === 'ink' || e.type === 'complete') {
      const pr = prog(L.id);
      pr.best = Math.max(pr.best, L.sim.ink);
      if (e.type === 'complete') pr.done++;
      saveProgress();
    }
    if (mute || L !== cur || album.open) continue;
    const f = L.sfx[e.type];
    if (!f) continue;
    if (L === levels.wave) f(e.type === 'crest' ? e.strength : e.type === 'land' ? e.zen : e.type === 'ink' ? e.level : undefined);
    else f(e.type === 'chime' || e.type === 'pick' || e.type === 'give' || e.type === 'stem' || e.type === 'light' || e.type === 'unload' ? e.n : e.level);
  }
}

// ---- how sharp to paint (quality.js): the QUALITY row in Plum Blossom's pause menu, AUTO by default, applies to every print ----
const autoRes = createAutoRes(load('nami.autores') ?? 0);
let lastQuality = null;
function applyQuality() {
  const q = garden.settings.quality ?? 0;
  if (q === 0 && lastQuality !== null && lastQuality !== 0) { autoRes.step = 0; autoRes.reset(); save('nami.autores', 0); }   // AUTO chosen again: measure afresh
  lastQuality = q;
  const res = q === 1 ? 1 : q === 2 ? 2 : RES_STEPS[autoRes.step];
  if (res !== view.res) { view.res = res; fit(); }
}
window.__quality = { view, autoRes };      // for tests

// ---- fixed 60 Hz logic, drawn every frame ----
const STEP = 1 / 60;
let last = performance.now(), acc = 0;
function frame(now) {
  const gap = now - last;
  acc += Math.min(0.1, gap / 1000); last = now;
  const playing = !album.open && !cur.sim.paused && cur.sim.state !== 'title' && !document.hidden;
  if ((garden.settings.quality ?? 0) === 0 && autoRes.feed(gap, playing)) save('nami.autores', autoRes.step);
  applyQuality();
  while (acc >= STEP) {
    acc -= STEP;
    const s = cur.sim;
    setSteerMode(s.tiltSteer, s.tiltFlip, SENS_DEG[s.settings.sens]);
    const inp = pollInput();
    inp.taps = taps.splice(0);
    if (album.open) { stepAlbum(STEP, inp); for (const L of all) playEvents(L); continue; }
    if (s.albumRequest) { s.albumRequest = false; album.open = true; turnScreen(); orient(); continue; }   // the print waits, paused
    if (wrongWay) continue;                                                        // held the wrong way round: everything waits
    if (s.recentreRequest) { recentreTilt(); s.recentreRequest = false; }
    if (cur === levels.wave) inp.steer = steerToSim(inp.steer);                    // the picture is flipped, so right on screen = the other way in the maths
    else if (cur === levels.shower) {
      // the bridge: rock the phone, or slide a finger (up the screen = toward the far rail)
      const tiltOn = s.tiltSteer && tilt.ok;
      inp.across = tiltOn ? inp.steer : inp.vert;
      inp.fingerY = !tiltOn && input.held ? pictureY(input.py) : null;
      inp.touchId = input.touches;
    } else if (cur === levels.river) {
      // the river: the finger is a trackpad (slide it across the stream); arrow keys pole too
      const pt = input.held ? cur.art.toPicture(input.px, input.py) : null;
      inp.fingerX = pt ? pt[0] : null; inp.fingerY = pt ? pt[1] : null;
      inp.touchId = input.touches;
    } else if (cur === levels.lamp) {
      // the street: touch (or hold) anywhere and he walks there; arrow keys walk him too
      inp.fingerX = input.held ? pictureX(input.px) : null;
      inp.fingerY = input.held ? pictureY(input.py) : null;
      inp.touchId = input.touches;
    } else {
      // the garden: hold a finger to walk, slide it left/right to step aside (keys: up to walk, left/right to step)
      inp.walk = input.held || inp.vert > 0;
      inp.fingerX = input.held ? pictureX(input.px) : null;
      inp.across = input.held ? 0 : inp.steer;
      inp.touchId = input.touches;
    }
    s.update(STEP, inp);
    playEvents(cur);
  }
  setMuted(!cur.sim.settings.sound);
  distantMusic(!album.open && cur === levels.lamp && !street.paused && street.state !== 'title' ? 1 : 0);   // (only the Lamplighter's evening)
  if (album.open) { ambience(0, 0.5); rain(0); wind(0); }
  else if (cur === levels.wave) {
    let level = 0; for (const w of sea.waves) level = Math.max(level, waveAmp(w) / 200 * (w.t < T_GONE ? 1 : 0));
    ambience(level, sea.calm / 100); rain(0); wind(0);
  } else if (cur === levels.shower) { ambience(0, 0.2); rain(bridge.paused ? 0.3 : bridge.rain); wind(0); }
  else if (cur === levels.lamp) { ambience(0, 0.15, 0.12); rain(0); wind(0.06); }
  else if (cur === levels.river) { ambience(0, 0.6, 0.5); rain(0); wind(0.04); }
  else { ambience(0, 0.3, 0.25); rain(0); wind(garden.paused ? 0.25 : garden.wind); }
  const b = document.body.classList;
  b.toggle('playing', !album.open && cur.sim.state !== 'title');
  b.toggle('paused', cur.sim.paused);
  if (album.open) drawAlbumScreen(now);
  else cur.art.draw(cur.sim, { touch: input.touch, tilt: { ok: tilt.ok, steer: tilt.steer, events: tilt.events, secure: tilt.secure } }, now);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !params.has('nosw')) navigator.serviceWorker.register('sw.js').catch(() => {});
