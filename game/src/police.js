// The wanted system: heat rises with crimes, police cars chase the
// player, a helicopter watches from above at 2+ stars, and roadblocks
// physically seal the road at 3+ stars. Heat decays when the player
// stays clean and out of sight.
import { WORLD_W, WORLD_H } from './config.js';
import { clamp, dist, range } from './util.js';
import { makeCar, steerCarToward } from './vehicles.js';
import { collideCircle } from './world.js';
import { playCrash } from './audio.js';

export function addWanted(state, amount, reason) {
  if (amount <= 0) return;
  const before = state.wanted;
  state.wanted = clamp(state.wanted + amount, 0, 5);
  if (state.wanted > before) {
    state.cleanTimer = 0;
    state.message = reason || 'Polisi mengejarmu!';
    state.messageTimer = 3;
  }
}

export function updatePolice(state, dt) {
  const { player, police, city } = state;
  // Decay: clean for a while and far from every patrol car.
  if (state.wanted > 0) {
    state.cleanTimer += dt;
    let nearest = Infinity;
    for (const car of police) nearest = Math.min(nearest, dist(car.x, car.y, player.x, player.y));
    if (state.cleanTimer > 18 && nearest > 620) {
      state.decayTimer += dt;
      if (state.decayTimer > 7) {
        state.wanted -= 1;
        state.decayTimer = 0;
        state.message = state.wanted > 0 ? 'Bintang berkurang. Terus sembunyi.' : 'Kamu lolos dari kejaran PTS.';
        state.messageTimer = 3;
      }
    } else {
      state.decayTimer = 0;
    }
  }

  // Patrol strength follows the wanted level.
  const wantCount = state.wanted === 0 ? 0 : Math.min(6, state.wanted + 1);
  while (police.length < wantCount) {
    const angle = state.rng() * Math.PI * 2;
    const d = 900 + state.rng() * 400;
    const car = makeCar('pts', clamp(player.x + Math.cos(angle) * d, 60, WORLD_W - 60), clamp(player.y + Math.sin(angle) * d, 60, WORLD_H - 60), 0, 'police');
    car.speed = 200;
    police.push(car);
  }
  while (police.length > wantCount) police.pop();

  // Chase: steer at surround points around the player (PIT-style
  // pressure from several sides) instead of piling onto one point.
  // Patrol cars also repel each other so they fan out.
  for (let i = 0; i < police.length; i++) {
    const car = police[i];
    for (let j = 0; j < police.length; j++) {
      if (i === j) continue;
      const other = police[j];
      const d = dist(car.x, car.y, other.x, other.y);
      if (d > 0 && d < 62) {
        const push = (62 - d) * 0.5;
        car.x += ((car.x - other.x) / d) * push;
        car.y += ((car.y - other.y) / d) * push;
      }
    }
    const surround = (i / Math.max(1, police.length)) * Math.PI * 2 + state.time * 0.12;
    const tx = player.x + Math.cos(surround) * 95;
    const ty = player.y + Math.sin(surround) * 95;
    steerCarToward(car, tx, ty, dt, 0.92);
    const res = collideCircle(city, state.obstacles, car.x, car.y, 24);
    if (res.hit) { car.x = res.x; car.y = res.y; car.speed *= 0.55; if (Math.abs(car.speed) > 260) playCrash(); }
    if (dist(car.x, car.y, player.x, player.y) < 46 && Math.abs(car.speed) > 200) {
      // A hard bump shoves the player's car and rattles health a little.
      if (player.car) {
        player.car.speed *= 0.6;
        player.car.health -= 1.5;
      } else {
        damagePlayer(state, 4 * dt * 10);
      }
      car.speed *= 0.5;
    }
  }

  // Helicopter: appears at 2+ stars, follows above the player, searchlight on.
  if (state.wanted >= 2) {
    if (!state.helicopter) {
      state.helicopter = { x: player.x - 260, y: player.y - 260, angle: 0, rotor: 0, lightX: player.x, lightY: player.y };
    }
    const h = state.helicopter;
    h.rotor += dt * 30;
    const tx = player.x - 40; const ty = player.y - 120;
    h.x += (tx - h.x) * Math.min(1, dt * 2.8);
    h.y += (ty - h.y) * Math.min(1, dt * 2.8);
    h.lightX += (player.x - h.lightX) * Math.min(1, dt * 4);
    h.lightY += (player.y - h.lightY) * Math.min(1, dt * 4);
    h.angle = Math.atan2(player.y - h.y, player.x - h.x);
  } else {
    state.helicopter = null;
  }

  // Roadblocks: at 3+ stars, seal the road ahead of the player with
  // police cars placed across it. They are solid obstacles. A scene
  // may suppress the roadblock to keep a chase in open road.
  if (state.wanted >= 3 && !state.roadblock && !state.suppressRoadblock) {
    state.roadblock = buildRoadblock(state);
  }
  if (state.wanted < 3 && state.roadblock) {
    state.roadblock = null;
    state.obstacles = state.obstacles.filter((o) => o.tag !== 'roadblock');
  }
}

function buildRoadblock(state) {
  const { player } = state;
  // Pick the road the player is travelling along, ahead of them.
  const moving = player.car ? player.car.speed : 0;
  const heading = player.car ? player.car.angle : player.angle;
  const aheadX = player.x + Math.cos(heading) * 420;
  const aheadY = player.y + Math.sin(heading) * 420;
  const horizontal = Math.abs(Math.cos(heading)) >= Math.abs(Math.sin(heading));
  let cx, cy;
  if (horizontal) {
    // Block the nearest horizontal road at the player's row.
    let best = null; let bd = Infinity;
    for (const ry of [300, 800, 1300, 1800, 2300, 2800]) {
      const d = Math.abs(ry - aheadY);
      if (d < bd) { bd = d; best = ry; }
    }
    cx = aheadX; cy = best;
  } else {
    let best = null; let bd = Infinity;
    for (const rx of [300, 900, 1500, 2100, 2700, 3300, 3900]) {
      const d = Math.abs(rx - aheadX);
      if (d < bd) { bd = d; best = rx; }
    }
    cx = best; cy = aheadY;
  }
  const blockCars = [];
  const obstacles = [];
  const offsets = [-30, 30];
  for (const off of offsets) {
    const bx = horizontal ? cx : cx + off;
    const by = horizontal ? cy + off : cy;
    const car = makeCar('pts', bx, by, horizontal ? Math.PI / 2 : 0, 'police');
    car.speed = 0;
    blockCars.push(car);
    obstacles.push({ x: bx - 26, y: by - 13, w: 52, h: 26, tag: 'roadblock' });
  }
  state.obstacles.push(...obstacles);
  state.message = 'ROADBLOCK PTS DI DEPAN! Cari jalan lain atau terobos.';
  state.messageTimer = 4;
  return { x: cx, y: cy, horizontal, cars: blockCars };
}

export function damagePlayer(state, amount) {
  const p = state.player;
  if (p.invuln > 0) return;
  const armorAbsorb = Math.min(p.armor, amount * 0.6);
  p.armor -= armorAbsorb;
  p.health -= (amount - armorAbsorb);
  p.invuln = 0.35;
  if (p.health <= 0) {
    state.busted = true;
  }
}

export function clearHeat(state) {
  state.wanted = 0;
  state.police.length = 0;
  state.helicopter = null;
  state.roadblock = null;
  state.obstacles = state.obstacles.filter((o) => o.tag !== 'roadblock');
}
