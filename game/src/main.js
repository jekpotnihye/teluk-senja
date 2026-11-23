// Boot and the one loop for TELUK SENJA: input is read every frame,
// the game advances in fixed 1/60 s steps, and the renderer paints
// what is there. Screens: title, play, paused, busted.
// ?seed=N fixes the city. ?shot=cover|onfoot|driving|roadblock (with
// &seed=N) stages that scene instead of running the loop, paints it
// twice and sets window.__shotReady for a screenshot.
import { STEP, SAVE_KEY } from './config.js';
import { loadSave } from './util.js';
import { createGame, stepGame, respawnPlayer } from './game.js';
import { startMission } from './missions.js';
import { createInput, wasPressed, clearPressed } from './input.js';
import { createRenderer, SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSED, SCREEN_BUSTED } from './render.js';
import { initAudio, playClick } from './audio.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const renderer = createRenderer(canvas);

function runShot(name) {
  const { state, screen } = stageShot(name, seed);
  state.camera.w = 1280;
  state.camera.h = 720;
  let painted = 0;
  function paint() {
    renderer.draw(state, screen, null);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  const saved = loadSave(SAVE_KEY);
  let state = createGame(seed, null);
  let screen = SCREEN_TITLE;
  let accumulator = 0;
  let last = performance.now();

  function announce(message) { status.textContent = message; }

  function beginGame(continueSaved) {
    state = createGame(seed, continueSaved ? saved : null);
    if (!continueSaved || !saved || typeof saved.missionIndex !== 'number' || saved.missionIndex < 0) {
      startMission(state, 0);
    }
    state.radioOn = false;
    screen = SCREEN_PLAY;
    announce('Bermain Teluk Senja.');
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;

    if (screen === SCREEN_TITLE) {
      if (wasPressed(input, 'Enter')) { initAudio(); playClick(); beginGame(!!saved); }
      else if (wasPressed(input, 'n')) { initAudio(); playClick(); beginGame(false); }
      clearPressed(input);
      renderer.draw(state, screen, saved);
      return;
    }

    if (screen === SCREEN_PAUSED) {
      if (wasPressed(input, 'p') || wasPressed(input, 'Escape') || wasPressed(input, 'Enter')) {
        screen = SCREEN_PLAY;
        announce('Lanjut.');
      }
      clearPressed(input);
      renderer.draw(state, screen, saved);
      return;
    }

    if (screen === SCREEN_BUSTED) {
      if (wasPressed(input, 'Enter')) {
        respawnPlayer(state);
        screen = SCREEN_PLAY;
        announce('Kembali ke jalan.');
      }
      clearPressed(input);
      renderer.draw(state, screen, saved);
      return;
    }

    // Play: first gesture unlocks audio, P pauses, Enter on busted handled above.
    if (input.mouseDown || input.keys.size > 0) initAudio();
    if (wasPressed(input, 'p') || wasPressed(input, 'Escape')) {
      screen = SCREEN_PAUSED;
      announce('Jeda.');
      clearPressed(input);
      renderer.draw(state, screen, saved);
      return;
    }
    while (accumulator >= STEP) {
      stepGame(state, input, STEP);
      accumulator -= STEP;
      if (state.busted) {
        screen = SCREEN_BUSTED;
        break;
      }
    }
    clearPressed(input);
    renderer.draw(state, screen, saved);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Jeda.');
    }
  });

  announce('Teluk Senja. Tekan Enter untuk mulai.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
