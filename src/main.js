import { Sea, widthFor, SENS_DEG, steerToSim } from './sim.js';
import { createArt } from './art.js';
import { input, tilt, setupInput, pollInput, recentreTilt, setSteerMode, requestTiltPermission } from './input.js';
import { sfx, unlock, setMuted, ambience } from './audio.js';
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

const sea = new Sea({ width: widthFor(aspect()), seed: params.has('seed') ? +params.get('seed') : Date.now() });
const saved = load('nami.settings');
if (saved) Object.assign(sea.settings, saved);
sea.onSettings = () => save('nami.settings', sea.settings);
window.__sea = sea;           // for tests

const art = createArt(canvas);
window.__art = art;          // for tests (draw a frame on demand)

// ---- the album (start screen): choose a print. The Great Wave is the only one playable so far ----
const album = { open: true, sel: 0, note: null };
const progress = load('nami.progress') || {};                  // { wave: { best, done } }
const prog = (id) => (progress[id] = progress[id] || { best: 0, done: 0 });
const saveProgress = () => save('nami.progress', progress);
const thumb = document.createElement('canvas');                // a live miniature of the Great Wave for its card
window.__album = album;      // for tests
function openPrint(i) {
  const p = PRINTS[i];
  if (!p) return;
  album.sel = i;
  if (!p.ready) { album.note = { text: p.title + ' IS STILL BEING CARVED', t: 3 }; return; }
  album.open = false; album.note = null;
  if (sea.state === 'title') {                                                                    // a fresh print
    sea.update(STEP, { start: true }); recentreTilt(); keepAwake();
    if (sea.tiltSteer && !tilt.ok) sea.msg('NO TILT SENSOR - SLIDE YOUR FINGER TO STEER', 5);
  }
  else sea.resumeGame();                                                                          // carry on where you left off
}
function stepAlbum(dt, inp) {
  if (album.note && (album.note.t -= dt) <= 0) album.note = null;
  for (const k of inp.keys) {
    if (k === 'left') album.sel = (album.sel + PRINTS.length - 1) % PRINTS.length;
    else if (k === 'right') album.sel = (album.sel + 1) % PRINTS.length;
    else if (k === 'enter') openPrint(album.sel);
  }
  for (const p of inp.taps) { const i = cardAt(p.x, p.y, sea.W); if (i >= 0) openPrint(i); }
}
function drawAlbumScreen(now) {
  // the Great Wave card is the real game picture, drawn full size then shrunk onto the card
  art.draw(sea, { bare: true }, now);
  const tw = 480, th = Math.max(1, Math.round((tw * canvas.height) / Math.max(1, canvas.width)));
  if (thumb.width !== tw || thumb.height !== th) { thumb.width = tw; thumb.height = th; }
  thumb.getContext('2d').drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, tw, th);
  art.paper();
  const inProgress = sea.state !== 'title' && !sea.endless;
  drawAlbum(canvas.getContext('2d'), {
    W: sea.W, thumbs: { wave: thumb }, sel: album.sel, time: now / 1000, note: album.note, touch: input.touch, build: BUILD,
    info: { wave: { ...prog('wave'), inProgress, ink: sea.ink } },
  });
}

setupInput({
  canvas,
  onPause: () => sea.togglePause(),
  onTap: (e) => { const r = canvas.getBoundingClientRect(); taps.push({ x: ((e.clientX - r.left) / r.width) * sea.W, y: ((e.clientY - r.top) / r.height) * PICTURE_H }); },
});
const taps = [];
['pointerdown', 'keydown'].forEach((ev) => addEventListener(ev, unlock, { passive: true }));
document.addEventListener('visibilitychange', () => { if (document.hidden) sea.pauseGame(); });

// ---- fill the screen: the picture is 600 tall and exactly as wide as the screen's shape needs ----
function fit() {
  const w = widthFor(aspect());
  if (w !== sea.W) sea.setWidth(w);
  canvas.style.width = innerWidth + 'px'; canvas.style.height = innerHeight + 'px';
  art.resize(sea.W);
}
function orient() {
  const portrait = innerHeight > innerWidth;
  document.body.classList.toggle('portrait', portrait);
  document.body.classList.toggle('touchdev', !!input.touch);
  if (portrait && input.touch) sea.pauseGame();
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
document.getElementById('pausebtn')?.addEventListener('click', (e) => { e.stopPropagation(); sea.pauseGame(); });
document.getElementById('fs')?.addEventListener('click', (e) => { e.stopPropagation(); const el = document.documentElement; (document.fullscreenElement ? document.exitFullscreen() : el.requestFullscreen && el.requestFullscreen({ navigationUI: 'hide' })).catch?.(() => {}); });
for (const id of ['pausebtn', 'fs']) document.getElementById(id)?.addEventListener('pointerdown', (e) => e.stopPropagation());
let wake = null;
async function keepAwake() { try { if ('wakeLock' in navigator && !wake) { wake = await navigator.wakeLock.request('screen'); wake.addEventListener('release', () => (wake = null)); } } catch {} }

// ---- sound reacts to what happens in the sea ----
function playEvents() {
  for (const e of sea.events.splice(0)) {
    if (e.type === 'ink' || e.type === 'complete') {
      const pr = prog('wave');
      pr.best = Math.max(pr.best, sea.ink);
      if (e.type === 'complete') pr.done++;
      saveProgress();
    }
    if (mute) continue;
    const f = sfx[e.type === 'crest' ? 'crest' : e.type === 'land' ? 'land' : e.type];
    if (f) f(e.type === 'crest' ? e.strength : e.type === 'land' ? e.zen : e.type === 'ink' ? e.level : undefined);
  }
}

// ---- fixed 60 Hz logic, drawn every frame ----
const STEP = 1 / 60;
let last = performance.now(), acc = 0;
function frame(now) {
  acc += Math.min(0.1, (now - last) / 1000); last = now;
  while (acc >= STEP) {
    acc -= STEP;
    setSteerMode(sea.tiltSteer, sea.tiltFlip, SENS_DEG[sea.settings.sens]);
    const inp = pollInput();
    inp.taps = taps.splice(0);
    if (album.open) { stepAlbum(STEP, inp); playEvents(); continue; }
    if (sea.albumRequest) { sea.albumRequest = false; album.open = true; album.sel = 0; continue; }   // the game waits, paused
    if (sea.recentreRequest) { recentreTilt(); sea.recentreRequest = false; }
    const wasTitle = sea.state === 'title';
    inp.steer = steerToSim(inp.steer);                 // the picture is flipped, so right on screen = the other way in the maths
    sea.update(STEP, inp);
    if (wasTitle && sea.state === 'play') { recentreTilt(); if (sea.tiltSteer && !tilt.ok) sea.msg('NO TILT SENSOR - SLIDE YOUR FINGER TO STEER', 5); keepAwake(); }
    playEvents();
  }
  setMuted(!sea.settings.sound);
  let level = 0; for (const w of sea.waves) level = Math.max(level, waveAmp(w) / 200 * (w.t < T_GONE ? 1 : 0));
  ambience(level, sea.calm / 100);
  const b = document.body.classList;
  b.toggle('playing', sea.state !== 'title' && !album.open);
  b.toggle('paused', sea.paused);
  if (album.open) drawAlbumScreen(now);
  else art.draw(sea, { touch: input.touch, tilt: { ok: tilt.ok, steer: tilt.steer, events: tilt.events, secure: tilt.secure } }, now);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !params.has('nosw')) navigator.serviceWorker.register('sw.js').catch(() => {});
