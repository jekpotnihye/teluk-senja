// The city of Teluk Senja: a road grid, dense blocks of buildings with
// height shading, a harbour edge, markets, docks and street props.
// Buildings are the solid obstacles of the world.
import { WORLD_W, WORLD_H, ROAD_X, ROAD_Y, ROAD_HALF, DISTRICTS, districtAt } from './config.js';
import { createRng, pick, range, intRange, pushOutOfRect } from './util.js';

export function createCity(seed) {
  const rng = createRng(seed);
  const buildings = [];
  const props = [];
  const stalls = [];
  const roadXs = ROAD_X;
  const roadYs = ROAD_Y;

  // Blocks are the spaces between neighbouring roads (plus the map edges).
  const xs = [0, ...roadXs, WORLD_W];
  const ys = [0, ...roadYs, WORLD_H];
  for (let bi = 0; bi < xs.length - 1; bi++) {
    for (let bj = 0; bj < ys.length - 1; bj++) {
      const x0 = xs[bi] + (bi === 0 ? 14 : ROAD_HALF + 14);
      const x1 = xs[bi + 1] - (bi === xs.length - 2 ? 14 : ROAD_HALF + 14);
      const y0 = ys[bj] + (bj === 0 ? 14 : ROAD_HALF + 14);
      const y1 = ys[bj + 1] - (bj === ys.length - 2 ? 14 : ROAD_HALF + 14);
      const w = x1 - x0; const h = y1 - y0;
      if (w < 60 || h < 60) continue;
      const district = districtAt((x0 + x1) / 2, (y0 + y1) / 2);
      // Subdivide each block into 2-6 buildings along its longer side.
      const alongX = w >= h;
      const count = intRange(rng, 2, alongX ? 4 : 3);
      for (let k = 0; k < count; k++) {
        const t0 = k / count; const t1 = (k + 1) / count;
        const gap = 10;
        let bx, by, bw, bh;
        if (alongX) {
          bx = x0 + t0 * w + gap; bw = (t1 - t0) * w - gap * 2;
          by = y0 + gap; bh = h - gap * 2;
          // Some blocks get two rows of smaller buildings.
          if (h > 260 && rng() < 0.5) {
            const mid = y0 + h / 2;
            buildings.push(makeBuilding(rng, district, bx, by, bw, mid - by - gap));
            buildings.push(makeBuilding(rng, district, bx, mid + gap, bw, y1 - mid - gap));
            continue;
          }
        } else {
          by = y0 + t0 * h + gap; bh = (t1 - t0) * h - gap * 2;
          bx = x0 + gap; bw = w - gap * 2;
        }
        buildings.push(makeBuilding(rng, district, bx, by, bw, bh));
      }
      // Street props: trees and lamps around the block edge.
      const propCount = intRange(rng, 3, 7);
      for (let p = 0; p < propCount; p++) {
        const edge = intRange(rng, 0, 3);
        let px, py;
        if (edge === 0) { px = range(rng, x0, x1); py = y0 + 4; }
        else if (edge === 1) { px = range(rng, x0, x1); py = y1 - 4; }
        else if (edge === 2) { px = x0 + 4; py = range(rng, y0, y1); }
        else { px = x1 - 4; py = range(rng, y0, y1); }
        props.push({ x: px, y: py, kind: rng() < 0.6 ? 'tree' : 'lamp', s: range(rng, 0.8, 1.3) });
      }
    }
  }

  // Market stalls fill the Pasar Ikan blocks (open ground, walkable between).
  for (let i = 0; i < 26; i++) {
    const x = range(rng, 1580, 2620); const y = range(rng, 120, 1420);
    if (onRoad(x, y)) continue;
    stalls.push({ x, y, w: 46, h: 30, color: pick(rng, ['#d9534f', '#e8a13a', '#4f9a6d', '#4f7fb8']), label: 'IKAN' });
  }
  // Harbour: containers in Pelabuhan Senja, crates in Dermaga Lama.
  for (let i = 0; i < 30; i++) {
    const x = range(rng, 60, 1440); const y = range(rng, 60, 2940);
    if (onRoad(x, y)) continue;
    props.push({ x, y, kind: 'container', s: 1, color: pick(rng, ['#b8573a', '#3a6d8a', '#7a8a3a', '#c98a2e']) });
  }
  for (let i = 0; i < 18; i++) {
    const x = range(rng, 2760, 4140); const y = range(rng, 1560, 2940);
    if (onRoad(x, y)) continue;
    props.push({ x, y, kind: 'crate', s: range(rng, 0.8, 1.2), color: '#8a6f4d' });
  }

  return { buildings, props, stalls, seed };
}

function makeBuilding(rng, district, x, y, w, h) {
  const height = intRange(rng, 1, district.id === 'bukit' ? 5 : district.id === 'kotatua' ? 4 : 3);
  return {
    x, y, w: Math.max(30, w), h: Math.max(30, h),
    color: pick(rng, district.roof),
    trim: district.trim,
    height,
    district: district.id,
    windows: intRange(rng, 2, 6),
  };
}

export function onRoad(x, y) {
  for (const rx of ROAD_X) if (Math.abs(x - rx) <= ROAD_HALF) return true;
  for (const ry of ROAD_Y) if (Math.abs(y - ry) <= ROAD_HALF) return true;
  return false;
}

export function nearestRoadPoint(x, y) {
  let best = null; let bestD = Infinity;
  for (const rx of ROAD_X) {
    const d = Math.abs(x - rx);
    if (d < bestD) { bestD = d; best = { x: rx, y }; }
  }
  for (const ry of ROAD_Y) {
    const d = Math.abs(y - ry);
    if (d < bestD) { bestD = d; best = { x, y: ry }; }
  }
  return best;
}

// Resolve a circle against every building and every solid obstacle rect.
export function collideCircle(city, obstacles, x, y, r) {
  let hit = false;
  for (const b of city.buildings) {
    if (x + r < b.x || x - r > b.x + b.w || y + r < b.y || y - r > b.y + b.h) continue;
    const res = pushOutOfRect(x, y, r, b);
    x = res.x; y = res.y; hit = hit || res.hit;
  }
  for (const o of obstacles) {
    if (x + r < o.x || x - r > o.x + o.w || y + r < o.y || y - r > o.y + o.h) continue;
    const res = pushOutOfRect(x, y, r, o);
    x = res.x; y = res.y; hit = hit || res.hit;
  }
  return { x, y, hit };
}

export function circleHitsBuildings(city, x, y, r) {
  for (const b of city.buildings) {
    if (x + r < b.x || x - r > b.x + b.w || y + r < b.y || y - r > b.y + b.h) continue;
    const cx = Math.max(b.x, Math.min(x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(y, b.y + b.h));
    if ((x - cx) ** 2 + (y - cy) ** 2 < r * r) return true;
  }
  return false;
}
