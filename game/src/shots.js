// Screenshot scenes behind ?shot=cover|onfoot|driving|roadblock.
// Each scene builds a fresh game from seed 1, places Raka in a scripted
// situation, then plays the real rules forward for a fixed number of
// steps with a scripted input, so every frame is what the game really
// looks like and the same seed always gives the same frame.
import { STEP } from './config.js';
import { createGame, stepGame } from './game.js';
import { startMission } from './missions.js';
import { addWanted } from './police.js';
import { makeCar } from './vehicles.js';
import { SCREEN_PLAY } from './render.js';

function scriptedInput(state, keys, mouseX, mouseY, mouseDown) {
  return {
    keys: new Set(keys),
    pressed: new Set(),
    mouseX, mouseY, mouseDown: !!mouseDown,
    scripted: { keys: new Set(keys), pressed: new Set(), mouseX, mouseY, mouseDown: !!mouseDown },
  };
}

function runSteps(state, steps, keys, mouse) {
  for (let i = 0; i < steps; i++) {
    const input = scriptedInput(state, keys, mouse?.x ?? 900, mouse?.y ?? 300, mouse?.down ?? false);
    // Keep the scripted driver's foot down and the mouse aimed ahead.
    stepGame(state, input, STEP);
    if (state.busted) break;
  }
}

function givePlayerCar(state, defKey, x, y, angle) {
  const car = makeCar(defKey, x, y, angle, 'player');
  car.speed = 240;
  state.player.car = car;
  state.player.onFoot = false;
  state.player.x = x; state.player.y = y;
  state.driving = true;
  return car;
}

function stageCover(state) {
  // Mission 5 (escape): Raka flees east through Kota Tua at 4 stars,
  // patrol cars behind, the helicopter overhead, traffic and people all
  // around, the objective on the HUD.
  startMission(state, 4);
  state.player.x = 1800; state.player.y = 1300;
  givePlayerCar(state, 'senjaGT', 1800, 1300, 0);
  addWanted(state, 4, 'Kabur dari PTS!');
  state.message = 'Kabur dari PTS — capai titik aman di timur, dengan bintang 0.';
  state.messageTimer = 30;
  // Let the pursuit spawn, then clear the roadblock out of this frame
  // and ring the patrol cars in close so the chase reads at once.
  runSteps(state, 10, ['w'], { x: 1050, y: 300 });
  state.roadblock = null;
  state.obstacles = state.obstacles.filter((o) => o.tag !== 'roadblock');
  state.suppressRoadblock = true;
  state.message = 'Kabur dari PTS — capai titik aman di timur, dengan bintang 0.';
  state.messageTimer = 30;
  state.police.forEach((car, i) => {
    const a = (i / Math.max(1, state.police.length)) * Math.PI * 2;
    car.x = state.player.x + Math.cos(a) * 380;
    car.y = state.player.y + Math.sin(a) * 380;
    car.speed = 300;
  });
  runSteps(state, 70, ['w'], { x: 1050, y: 300 });
  return state;
}

function stageOnFoot(state) {
  // Mission 4 (warehouse shootout): Raka on foot at the Pelabuhan
  // crossroads with the guards in the open, Bang Dodi walking with him.
  startMission(state, 3);
  state.player.x = 900; state.player.y = 1640;
  state.player.onFoot = true;
  state.player.weaponIndex = 0;
  state.message = 'Kalahkan penjaga gudang, lalu ambil dokumen muatannya.';
  state.messageTimer = 30;
  // Aim up at the guards and fire a short burst; keep the guards alive
  // and visible in the frame, then hide the banner so they are not covered.
  runSteps(state, 40, [], { x: 640, y: 240, down: true });
  state.messageTimer = 0;
  return state;
}

function stageDriving(state) {
  // Mission 3 (delivery): Raka drives the fish package through the
  // dusk city at 1 star, traffic on every road, pedestrians out.
  startMission(state, 2);
  state.player.x = 1500; state.player.y = 1300;
  givePlayerCar(state, 'ombak', 1500, 1300, 0);
  addWanted(state, 1, 'Antar paket ikan ke Bukit Kaca.');
  state.message = 'Antar paket ikan ke warung di Bukit Kaca sebelum gelap.';
  state.messageTimer = 30;
  runSteps(state, 240, ['w'], { x: 1000, y: 300 });
  return state;
}

function stageRoadblock(state) {
  // Wanted 3: Raka drives at a PTS roadblock sealing the road ahead,
  // the helicopter overhead with its searchlight on him, a car ahead
  // waiting to be stolen, patrol cars closing in.
  startMission(state, 1);
  state.clockMin = 19 * 60 + 5; // night: headlights, streetlights, shut stalls
  state.player.x = 1500; state.player.y = 1800;
  givePlayerCar(state, 'camar', 1500, 1800, 0);
  addWanted(state, 3, 'ROADBLOCK PTS DI DEPAN!');
  state.message = 'ROADBLOCK PTS DI DEPAN! Cari jalan lain atau terobos.';
  state.messageTimer = 30;
  // Drive forward only a short way so the roadblock stays in frame.
  runSteps(state, 60, ['w'], { x: 950, y: 300 });
  return state;
}

export function stageShot(name, seed) {
  const state = createGame(seed ?? 1, null);
  state.camera.w = 1280;
  state.camera.h = 720;
  if (name === 'onfoot') stageOnFoot(state);
  else if (name === 'driving') stageDriving(state);
  else if (name === 'roadblock') stageRoadblock(state);
  else stageCover(state);
  return { state, screen: SCREEN_PLAY };
}
