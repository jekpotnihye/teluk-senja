// Raka on foot and behind the wheel: walking, running, entering and
// stealing cars, aiming with the mouse, and shooting. Crimes committed
// here raise the wanted level through the police module.
import { WORLD_W, WORLD_H, WEAPONS } from './config.js';
import { clamp, dist, angleTo } from './util.js';
import { collideCircle } from './world.js';
import { driveCar, makeCar } from './vehicles.js';
import { addWanted, damagePlayer } from './police.js';
import { keyDown, wasPressed } from './input.js';
import { playShot, playHit } from './audio.js';
import { scareNearby } from './pedestrians.js';

export function makePlayer(x, y) {
  return {
    x, y, angle: 0, aimAngle: 0,
    onFoot: true, car: null,
    health: 100, armor: 50,
    cash: 80, respect: 10,
    weaponIndex: 0, fireTimer: 0, invuln: 0,
    runTimer: 0,
  };
}

function nearestCar(state, maxD) {
  let best = null; let bd = maxD;
  const all = [...state.parked, ...state.traffic];
  if (state.missionCarObj) all.push(state.missionCarObj);
  for (const car of all) {
    const d = dist(state.player.x, state.player.y, car.x, car.y);
    if (d < bd) { bd = d; best = car; }
  }
  return best;
}

export function updatePlayer(state, input, dt) {
  const p = state.player;
  p.fireTimer = Math.max(0, p.fireTimer - dt);
  p.invuln = Math.max(0, p.invuln - dt);

  // Aim follows the mouse in world space.
  const cam = state.camera;
  const mouseWorldX = cam.x + input.mouseX;
  const mouseWorldY = cam.y + input.mouseY;
  p.aimAngle = angleTo(p.x, p.y, mouseWorldX, mouseWorldY);

  if (p.onFoot) {
    updateOnFoot(state, input, dt);
  } else if (p.car) {
    updateDriving(state, input, dt);
  }

  // Enter / exit / steal a car.
  if (wasPressed(input, 'e')) {
    if (p.onFoot) {
      const car = nearestCar(state, 64);
      if (car) enterCar(state, car);
    } else {
      exitCar(state);
    }
  }

  // Weapons.
  if (wasPressed(input, '1')) p.weaponIndex = 0;
  if (wasPressed(input, '2')) p.weaponIndex = 1;
  if (wasPressed(input, '3')) p.weaponIndex = 2;

  // Shooting (on foot, or drive-by from the car).
  if (input.mouseDown && p.fireTimer <= 0) {
    fireWeapon(state);
  }

  // Crew abilities: Q = Sinta distraction, F = Bang Dodi repair.
  if (wasPressed(input, 'q')) useCrew(state, 'sinta');
  if (wasPressed(input, 'f')) useCrew(state, 'dodi');
}

function updateOnFoot(state, input, dt) {
  const p = state.player;
  let mx = 0; let my = 0;
  if (keyDown(input, 'w') || keyDown(input, 'ArrowUp')) my -= 1;
  if (keyDown(input, 's') || keyDown(input, 'ArrowDown')) my += 1;
  if (keyDown(input, 'a') || keyDown(input, 'ArrowLeft')) mx -= 1;
  if (keyDown(input, 'd') || keyDown(input, 'ArrowRight')) mx += 1;
  const len = Math.hypot(mx, my);
  const running = keyDown(input, 'Shift');
  const speed = running ? 300 : 185;
  if (len > 0) {
    mx /= len; my /= len;
    p.x += mx * speed * dt;
    p.y += my * speed * dt;
    p.angle = Math.atan2(my, mx);
    p.runTimer += dt;
  }
  p.x = clamp(p.x, 20, WORLD_W - 20);
  p.y = clamp(p.y, 20, WORLD_H - 20);
  const res = collideCircle(state.city, state.obstacles, p.x, p.y, 13);
  p.x = res.x; p.y = res.y;
}

function updateDriving(state, input, dt) {
  const p = state.player;
  const car = p.car;
  let throttle = 0;
  if (keyDown(input, 'w') || keyDown(input, 'ArrowUp')) throttle = 1;
  if (keyDown(input, 's') || keyDown(input, 'ArrowDown')) throttle = -1;
  let steer = 0;
  if (keyDown(input, 'a') || keyDown(input, 'ArrowLeft')) steer = -1;
  if (keyDown(input, 'd') || keyDown(input, 'ArrowRight')) steer = 1;
  const before = { x: car.x, y: car.y };
  driveCar(car, throttle, steer, dt, keyDown(input, ' '));
  const res = collideCircle(state.city, state.obstacles, car.x, car.y, 24);
  if (res.hit) {
    const impact = Math.abs(car.speed);
    car.x = res.x; car.y = res.y;
    if (impact > 220) {
      car.health -= (impact - 220) / 14;
      car.speed *= -0.25;
      damagePlayer(state, 3);
      state.shake = 0.4;
      state.message = 'Tabrakan! Mobil rusak.';
      state.messageTimer = 2;
    } else {
      car.speed *= 0.4;
    }
  }
  // Running over a pedestrian is a serious crime.
  for (const ped of state.peds) {
    if (ped.guard) continue;
    if (dist(car.x, car.y, ped.x, ped.y) < 30 && Math.abs(car.speed) > 120) {
      ped.fleeTimer = 4;
      addWanted(state, 2, 'Kamu menabrak pejalan kaki! PTS mengejarmu.');
    }
  }
  p.x = car.x; p.y = car.y;
  p.angle = car.angle;
  state.engineFrac = Math.abs(car.speed) / 520;
  state.driving = true;
  void before;
}

function enterCar(state, car) {
  const p = state.player;
  const wasParked = state.parked.includes(car);
  const wasTraffic = state.traffic.includes(car);
  if (wasParked) state.parked = state.parked.filter((c) => c !== car);
  if (wasTraffic) {
    state.traffic = state.traffic.filter((c) => c !== car);
    // Stealing a car with a driver inside is a crime.
    addWanted(state, 1, 'Kamu mencuri mobil! PTS mengejarmu.');
  }
  if (state.missionCarObj === car) {
    car.missionTarget = true;
    state.message = 'Senja GT didapat! Bawa ke bengkel Bang Dodi.';
    state.messageTimer = 4;
  }
  car.kind = 'player';
  p.car = car;
  p.onFoot = false;
  p.x = car.x; p.y = car.y;
  state.driving = true;
}

function exitCar(state) {
  const p = state.player;
  const car = p.car;
  if (!car) return;
  const sideX = car.x + Math.cos(car.angle + Math.PI / 2) * 40;
  const sideY = car.y + Math.sin(car.angle + Math.PI / 2) * 40;
  p.x = sideX; p.y = sideY;
  p.onFoot = true;
  p.car = null;
  car.kind = 'parked';
  car.speed = 0;
  state.parked.push(car);
  state.driving = false;
}

function fireWeapon(state) {
  const p = state.player;
  const weapon = WEAPONS[p.weaponIndex];
  p.fireTimer = weapon.rate;
  const spread = (state.rng() - 0.5) * 2 * weapon.spread;
  const a = p.aimAngle + spread;
  const ox = p.x + Math.cos(a) * 20;
  const oy = p.y + Math.sin(a) * 20;
  state.bullets.push({
    x: ox, y: oy,
    vx: Math.cos(a) * 900, vy: Math.sin(a) * 900,
    life: weapon.range / 900, damage: weapon.damage, hostile: false,
  });
  state.muzzle = 0.06;
  playShot();
  scareNearby(state, p.x, p.y, 380);
  if (!p.car) addWanted(state, 0, '');
  // Firing in public draws the police.
  if (state.crimeTimer <= 0) {
    addWanted(state, 1, 'Tembakan terdengar! PTS mengejarmu.');
    state.crimeTimer = 6;
  }
}

function useCrew(state, id) {
  const p = state.player;
  if (id === 'sinta') {
    if (state.crewCooldowns.sinta > 0) return;
    state.crewCooldowns.sinta = 45;
    // Sinta's distraction: the nearest patrol cars are sent away.
    for (const car of state.police) {
      const away = angleTo(p.x, p.y, car.x, car.y);
      car.x += Math.cos(away) * 500;
      car.y += Math.sin(away) * 500;
    }
    state.message = 'Sinta mengalihkan perhatian PTS!';
    state.messageTimer = 3;
  } else {
    if (state.crewCooldowns.dodi > 0) return;
    state.crewCooldowns.dodi = 60;
    if (p.car) p.car.health = 100;
    p.armor = Math.min(100, p.armor + 40);
    state.message = 'Bang Dodi memperbaiki mobil dan mengisi rompimu.';
    state.messageTimer = 3;
  }
}

export function updateBullets(state, dt) {
  for (const b of state.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
  }
  // Bullet hits: buildings stop them, guards and the player take damage.
  state.bullets = state.bullets.filter((b) => {
    if (b.life <= 0) return false;
    if (b.x < 0 || b.x > WORLD_W || b.y < 0 || b.y > WORLD_H) return false;
    for (const building of state.city.buildings) {
      if (b.x > building.x && b.x < building.x + building.w && b.y > building.y && b.y < building.y + building.h) {
        state.sparks.push({ x: b.x, y: b.y, life: 0.2, color: '#ffd76a' });
        return false;
      }
    }
    if (!b.hostile) {
      for (const ped of state.peds) {
        if (ped.health > 0 && dist(b.x, b.y, ped.x, ped.y) < 16) {
          ped.health -= b.damage;
          playHit();
          state.sparks.push({ x: b.x, y: b.y, life: 0.25, color: '#ff6a5a' });
          if (ped.health <= 0 && ped.missionGuard) {
            state.guardsDefeated += 1;
            state.player.cash += 25;
          }
          return false;
        }
      }
    } else {
      const p = state.player;
      if (dist(b.x, b.y, p.x, p.y) < 15) {
        damagePlayer(state, b.damage);
        return false;
      }
    }
    return true;
  });
}
