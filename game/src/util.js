// Small shared helpers: a seeded random generator, maths, text wrapping,
// and the save-game envelope. No game logic lives here.
export function createRng(seed) {
  let a = (seed >>> 0) || 1;
  return function next() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
export function range(rng, min, max) { return min + rng() * (max - min); }
export function intRange(rng, min, max) { return min + Math.floor(rng() * (max - min + 1)); }
export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function dist(x1, y1, x2, y2) { return Math.hypot(x2 - x1, y2 - y1); }

export function angleTo(x1, y1, x2, y2) { return Math.atan2(y2 - y1, x2 - x1); }

export function turnToward(current, target, maxTurn) {
  let d = target - current;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return current + clamp(d, -maxTurn, maxTurn);
}

export function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// Push a circle (x,y,r) out of an axis-aligned rect; returns corrected position.
export function pushOutOfRect(x, y, r, rect) {
  const cx = clamp(x, rect.x, rect.x + rect.w);
  const cy = clamp(y, rect.y, rect.y + rect.h);
  const dx = x - cx; const dy = y - cy;
  const d2 = dx * dx + dy * dy;
  if (d2 >= r * r) return { x, y, hit: false };
  if (d2 > 0.0001) {
    const d = Math.sqrt(d2);
    return { x: cx + (dx / d) * r, y: cy + (dy / d) * r, hit: true };
  }
  // Centre inside the rect: push out along the smallest penetration.
  const left = x - rect.x; const right = rect.x + rect.w - x;
  const top = y - rect.y; const bottom = rect.y + rect.h - y;
  const m = Math.min(left, right, top, bottom);
  if (m === left) return { x: rect.x - r, y, hit: true };
  if (m === right) return { x: rect.x + rect.w + r, y, hit: true };
  if (m === top) return { x, y: rect.y - r, hit: true };
  return { x, y: rect.y + rect.h + r, hit: true };
}

export function wrapText(ctx, text, maxWidth) {
  const words = String(text).split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export function loadSave(key) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function storeSave(key, data) {
  try { window.localStorage.setItem(key, JSON.stringify(data)); } catch { /* storage may be off */ }
}
