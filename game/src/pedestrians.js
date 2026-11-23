// Pedestrians: people walking the sidewalks and market, who flee from
// gunfire, plus the armed guards who defend mission locations.
import { WORLD_W, WORLD_H } from './config.js';
import { range, intRange, pick, dist, angleTo, turnToward } from './util.js';
import { collideCircle, onRoad } from './world.js';

const SHIRTS = ['#e8e0d0', '#d96a4a', '#4a7ab8', '#e8c84a', '#6ab86a', '#b86ab8', '#e8e8e8', '#4a4a52'];
const SKINS = ['#e8b98a', '#c98a5a', '#8a5a38', '#f0cba0'];

export function spawnPedestrians(rng, count) {
  const peds = [];
  for (let i = 0; i < count; i++) {
    const x = range(rng, 60, WORLD_W - 60);
    const y = range(rng, 60, WORLD_H - 60);
    if (onRoad(x, y)) continue;
    peds.push({
      x, y, angle: range(rng, 0, Math.PI * 2),
      speed: range(rng, 26, 52),
      shirt: pick(rng, SHIRTS), skin: pick(rng, SKINS),
      state: 'walk', fleeTimer: 0, pauseTimer: range(rng, 0, 4),
      guard: false, health: 0, fireTimer: 0,
    });
  }
  return peds;
}

export function makeGuard(x, y) {
  return {
    x, y, angle: 0, speed: 0,
    shirt: '#3a3a44', skin: '#c98a5a',
    state: 'guard', fleeTimer: 0, pauseTimer: 0,
    guard: true, health: 100, fireTimer: range(0.3, 1.2),
    homeX: x, homeY: y,
  };
}

export function updatePedestrians(state, dt) {
  const { peds, city, player } = state;
  for (const ped of peds) {
    if (ped.guard) {
      const d = dist(ped.x, ped.y, player.x, player.y);
      if (d < 460 && ped.health > 0) {
        ped.angle = turnToward(ped.angle, angleTo(ped.x, ped.y, player.x, player.y), 6 * dt);
        ped.fireTimer -= dt;
        if (ped.fireTimer <= 0 && state.wanted >= 0) {
          ped.fireTimer = 1.1;
          fireGuardBullet(state, ped);
        }
      }
      continue;
    }
    if (ped.fleeTimer > 0) {
      ped.fleeTimer -= dt;
      const away = angleTo(player.x, player.y, ped.x, ped.y);
      ped.angle = turnToward(ped.angle, away, 8 * dt);
      ped.x += Math.cos(ped.angle) * 120 * dt;
      ped.y += Math.sin(ped.angle) * 120 * dt;
    } else {
      ped.pauseTimer -= dt;
      if (ped.pauseTimer <= 0) {
        ped.angle = range(state.rng, 0, Math.PI * 2);
        ped.pauseTimer = range(state.rng, 2, 6);
      }
      ped.x += Math.cos(ped.angle) * ped.speed * dt;
      ped.y += Math.sin(ped.angle) * ped.speed * dt;
    }
    ped.x = Math.max(20, Math.min(WORLD_W - 20, ped.x));
    ped.y = Math.max(20, Math.min(WORLD_H - 20, ped.y));
    const res = collideCircle(city, state.obstacles, ped.x, ped.y, 10);
    if (res.hit) { ped.x = res.x; ped.y = res.y; ped.angle += Math.PI / 2; }
  }
}

function fireGuardBullet(state, ped) {
  const a = angleTo(ped.x, ped.y, state.player.x, state.player.y) + (state.rng() - 0.5) * 0.12;
  state.bullets.push({
    x: ped.x + Math.cos(a) * 18, y: ped.y + Math.sin(a) * 18,
    vx: Math.cos(a) * 620, vy: Math.sin(a) * 620,
    life: 0.9, damage: 7, hostile: true,
  });
}

export function scareNearby(state, x, y, radius) {
  for (const ped of state.peds) {
    if (!ped.guard && dist(ped.x, ped.y, x, y) < radius) ped.fleeTimer = 3;
  }
}
