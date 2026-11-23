// Game orchestration: build the full state, advance one fixed step,
// keep the camera on the player, handle saves, the garage, pickups
// and being busted. No drawing lives here.
import { WORLD_W, WORLD_H, STEP, SAVE_KEY, districtAt } from './config.js';
import { createRng, clamp, dist, loadSave, storeSave } from './util.js';
import { createCity, onRoad } from './world.js';
import { spawnTraffic, spawnParked, makeCar } from './vehicles.js';
import { spawnPedestrians, updatePedestrians } from './pedestrians.js';
import { updatePolice, clearHeat } from './police.js';
import { startMission, updateMissions, MISSIONS } from './missions.js';
import { makePlayer, updatePlayer, updateBullets } from './player.js';
import { updateTraffic } from './vehicles.js';
import { setSiren, setEngine, playPickup, playBusted, startRadio } from './audio.js';
import { wasPressed, keyDown } from './input.js';

export const GARAGE = { x: 2960, y: 2540, w: 190, h: 130 };

export function createGame(seed, saved) {
  const rng = createRng(seed);
  const city = createCity(seed);
  const state = {
    seed, rng, city,
    traffic: spawnTraffic(rng, city, 30),
    parked: spawnParked(rng, 44),
    peds: spawnPedestrians(rng, 110),
    player: makePlayer(2100, 1470),
    bullets: [], sparks: [], police: [],
    helicopter: null, roadblock: null, obstacles: [],
    pickups: [],
    wanted: 0, cleanTimer: 0, decayTimer: 0, crimeTimer: 0,
    camera: { x: 0, y: 0, w: 1280, h: 720 },
    clockMin: 17 * 60 + 50,
    radioStation: 0, radioOn: false,
    crewCooldowns: { sinta: 0, dodi: 0 },
    message: '', messageTimer: 0,
    muzzle: 0, engineFrac: 0, driving: false, shake: 0, smokeTimer: 0,
    busted: false, bustedShown: false,
    mission: null, missionIndex: -1, missionStep: 0, missionDone: false,
    completedMissions: 0, guardsDefeated: 0, stepTimer: 0,
    missionCar: null, missionCarObj: null,
    elapsed: 0, saveTimer: 0,
    time: 0,
  };
  // Health and armour pickups scattered through the city, off the roads.
  const prng = createRng(seed + 77);
  for (let i = 0; i < 12; i++) {
    let px = 0; let py = 0;
    for (let tries = 0; tries < 20; tries++) {
      px = 120 + prng() * (WORLD_W - 240);
      py = 120 + prng() * (WORLD_H - 240);
      if (!onRoad(px, py)) break;
    }
    state.pickups.push({
      x: px, y: py,
      kind: i % 2 === 0 ? 'health' : 'armor', taken: false,
    });
  }
  state.save = () => {
    storeSave(SAVE_KEY, {
      cash: state.player.cash, respect: state.player.respect,
      missionIndex: state.missionIndex, completedMissions: state.completedMissions,
      weaponIndex: state.player.weaponIndex,
    });
  };
  state.loadSaved = () => loadSave(SAVE_KEY);
  if (saved) {
    state.player.cash = saved.cash ?? state.player.cash;
    state.player.respect = saved.respect ?? state.player.respect;
    state.completedMissions = saved.completedMissions ?? 0;
    state.player.weaponIndex = saved.weaponIndex ?? 0;
    if (typeof saved.missionIndex === 'number' && saved.missionIndex >= 0 && saved.missionIndex < MISSIONS.length && state.completedMissions < MISSIONS.length) {
      startMission(state, saved.missionIndex);
    }
  }
  // Crew at home: Sinta and Bang Dodi wait at the garage yard, and one
  // of them walks with Raka on foot while a mission is running.
  state.crewNpcs = [
    { id: 'sinta', name: 'SINTA', role: 'Sopir kabur', x: 3090, y: 2590, color: '#ff9ad5' },
    { id: 'dodi', name: 'BANG DODI', role: 'Pagar & bengkel', x: 3010, y: 2590, color: '#7ac2ff' },
  ];
  state.companion = { name: '', color: '#ffffff', x: 0, y: 0, active: false };
  // A parked car waits right beside the starting corner.
  const starter = makeCar('ombak', 2130, 1470, 0, 'parked');
  state.parked.push(starter);
  updateCamera(state);
  return state;
}

export function respawnPlayer(state) {
  const p = state.player;
  clearHeat(state);
  p.health = 100; p.armor = 50;
  p.cash = Math.max(0, p.cash - 50);
  if (p.car) { p.car.speed = 0; p.car = null; }
  p.onFoot = true;
  p.x = 1560; p.y = 2830;
  p.invuln = 1.5;
  state.busted = false;
  state.bustedShown = false;
  state.message = 'Kamu ditangkap PTS dan kehilangan $50. Raka kembali ke jalan.';
  state.messageTimer = 4;
  updateCamera(state);
}

export function updateCamera(state) {
  const cam = state.camera;
  const p = state.player;
  cam.x = clamp(p.x - cam.w / 2, 0, WORLD_W - cam.w);
  cam.y = clamp(p.y - cam.h / 2, 0, WORLD_H - cam.h);
}

export function stepGame(state, input, dt) {
  state.elapsed += dt;
  state.time += dt;
  state.clockMin += dt / 2; // one game minute every 2 real seconds
  state.muzzle = Math.max(0, state.muzzle - dt);
  state.shake = Math.max(0, (state.shake || 0) - dt * 1.2);
  state.messageTimer = Math.max(0, state.messageTimer - dt);
  state.crimeTimer = Math.max(0, state.crimeTimer - dt);
  state.crewCooldowns.sinta = Math.max(0, state.crewCooldowns.sinta - dt);
  state.crewCooldowns.dodi = Math.max(0, state.crewCooldowns.dodi - dt);
  for (const s of state.sparks) {
    s.life -= dt;
    s.x += (s.vx || 0) * dt;
    s.y += (s.vy || 0) * dt;
  }
  state.sparks = state.sparks.filter((s) => s.life > 0);
  // Damage smoke and fire from battered cars; tyre smoke on handbrake turns.
  state.smokeTimer = (state.smokeTimer || 0) + dt;
  if (state.smokeTimer > 0.12) {
    state.smokeTimer = 0;
    const damaged = [state.player.car, ...state.police].filter(Boolean);
    for (const car of damaged) {
      if (car.health < 45) {
        state.sparks.push({
          x: car.x + (state.rng() - 0.5) * 20, y: car.y + (state.rng() - 0.5) * 14,
          vx: (state.rng() - 0.5) * 14, vy: -26 - state.rng() * 20,
          life: 0.7, color: car.health < 20 ? '#ff7a1a' : '#9a9aa0', size: 7,
        });
      }
    }
    if (state.player.car && keyDown(input, ' ') && Math.abs(state.player.car.speed) > 200) {
      const car = state.player.car;
      state.sparks.push({
        x: car.x - Math.cos(car.angle) * 26, y: car.y - Math.sin(car.angle) * 26,
        vx: 0, vy: -8, life: 0.5, color: '#e8e8e8', size: 6,
      });
    }
  }

  // Materialise the mission's target car the first step the step needs it.
  const step = state.mission?.steps[state.missionStep];
  if (step?.type === 'steal' && !state.missionCarObj) {
    const car = makeCar(step.carDef || 'senjaGT', step.x, step.y, 0, 'parked');
    state.parked.push(car);
    state.missionCarObj = car;
  }

  updatePlayer(state, input, dt);
  // Crew companion: the mission's giver walks with Raka on foot.
  {
    const comp = state.companion;
    const giver = state.mission?.giver;
    if (giver && state.player.onFoot) {
      const npc = state.crewNpcs.find((n) => n.name.toLowerCase().includes(giver.toLowerCase().split(' ')[0].toLowerCase())) || state.crewNpcs[0];
      comp.name = npc.name; comp.color = npc.color; comp.active = true;
      const tx = state.player.x - Math.cos(state.player.angle) * 64;
      const ty = state.player.y - Math.sin(state.player.angle) * 64 + 26;
      if (!comp.x && !comp.y) { comp.x = tx; comp.y = ty; }
      comp.x += (tx - comp.x) * Math.min(1, dt * 5);
      comp.y += (ty - comp.y) * Math.min(1, dt * 5);
    } else {
      comp.active = false;
    }
  }
  updateTraffic(state, dt);
  updatePedestrians(state, dt);
  updatePolice(state, dt);
  updateMissions(state, dt);
  updateBullets(state, dt);

  // Garage: press G with a car inside Bang Dodi's yard to repair it.
  if (wasPressed(input, 'g') && state.player.car) {
    const p = state.player;
    if (p.x > GARAGE.x && p.x < GARAGE.x + GARAGE.w && p.y > GARAGE.y && p.y < GARAGE.y + GARAGE.h) {
      p.car.health = 100;
      p.armor = Math.min(100, p.armor + 25);
      state.message = 'Garasi Bang Dodi: mobil diperbaiki, rompi diisi. Upgrade: mesin lebih responsif.';
      state.messageTimer = 4;
      playPickup();
    }
  }

  // Radio: R cycles stations and starts the music on first use.
  if (wasPressed(input, 'r')) {
    state.radioStation = (state.radioStation + 1) % 3;
    state.radioOn = true;
    startRadio(state.radioStation);
  }

  // Pickups on foot.
  for (const pk of state.pickups) {
    if (pk.taken) continue;
    if (state.player.onFoot && dist(state.player.x, state.player.y, pk.x, pk.y) < 34) {
      pk.taken = true;
      if (pk.kind === 'health') state.player.health = Math.min(100, state.player.health + 35);
      else state.player.armor = Math.min(100, state.player.armor + 35);
      state.message = pk.kind === 'health' ? 'Kotak P3K: +35 sehat.' : 'Rompi baru: +35 rompi.';
      state.messageTimer = 3;
      playPickup();
    }
  }

  // Busted: health reached zero in damagePlayer.
  if (state.player.health <= 0 && !state.busted) {
    state.busted = true;
    state.bustedShown = false;
    playBusted();
  }

  // Periodic save, and the mission tracker keeps the district fresh.
  state.saveTimer += dt;
  if (state.saveTimer > 10) {
    state.saveTimer = 0;
    if (typeof state.save === 'function') state.save();
  }
  state.district = districtAt(state.player.x, state.player.y).name;

  updateCamera(state);
  setSiren(state.wanted > 0);
  setEngine(state.engineFrac, state.driving && !!state.player.car);
  if (state.player.onFoot) state.driving = false;
}

export { STEP };
