import { Sea, widthFor, SENS_DEG, steerToSim } from './sim.js';
import { Bridge } from './bridge.js';
import { Garden } from './garden.js';
import { createArt } from './art.js';
import { createBridgeArt } from './bridgeart.js';
import { createGardenArt } from './gardenart.js';
import { input, tilt, setupInput, pollInput, recentreTilt, setSteerMode, requestTiltPermission } from './input.js';
import { sfx, bridgeSfx, gardenSfx, unlock, setMuted, ambience, rain, wind } from './audio.js';
import { waveAmp, T_GONE, VH as PICTURE_H } from './ocean.js';
import { PRINTS, cardAt, drawAlbum } from './album.js';
import { BUILD } from './version.js';

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
const levels = {
  wave: { id: 'wave', sim: sea, art: createArt(canvas), key: 'nami.settings', sfx },
  shower: { id: 'shower', sim: bridge, art: createBridgeArt(canvas), key: 'nami.shower.settings', sfx: bridgeSfx },
  kamata: { id: 'kamata', sim: garden, art: createGardenArt(canvas), key: 'nami.kamata.settings', sfx: gardenSfx },
};
const all = Object.values(levels);
for (const L of all) {
  const s = load(L.key);
  if (s) Object.assign(L.sim.settings, s);
  L.sim.onSettings = () => save(L.key, L.sim.settings);
}
let cur = levels.wave;
window.__sea = sea; window.__bridge = bridge; window.__garden = garden;      // for tests
window.__art = levels.wave.art;                     // for tests (draw a frame on demand)

// ---- the album (start screen): choose a print ----
const album = { open: true, sel: 0, note: null };
const progress = load('nami.progress') || {};                  // { wave: { best, done }, shower: {...} }
const prog = (id) => (progress[id] = progress[id] || { best: 0, done: 0 });
const saveProgress = () => save('nami.progress', progress);
const thumbs = {};                                             // a live miniature of each print for its card
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
}
function stepAlbum(dt, inp) {
  if (album.note && (album.note.t -= dt) <= 0) album.note = null;
  for (const L of all) if (L.sim.state === 'title') L.sim.update(dt, {});      // the scenes stay alive behind their cards
  for (const k of inp.keys) {
    if (k === 'left') album.sel = (album.sel + PRINTS.length - 1) % PRINTS.length;
    else if (k === 'right') album.sel = (album.sel + 1) % PRINTS.length;
    else if (k === 'enter') openPrint(album.sel);
  }
  for (const p of inp.taps) { const i = cardAt(p.x, p.y, cur.sim.W); if (i >= 0) openPrint(i); }
}
function drawAlbumScreen(now) {
  // each card is the real game picture, drawn full size then shrunk onto the card
  const tw = 480, th = Math.max(1, Math.round((tw * canvas.height) / Math.max(1, canvas.width)));
  for (const L of all) {
    L.art.draw(L.sim, { bare: true }, now);
    const c = thumbs[L.id] || (thumbs[L.id] = document.createElement('canvas'));
    if (c.width !== tw || c.height !== th) { c.width = tw; c.height = th; }
    c.getContext('2d').drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, tw, th);
  }
  levels.wave.art.paper();
  const info = {};
  for (const L of all) info[L.id] = { ...prog(L.id), inProgress: L.sim.state !== 'title' && !L.sim.endless, ink: L.sim.ink };
  drawAlbum(canvas.getContext('2d'), { W: cur.sim.W, thumbs, sel: album.sel, time: now / 1000, note: album.note, touch: input.touch, build: BUILD, info });
}

setupInput({
  canvas,
  onPause: () => { if (!album.open) cur.sim.togglePause(); },
  onTap: (e) => { const r = canvas.getBoundingClientRect(); taps.push({ x: ((e.clientX - r.left) / r.width) * cur.sim.W, y: ((e.clientY - r.top) / r.height) * PICTURE_H }); },
});
const taps = [];
const pictureY = (clientY) => { const r = canvas.getBoundingClientRect(); return ((clientY - r.top) / (r.height || 1)) * PICTURE_H; };
const pictureX = (clientX) => { const r = canvas.getBoundingClientRect(); return ((clientX - r.left) / (r.width || 1)) * cur.sim.W; };
['pointerdown', 'keydown'].forEach((ev) => addEventListener(ev, unlock, { passive: true }));
document.addEventListener('visibilitychange', () => { if (document.hidden) cur.sim.pauseGame(); });

// ---- fill the screen: the picture is 600 tall and exactly as wide as the screen's shape needs ----
function fit() {
  const w = widthFor(aspect());
  for (const L of all) if (w !== L.sim.W) L.sim.setWidth(w);
  canvas.style.width = innerWidth + 'px'; canvas.style.height = innerHeight + 'px';
  for (const L of all) L.art.resize(w);
}
function orient() {
  const portrait = innerHeight > innerWidth;
  document.body.classList.toggle('portrait', portrait);
  document.body.classList.toggle('touchdev', !!input.touch);
  if (portrait && input.touch) cur.sim.pauseGame();
  fit();
}
addEventListener('resize', orient); addEventListener('orientationchange', orient);
setTimeout(orient, 0);

// first tap on a phone: fullscreen + landscape (Chrome only allows it from a tap) + sensor permission (iPhones)
let triedFs = false;
addEventListener('pointerdown', async () => {
  requestTiltPermission();
  if (triedFs || !input.touch) return; triedFs = true;
  try { if (!document.fullscreenElement) await document.documentElement.requestFullscreen({ navigationUI: 'hide' }); } catch {}
  try { await screen.orientation.lock('landscape'); } catch {}
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
    else f(e.type === 'chime' ? e.n : e.level);
  }
}

// ---- fixed 60 Hz logic, drawn every frame ----
const STEP = 1 / 60;
let last = performance.now(), acc = 0;
function frame(now) {
  acc += Math.min(0.1, (now - last) / 1000); last = now;
  while (acc >= STEP) {
    acc -= STEP;
    const s = cur.sim;
    setSteerMode(s.tiltSteer, s.tiltFlip, SENS_DEG[s.settings.sens]);
    const inp = pollInput();
    inp.taps = taps.splice(0);
    if (album.open) { stepAlbum(STEP, inp); for (const L of all) playEvents(L); continue; }
    if (s.albumRequest) { s.albumRequest = false; album.open = true; continue; }   // the print waits, paused
    if (s.recentreRequest) { recentreTilt(); s.recentreRequest = false; }
    if (cur === levels.wave) inp.steer = steerToSim(inp.steer);                    // the picture is flipped, so right on screen = the other way in the maths
    else if (cur === levels.shower) {
      // the bridge: rock the phone, or slide a finger (up the screen = toward the far rail)
      const tiltOn = s.tiltSteer && tilt.ok;
      inp.across = tiltOn ? inp.steer : inp.vert;
      inp.fingerY = !tiltOn && input.held ? pictureY(input.py) : null;
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
  if (album.open) { ambience(0, 0.5); rain(0); wind(0); }
  else if (cur === levels.wave) {
    let level = 0; for (const w of sea.waves) level = Math.max(level, waveAmp(w) / 200 * (w.t < T_GONE ? 1 : 0));
    ambience(level, sea.calm / 100); rain(0); wind(0);
  } else if (cur === levels.shower) { ambience(0, 0.2); rain(bridge.paused ? 0.3 : bridge.rain); wind(0); }
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
