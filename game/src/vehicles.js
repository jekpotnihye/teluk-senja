// Cars: arcade driving physics, parked cars, and traffic that follows
// the road grid. A car is a rectangle with a heading and a speed.
import { WORLD_W, WORLD_H, ROAD_X, ROAD_Y, CAR_DEFS } from './config.js';
import { clamp, pick, range, intRange, turnToward, angleTo } from './util.js';
import { collideCircle, onRoad } from './world.js';

let carId = 0;

export function makeCar(defKey, x, y, angle, kind) {
  const def = CAR_DEFS[defKey];
  return {
    id: carId += 1,
    defKey, name: def.name, color: def.color,
    x, y, angle, speed: 0,
    w: 52, h: 26,
    kind: kind || 'civil', // civil | parked | police | player
    health: 100,
    cruise: 0.55,
    axis: 'x', dir: 1,
    stuck: 0,
    smoke: 0,
  };
}

export function spawnTraffic(rng, city, count) {
  const cars = [];
  const keys = ['ombak', 'camar', 'bakau', 'kargo'];
  for (let i = 0; i < count; i++) {
    const horizontal = rng() < 0.5;
    let x, y, angle, axis, dir;
    if (horizontal) {
      y = pick(rng, ROAD_Y) + (rng() < 0.5 ? -22 : 22);
      x = range(rng, 80, WORLD_W - 80);
      dir = rng() < 0.5 ? 1 : -1;
      angle = dir > 0 ? 0 : Math.PI;
      axis = 'x';
    } else {
      x = pick(rng, ROAD_X) + (rng() < 0.5 ? -22 : 22);
      y = range(rng, 80, WORLD_H - 80);
      dir = rng() < 0.5 ? 1 : -1;
      angle = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      axis = 'y';
    }
    const car = makeCar(pick(rng, keys), x, y, angle, 'civil');
    car.cruise = range(rng, 0.4, 0.7);
    car.axis = axis; car.dir = dir;
    car.speed = car.cruise * 260;
    cars.push(car);
  }
  return cars;
}

export function spawnParked(rng, count) {
  const cars = [];
  const keys = ['senjaGT', 'ombak', 'camar', 'bakau', 'kargo'];
  let guard = 0;
  while (cars.length < count && guard < count * 40) {
    guard += 1;
    const horizontal = rng() < 0.5;
    let x, y, angle;
    if (horizontal) {
      y = pick(rng, ROAD_Y) + (rng() < 0.5 ? -34 : 34);
      x = range(rng, 120, WORLD_W - 120);
      angle = rng() < 0.5 ? 0 : Math.PI;
    } else {
      x = pick(rng, ROAD_X) + (rng() < 0.5 ? -34 : 34);
      y = range(rng, 120, WORLD_H - 120);
      angle = rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
    }
    if (onRoad(x, y)) continue;
    const car = makeCar(pick(rng, keys), x, y, angle, 'parked');
    cars.push(car);
  }
  return cars;
}

// Arcade car physics: throttle accelerates along the heading, steering
// turns harder at low speed, drag and grip bleed sideways motion away.
export function driveCar(car, throttle, steer, dt, handbrake) {
  const def = CAR_DEFS[car.defKey];
  const top = def.top;
  if (throttle > 0) car.speed += def.accel * throttle * dt;
  else if (throttle < 0) car.speed += def.accel * 0.7 * throttle * dt;
  const drag = handbrake ? 3.2 : 0.55;
  car.speed -= car.speed * drag * dt;
  if (throttle === 0) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 40 * dt);
  car.speed = clamp(car.speed, -top * 0.45, top);
  const speedFrac = Math.abs(car.speed) / top;
  const turnRate = def.grip * (1 - speedFrac * 0.45) * Math.sign(car.speed || 1);
  car.angle += steer * turnRate * dt * (car.speed >= 0 ? 1 : -1) * (handbrake ? 1.5 : 1);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  car.x = clamp(car.x, 30, WORLD_W - 30);
  car.y = clamp(car.y, 30, WORLD_H - 30);
  if (car.health < 45) car.smoke += dt;
  return speedFrac;
}

export function updateTraffic(state, dt) {
  const { traffic, city } = state;
  for (const car of traffic) {
    // Slow for the car ahead on the same lane.
    let ahead = Infinity;
    for (const other of traffic) {
      if (other === car || other.axis !== car.axis || other.dir !== car.dir) continue;
      const along = car.axis === 'x' ? (other.x - car.x) * car.dir : (other.y - car.y) * car.dir;
      const lateral = car.axis === 'x' ? Math.abs(other.y - car.y) : Math.abs(other.x - car.x);
      if (along > 0 && along < ahead && lateral < 34) ahead = along;
    }
    const playerCar = state.player.car;
    if (playerCar && car.axis === playerCar.axis && car.dir === playerCar.dir) {
      const along = car.axis === 'x' ? (playerCar.x - car.x) * car.dir : (playerCar.y - car.y) * car.dir;
      const lateral = car.axis === 'x' ? Math.abs(playerCar.y - car.y) : Math.abs(playerCar.x - car.x);
      if (along > 0 && along < ahead && lateral < 34) ahead = along;
    }
    const target = ahead < 90 ? 40 : car.cruise * 260;
    car.speed += clamp(target - car.speed, -300 * dt, 200 * dt);
    // At an intersection, sometimes turn onto the crossing road.
    const nearX = ROAD_X.some((rx) => Math.abs(car.x - rx) < 14 && car.axis === 'x');
    const nearY = ROAD_Y.some((ry) => Math.abs(car.y - ry) < 14 && car.axis === 'y');
    if ((nearX || nearY) && state.rng() < 0.006) {
      if (car.axis === 'x') {
        car.axis = 'y'; car.dir = state.rng() < 0.5 ? 1 : -1;
        car.y = ROAD_Y.reduce((a, b) => Math.abs(b - car.y) < Math.abs(a - car.y) ? b : a);
        car.x += car.dir > 0 ? -22 : 22;
      } else {
        car.axis = 'x'; car.dir = state.rng() < 0.5 ? 1 : -1;
        car.x = ROAD_X.reduce((a, b) => Math.abs(b - car.x) < Math.abs(a - car.x) ? b : a);
        car.y += car.dir > 0 ? -22 : 22;
      }
    }
    car.angle = car.axis === 'x' ? (car.dir > 0 ? 0 : Math.PI) : (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    if (car.x < 40 || car.x > WORLD_W - 40 || car.y < 40 || car.y > WORLD_H - 40) {
      car.axis = car.axis === 'x' ? 'y' : 'x';
      car.dir *= -1;
      car.x = clamp(car.x, 60, WORLD_W - 60);
      car.y = clamp(car.y, 60, WORLD_H - 60);
    }
    // Keep traffic out of buildings: nudge back onto the road.
    if (!onRoad(car.x, car.y)) {
      const res = collideCircle(city, state.obstacles, car.x, car.y, 24);
      car.x = res.x; car.y = res.y;
      if (res.hit) car.speed *= 0.6;
    }
  }
}

// Steering helper shared by police pursuit: aim a car at a point.
export function steerCarToward(car, tx, ty, dt, topFrac) {
  const def = CAR_DEFS[car.defKey];
  const want = angleTo(car.x, car.y, tx, ty);
  car.angle = turnToward(car.angle, want, def.grip * dt);
  const target = def.top * (topFrac ?? 0.9);
  car.speed += clamp(target - car.speed, -500 * dt, 380 * dt);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  car.x = clamp(car.x, 30, WORLD_W - 30);
  car.y = clamp(car.y, 30, WORLD_H - 30);
}
