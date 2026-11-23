// TELUK SENJA in GTA III style: a hand-written raw WebGL1 renderer.
// No library, no external asset, no network. Shaders are strings,
// geometry is generated procedurally in code, and the one texture
// (a building facade) is painted on a Canvas 2D and uploaded to GL.
// The game logic still lives in 2D world coordinates (x, y); this
// file maps them onto a low-poly 3D city: X = (x-2100)/40,
// Z = (y-1500)/40, Y is up. GTA III era: flat shading, blocky
// buildings, simple textures, a third-person camera, fog, and a
// warm dusk sun.
import { WORLD_W, WORLD_H, ROAD_X, ROAD_Y, DISTRICTS, districtAt } from './config.js';
import { currentStep } from './missions.js';
// Garage yard rect, kept in sync with game.js (importing game.js here
// would cycle through player.js, which imports this file for aiming).
const GARAGE = { x: 2960, y: 2540, w: 190, h: 130 };

const SCALE = 40;
const OX = WORLD_W / 2;
const OZ = WORLD_H / 2;
const STRIDE = 14; // pos3 normal3 color3 uv2 tex1 emis1 alpha1

export const wx = (x) => (x - OX) / SCALE;
export const wz = (y) => (y - OZ) / SCALE;

function hexRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
}
function shade(rgb, f) { return [Math.min(1, rgb[0] * f), Math.min(1, rgb[1] * f), Math.min(1, rgb[2] * f)]; }

// ---- 4x4 matrices, column-major (WebGL convention) ----
export function matPerspective(fovY, aspect, near, far) {
  const f = 1 / Math.tan(fovY / 2);
  const out = new Float32Array(16);
  out[0] = f / aspect; out[5] = f; out[10] = (far + near) / (near - far);
  out[11] = -1; out[14] = (2 * far * near) / (near - far);
  return out;
}
export function matLookAt(eye, center, up) {
  const zx = eye[0] - center[0]; const zy = eye[1] - center[1]; const zz = eye[2] - center[2];
  let zl = Math.hypot(zx, zy, zz) || 1;
  const z = [zx / zl, zy / zl, zz / zl];
  let xx = up[1] * z[2] - up[2] * z[1];
  let xy = up[2] * z[0] - up[0] * z[2];
  let xz = up[0] * z[1] - up[1] * z[0];
  const xl = Math.hypot(xx, xy, xz) || 1;
  const x = [xx / xl, xy / xl, xz / xl];
  const y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]];
  const out = new Float32Array(16);
  out[0] = x[0]; out[1] = y[0]; out[2] = z[0];
  out[4] = x[1]; out[5] = y[1]; out[6] = z[1];
  out[8] = x[2]; out[9] = y[2]; out[10] = z[2];
  out[12] = -(x[0] * eye[0] + x[1] * eye[1] + x[2] * eye[2]);
  out[13] = -(y[0] * eye[0] + y[1] * eye[1] + y[2] * eye[2]);
  out[14] = -(z[0] * eye[0] + z[1] * eye[1] + z[2] * eye[2]);
  out[15] = 1;
  return out;
}
export function matMul(a, b) {
  const out = new Float32Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      out[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
  }
  return out;
}
export function matInvert(m) {
  const a00 = m[0], a01 = m[1], a02 = m[2], a03 = m[3];
  const a10 = m[4], a11 = m[5], a12 = m[6], a13 = m[7];
  const a20 = m[8], a21 = m[9], a22 = m[10], a23 = m[11];
  const a30 = m[12], a31 = m[13], a32 = m[14], a33 = m[15];
  const b00 = a00 * a11 - a01 * a10;
  const b01 = a00 * a12 - a02 * a10;
  const b02 = a00 * a13 - a03 * a10;
  const b03 = a01 * a12 - a02 * a11;
  const b04 = a01 * a13 - a03 * a11;
  const b05 = a02 * a13 - a03 * a12;
  const b06 = a20 * a31 - a21 * a30;
  const b07 = a20 * a32 - a22 * a30;
  const b08 = a20 * a33 - a23 * a30;
  const b09 = a21 * a32 - a22 * a31;
  const b10 = a21 * a33 - a23 * a31;
  const b11 = a22 * a33 - a23 * a32;
  let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
  if (!det) return null;
  det = 1 / det;
  const out = new Float32Array(16);
  out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
  out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
  out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
  out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
  out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
  out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
  out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
  out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
  out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
  out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
  out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
  out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
  out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
  out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
  out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
  out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
  return out;
}
function lerpAngle(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

// ---- Geometry builder: vertices written straight into a Float32Array ----
export class Geo {
  constructor(capacity) { this.a = new Float32Array(capacity); this.n = 0; }
  reset() { this.n = 0; }
  v(px, py, pz, nx, ny, nz, r, g, b, u, v, tex, emis, alpha) {
    const a = this.a; let i = this.n;
    a[i] = px; a[i + 1] = py; a[i + 2] = pz;
    a[i + 3] = nx; a[i + 4] = ny; a[i + 5] = nz;
    a[i + 6] = r; a[i + 7] = g; a[i + 8] = b;
    a[i + 9] = u; a[i + 10] = v; a[i + 11] = tex; a[i + 12] = emis; a[i + 13] = alpha;
    this.n = i + STRIDE;
  }
  tri(p1, p2, p3, n, color, uv, tex, emis, alpha) {
    this.v(p1[0], p1[1], p1[2], n[0], n[1], n[2], color[0], color[1], color[2], uv[0][0], uv[0][1], tex, emis, alpha);
    this.v(p2[0], p2[1], p2[2], n[0], n[1], n[2], color[0], color[1], color[2], uv[1][0], uv[1][1], tex, emis, alpha);
    this.v(p3[0], p3[1], p3[2], n[0], n[1], n[2], color[0], color[1], color[2], uv[2][0], uv[2][1], tex, emis, alpha);
  }
  quad(p1, p2, p3, p4, n, color, uv, tex, emis, alpha) {
    this.tri(p1, p2, p3, n, color, uv, tex, emis, alpha);
    this.tri(p1, p3, p4, n, color, [[uv[0][0], uv[0][1]], [uv[2][0], uv[2][1]], [uv[3][0], uv[3][1]]], tex, emis, alpha);
  }
  // Axis-aligned ground quad in world (x,y) coords, at height y3d.
  groundQuad(x0, y0, x1, y1, y3d, color, alpha = 1) {
    const X0 = wx(x0), X1 = wx(x1), Z0 = wz(y0), Z1 = wz(y1);
    this.quad([X0, y3d, Z0], [X1, y3d, Z0], [X1, y3d, Z1], [X0, y3d, Z1],
      [0, 1, 0], color, [[0, 0], [1, 0], [1, 1], [0, 1]], 0, 0, alpha);
  }
  // A box centred at (cx, cy, cz), sizes in 3D units, rotated yaw around Y.
  // Local +x maps to the heading direction (cos yaw, 0, sin yaw).
  box(cx, cy, cz, sx, sy, sz, yaw, color, opt = {}) {
    const hx = sx / 2, hy = sy / 2, hz = sz / 2;
    const c = Math.cos(yaw), s = Math.sin(yaw);
    const xf = (lx, lz) => [cx + lx * c - lz * s, cz + lx * s + lz * c];
    const nf = (lx, lz) => [lx * c - lz * s, 0, lx * s + lz * c];
    const P = (lx, ly, lz) => { const [X, Z] = xf(lx, lz); return [X, cy + ly, Z]; };
    const topColor = opt.top || shade(color, 1.18);
    const sideColor = opt.sides || color;
    // Window repeats are per face, from that face's real size, so the
    // grid stays square on every side of a building. One texture tile
    // spans 130 world units, so a window reads about 32 world units
    // wide — building scale, not a dot grid.
    const uvU = opt.tex ? (sx * SCALE) / 130 : 1;
    const uvX = opt.tex ? (sz * SCALE) / 130 : 1;
    const uvV = opt.tex ? (sy * SCALE) / 130 : 1;
    const tex = opt.tex ? 1 : 0;
    const emis = opt.emis || 0; const alpha = opt.alpha ?? 1;
    const uvZ = [[0, 0], [uvU, 0], [uvU, uvV], [0, uvV]];
    const uvSide = [[0, 0], [uvX, 0], [uvX, uvV], [0, uvV]];
    const uv = [[0, 0], [1, 0], [1, 1], [0, 1]];
    // top
    this.quad(P(-hx, hy, -hz), P(hx, hy, -hz), P(hx, hy, hz), P(-hx, hy, hz), [0, 1, 0], topColor, uv, 0, emis, alpha);
    // bottom
    this.quad(P(-hx, -hy, hz), P(hx, -hy, hz), P(hx, -hy, -hz), P(-hx, -hy, -hz), [0, -1, 0], shade(color, 0.6), uv, 0, emis, alpha);
    // +z face
    this.quad(P(-hx, -hy, hz), P(hx, -hy, hz), P(hx, hy, hz), P(-hx, hy, hz), nf(0, 1), sideColor, uvZ, tex, emis, alpha);
    // -z face
    this.quad(P(hx, -hy, -hz), P(-hx, -hy, -hz), P(-hx, hy, -hz), P(hx, hy, -hz), nf(0, -1), sideColor, uvZ, tex, emis, alpha);
    // +x face
    this.quad(P(hx, -hy, hz), P(hx, -hy, -hz), P(hx, hy, -hz), P(hx, hy, hz), nf(1, 0), sideColor, uvSide, tex, emis, alpha);
    // -x face
    this.quad(P(-hx, -hy, -hz), P(-hx, -hy, hz), P(-hx, hy, hz), P(-hx, hy, -hz), nf(-1, 0), sideColor, uvSide, tex, emis, alpha);
  }
  // Flat ring on the ground (annulus), facing up.
  ring(cx, cz, y, rIn, rOut, color, alpha, segs = 18) {
    for (let i = 0; i < segs; i++) {
      const a0 = (i / segs) * Math.PI * 2; const a1 = ((i + 1) / segs) * Math.PI * 2;
      const p = (r, a) => [cx + Math.cos(a) * r, y, cz + Math.sin(a) * r];
      this.quad(p(rIn, a0), p(rOut, a0), p(rOut, a1), p(rIn, a1), [0, 1, 0], color, [[0, 0], [1, 0], [1, 1], [0, 1]], 0, 0, alpha);
    }
  }
  // Cone with apex at `apex` and a circular base centred at `base`, radius r.
  cone(apex, base, r, color, alpha, segs = 8, rot = 0) {
    for (let i = 0; i < segs; i++) {
      const a0 = rot + (i / segs) * Math.PI * 2; const a1 = rot + ((i + 1) / segs) * Math.PI * 2;
      const b0 = [base[0] + Math.cos(a0) * r, base[1], base[2] + Math.sin(a0) * r];
      const b1 = [base[0] + Math.cos(a1) * r, base[1], base[2] + Math.sin(a1) * r];
      const n = [Math.cos((a0 + a1) / 2), 0.45, Math.sin((a0 + a1) / 2)];
      const nl = Math.hypot(n[0], n[1], n[2]) || 1;
      this.tri(apex, b0, b1, [n[0] / nl, n[1] / nl, n[2] / nl], color, [[0, 0], [1, 0], [1, 1]], 0, 0, alpha);
    }
  }
  // Billboard quad facing the camera (right/up vectors supplied).
  billboard(center, w, h, right, color, alpha, emis = 0) {
    const hw = w / 2, hh = h / 2;
    const p = (rx, uy) => [center[0] + right[0] * rx, center[1] + uy, center[2] + right[2] * rx];
    const n = [right[2], 0, -right[0]];
    this.quad(p(-hw, -hh), p(hw, -hh), p(hw, hh), p(-hw, hh), n, color, [[0, 0], [1, 0], [1, 1], [0, 1]], 0, emis, alpha);
  }
}

// ---- Shaders ----
const VERT = `
attribute vec3 aPos; attribute vec3 aNormal; attribute vec3 aColor;
attribute vec2 aUV; attribute float aTex; attribute float aEmis; attribute float aAlpha;
uniform mat4 uVP; uniform vec3 uEye; uniform vec3 uSunDir; uniform float uNight;
varying vec3 vColor; varying vec2 vUV; varying float vTex; varying float vEmis;
varying float vAlpha; varying float vFog;
void main() {
  vec4 wp = vec4(aPos, 1.0);
  gl_Position = uVP * wp;
  float diff = max(dot(normalize(aNormal), uSunDir), 0.0);
  float light = (0.58 + 0.48 * diff) * (1.0 - 0.50 * uNight);
  vColor = aColor * light;
  vUV = aUV; vTex = aTex;
  vEmis = aEmis * (0.35 + 0.65 * uNight);
  vAlpha = aAlpha;
  float d = distance(aPos, uEye);
  vFog = clamp((d - 34.0) / 130.0, 0.0, 0.85);
}`;
const FRAG = `
precision mediump float;
varying vec3 vColor; varying vec2 vUV; varying float vTex; varying float vEmis;
varying float vAlpha; varying float vFog;
uniform sampler2D uTex; uniform vec3 uFogColor;
void main() {
  vec3 c = vColor;
  if (vTex > 0.5) { c *= texture2D(uTex, vUV).rgb; }
  c += vec3(1.0, 0.85, 0.55) * vEmis;
  c = mix(c, uFogColor, vFog);
  gl_FragColor = vec4(c, vAlpha);
}`;

function compileShader(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error('shader: ' + gl.getShaderInfoLog(sh));
  }
  return sh;
}

function makeFacadeTexture(gl) {
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 256;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#c9c0ae';
  ctx.fillRect(0, 0, 256, 256);
  // Large windows: 4 columns x 5 rows per tile. One tile spans a wide
  // facade (see Geo.box UV repeats), so windows read at building scale
  // instead of dissolving into a dot grid.
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 4; c++) {
      const lit = (c === 1 && r === 1) || (c === 2 && r === 3);
      ctx.fillStyle = '#8d867a';
      ctx.fillRect(6 + c * 62, 4 + r * 48, 48, 38);
      ctx.fillStyle = lit ? '#ffe9a8' : '#2b313c';
      ctx.fillRect(10 + c * 62, 8 + r * 48, 40, 30);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(10 + c * 62, 8 + r * 48, 40, 4);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    ctx.fillRect(0, r * 48 + 46, 256, 2);
  }
  // Darker ground-floor band.
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fillRect(0, 232, 256, 24);
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.generateMipmap(gl.TEXTURE_2D);
  return tex;
}

// ---- Static city geometry (built once per seed, one draw call) ----
const staticCache = new Map();

function hash2(i, j) {
  let h = (i * 73856093) ^ (j * 19349663);
  h = Math.abs(h % 1000) / 1000;
  return h;
}

function buildStatic(city) {
  const geo = new Geo(1500000);
  const cell = 40; // world units per ground cell = 1 3D unit
  for (let gx = 0; gx < WORLD_W / cell; gx++) {
    for (let gy = 0; gy < WORLD_H / cell; gy++) {
      const cx = gx * cell + cell / 2; const cy = gy * cell + cell / 2;
      let color;
      if (cx < 110) {
        color = [0.20, 0.44, 0.56];
      } else {
        let road = false;
        for (const rx of ROAD_X) if (Math.abs(cx - rx) <= 46) road = true;
        for (const ry of ROAD_Y) if (Math.abs(cy - ry) <= 46) road = true;
        if (road) color = [0.26, 0.25, 0.29];
        else {
          const d = districtAt(cx, cy);
          color = hexRgb(d.ground);
        }
      }
      const v = 0.94 + hash2(gx, gy) * 0.08;
      geo.groundQuad(gx * cell, gy * cell, (gx + 1) * cell, (gy + 1) * cell, 0, [color[0] * v, color[1] * v, color[2] * v]);
    }
  }
  // Centre dashes.
  const dash = [0.91, 0.78, 0.29];
  for (const rx of ROAD_X) {
    for (let y = 20; y < WORLD_H; y += 64) geo.groundQuad(rx - 3, y, rx + 3, y + 30, 0.03, dash);
  }
  for (const ry of ROAD_Y) {
    for (let x = 20; x < WORLD_W; x += 64) geo.groundQuad(x, ry - 3, x + 30, ry + 3, 0.03, dash);
  }
  // Crosswalk strips at intersections.
  const walk = [0.94, 0.94, 0.94];
  for (const rx of ROAD_X) {
    for (const ry of ROAD_Y) {
      for (let i = -2; i <= 2; i++) {
        geo.groundQuad(rx - 40 + i * 16, ry - 58, rx - 32 + i * 16, ry - 44, 0.03, walk);
        geo.groundQuad(rx - 40 + i * 16, ry + 44, rx - 32 + i * 16, ry + 58, 0.03, walk);
      }
    }
  }
  // Garage yard.
  geo.groundQuad(GARAGE.x, GARAGE.y, GARAGE.x + GARAGE.w, GARAGE.y + GARAGE.h, 0.03, [0.48, 0.42, 0.32]);
  // Buildings: flat-shaded boxes with the window facade on their sides.
  for (const b of city.buildings) {
    const w3 = b.w / SCALE; const d3 = b.h / SCALE;
    const h3 = 2 + b.height * 3.0;
    const base = hexRgb(b.color);
    // Vary facade brightness per building so neighbouring blocks do
    // not read as one flat, identical wall.
    const tint = 0.86 + hash2(b.x | 0, b.y | 0) * 0.26;
    const tinted = [base[0] * tint, base[1] * tint, base[2] * tint];
    const cx = wx(b.x + b.w / 2); const cz = wz(b.y + b.h / 2);
    geo.box(cx, h3 / 2, cz, w3, h3, d3, 0, tinted, {
      tex: true, uvU: Math.max(1, Math.round(b.w / 130)), uvV: Math.max(1, Math.round((h3 * SCALE) / 130)),
    });
    // Roof parapet: a thin lighter slab on top.
    geo.box(cx, h3 + 0.12, cz, w3 * 0.96, 0.24, d3 * 0.96, 0, shade(tinted, 1.25), {});
  }
  // Props.
  for (const pr of city.props) {
    const px = wx(pr.x); const pz = wz(pr.y);
    if (pr.kind === 'tree') {
      const s = pr.s;
      geo.box(px, 0.6 * s, pz, 0.22, 1.2 * s, 0.22, 0, [0.35, 0.23, 0.13], {});
      geo.box(px, 1.9 * s, pz, 1.15 * s, 1.15 * s, 1.15 * s, 0.4, [0.20, 0.44, 0.20], {});
      geo.box(px, 2.6 * s, pz, 0.8 * s, 0.7 * s, 0.8 * s, 0.9, [0.30, 0.55, 0.24], {});
    } else if (pr.kind === 'lamp') {
      geo.box(px, 0.9, pz, 0.12, 1.8, 0.12, 0, [0.20, 0.20, 0.24], {});
      geo.box(px, 1.95, pz, 0.34, 0.18, 0.34, 0, [1.0, 0.91, 0.62], { emis: 1 });
    } else if (pr.kind === 'container') {
      const c = hexRgb(pr.color);
      geo.box(px, 0.45, pz, 1.35, 0.9, 0.65, 0.3, c, {});
    } else {
      const c = hexRgb(pr.color);
      geo.box(px, 0.35 * pr.s, pz, 0.55 * pr.s, 0.7 * pr.s, 0.55 * pr.s, 0.5, c, {});
    }
  }
  // Market stalls: base + canopy.
  for (const s of city.stalls) {
    const px = wx(s.x); const pz = wz(s.y);
    const c = hexRgb(s.color);
    geo.box(px, 0.35, pz, 1.15, 0.7, 0.75, 0, shade(c, 0.85), {});
    geo.box(px, 0.95, pz, 1.3, 0.22, 0.9, 0, c, {});
  }
  // Piers over the water + lighthouse + boats (static hulls).
  for (const py of [700, 2100]) {
    geo.box(wx(175), 0.35, wz(py + 8), 3.2, 0.3, 0.4, 0, [0.42, 0.32, 0.22], {});
  }
  geo.box(wx(61), 3.0, wz(1495), 0.65, 6.0, 0.65, 0, [0.91, 0.88, 0.82], {});
  geo.box(wx(61), 2.2, wz(1495), 0.7, 0.5, 0.7, 0, [0.79, 0.29, 0.23], {});
  geo.box(wx(61), 4.2, wz(1495), 0.7, 0.5, 0.7, 0, [0.79, 0.29, 0.23], {});
  geo.box(wx(61), 6.25, wz(1495), 0.5, 0.5, 0.5, 0, [1.0, 0.91, 0.62], { emis: 1 });
  for (let i = 0; i < 4; i++) {
    const bx = 34 + i * 18; const by = 380 + i * 620;
    geo.box(wx(bx), 0.25, wz(by), 1.0, 0.35, 0.35, 0.2, [0.35, 0.23, 0.13], {});
    geo.box(wx(bx), 0.6, wz(by), 0.3, 0.35, 0.3, 0.2, [0.91, 0.88, 0.82], {});
  }
  return { data: geo.a.subarray(0, geo.n), count: geo.n / STRIDE };
}

function getStatic(city) {
  let s = staticCache.get(city.seed);
  if (!s) { s = buildStatic(city); staticCache.set(city.seed, s); }
  return s;
}

// ---- Camera ----
function cameraTarget(state) {
  const p = state.player;
  const driving = !!p.car;
  const heading = driving ? p.car.angle : p.angle;
  return {
    heading,
    dist: driving ? 12.5 : 9.5,
    height: driving ? 5.4 : 4.2,
    ahead: driving ? 5 : 3.5,
  };
}

// Third-person cameras clip into buildings when the player hugs a
// block edge. Walk the eye segment back from the player head and stop
// just before the first building, so the camera never sits inside one.
function clampCameraEye(state, eye, center) {
  const city = state.city;
  const blocked = (wx_, wz_) => {
    const x = wx_ * SCALE + OX; const y = wz_ * SCALE + OZ;
    for (const b of city.buildings) {
      if (x > b.x - 30 && x < b.x + b.w + 30 && y > b.y - 30 && y < b.y + b.h + 30) return true;
    }
    return false;
  };
  for (let i = 0; i <= 16; i++) {
    const t = 1 - i / 16;
    const px = center[0] + (eye[0] - center[0]) * t;
    const py = center[1] + (eye[1] - center[1]) * t;
    const pz = center[2] + (eye[2] - center[2]) * t;
    if (!blocked(px, pz)) {
      // If the camera had to come in close, lift it so the view opens up.
      const lift = (1 - t) * 3.5;
      return [px, Math.max(py + lift, 2.6), pz];
    }
  }
  return [center[0], center[1] + 5, center[2]];
}

function instantCam(state, aspect) {
  const p = state.player;
  const t = cameraTarget(state);
  const fx = Math.cos(t.heading); const fz = Math.sin(t.heading);
  const px = wx(p.x); const pz = wz(p.y);
  const eye = [px - fx * t.dist, t.height, pz - fz * t.dist];
  const center = [px + fx * t.ahead, 1.6, pz + fz * t.ahead];
  const view = matLookAt(eye, center, [0, 1, 0]);
  const proj = matPerspective((55 * Math.PI) / 180, aspect, 0.5, 500);
  return { eye, center, view, proj, vp: matMul(proj, view), yaw: t.heading };
}

// The last view/projection used, so aiming can unproject the mouse.
let lastVP = null;

export function screenToGround(state, sx, sy, vw, vh) {
  let cam = lastVP;
  if (!cam) {
    const aspect = vw / Math.max(1, vh);
    const c = instantCam(state, aspect);
    cam = { view: c.view, proj: c.proj, vp: c.vp, vw, vh };
  }
  const inv = matInvert(cam.vp);
  if (!inv) return null;
  const ndcX = (sx / cam.vw) * 2 - 1;
  const ndcY = 1 - (sy / cam.vh) * 2;
  const unproject = (z) => {
    const v = [ndcX, ndcY, z, 1];
    const x = inv[0] * v[0] + inv[4] * v[1] + inv[8] * v[2] + inv[12] * v[3];
    const y = inv[1] * v[0] + inv[5] * v[1] + inv[9] * v[2] + inv[13] * v[3];
    const w = inv[2] * v[0] + inv[6] * v[1] + inv[10] * v[2] + inv[14] * v[3];
    const ww = inv[3] * v[0] + inv[7] * v[1] + inv[11] * v[2] + inv[15] * v[3];
    return [x / ww, y / ww, w / ww];
  };
  const near = unproject(-1); const far = unproject(1);
  const dx = far[0] - near[0]; const dy = far[1] - near[1]; const dz = far[2] - near[2];
  if (Math.abs(dy) < 1e-6) return null;
  const t = -near[1] / dy;
  if (t < 0) return null;
  const gx = near[0] + dx * t; const gz = near[2] + dz * t;
  return { x: gx * SCALE + OX, y: gz * SCALE + OZ };
}

// ---- GL setup ----
export function initGL(canvas) {
  const gl = canvas.getContext('webgl', { antialias: true, preserveDrawingBuffer: true, alpha: false })
    || canvas.getContext('experimental-webgl', { antialias: true, preserveDrawingBuffer: true, alpha: false });
  if (!gl) throw new Error('WebGL is not available in this browser.');
  const prog = gl.createProgram();
  gl.attachShader(prog, compileShader(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compileShader(gl, gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('program: ' + gl.getProgramInfoLog(prog));
  gl.useProgram(prog);
  const loc = {};
  for (const name of ['aPos', 'aNormal', 'aColor', 'aUV', 'aTex', 'aEmis', 'aAlpha']) {
    loc[name] = gl.getAttribLocation(prog, name);
  }
  for (const name of ['uVP', 'uEye', 'uSunDir', 'uNight', 'uFogColor', 'uTex']) {
    loc[name] = gl.getUniformLocation(prog, name);
  }
  const tex = makeFacadeTexture(gl);
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  gl.clearDepth(1);
  const state = {
    gl, prog, loc, tex,
    staticBuf: gl.createBuffer(),
    dynBuf: gl.createBuffer(),
    transBuf: gl.createBuffer(),
    staticUploaded: new Map(),
    dyn: new Geo(420000),
    trans: new Geo(120000),
    cam: { yaw: 0, eye: [0, 8, 0], center: [0, 0, 0], state: null, lastT: 0 },
    canvas,
  };
  return state;
}

function bindAttribs(gl, loc, buf) {
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  const B = STRIDE * 4;
  const set = (l, size, off) => {
    gl.enableVertexAttribArray(l);
    gl.vertexAttribPointer(l, size, gl.FLOAT, false, B, off * 4);
  };
  set(loc.aPos, 3, 0); set(loc.aNormal, 3, 3); set(loc.aColor, 3, 6);
  set(loc.aUV, 2, 9); set(loc.aTex, 1, 11); set(loc.aEmis, 1, 12); set(loc.aAlpha, 1, 13);
}

function uploadStatic(glState, city) {
  const gl = glState.gl;
  if (glState.staticUploaded.has(city.seed)) return glState.staticUploaded.get(city.seed);
  const s = getStatic(city);
  gl.bindBuffer(gl.ARRAY_BUFFER, glState.staticBuf);
  gl.bufferData(gl.ARRAY_BUFFER, s.data, gl.STATIC_DRAW);
  const rec = { count: s.count };
  glState.staticUploaded.set(city.seed, rec);
  return rec;
}

// ---- Dynamic objects (rebuilt every frame) ----
function drawCar(geo, trans, car, isPlayer, time, nightF, flash) {
  const cx = wx(car.x); const cz = wz(car.y);
  const base = hexRgb(car.color);
  // Ground shadow.
  trans.quad(
    [cx - 0.8, 0.05, cz - 0.45], [cx + 0.8, 0.05, cz - 0.45], [cx + 0.8, 0.05, cz + 0.45], [cx - 0.8, 0.05, cz + 0.45],
    [0, 1, 0], [0, 0, 0], [[0, 0], [1, 0], [1, 1], [0, 1]], 0, 0, 0.28);
  // Body + cabin + wheels.
  geo.box(cx, 0.38, cz, 1.35, 0.5, 0.68, car.angle, base, { uvU: 1, uvV: 1 });
  geo.box(cx + Math.cos(car.angle) * 0.08, 0.78, cz + Math.sin(car.angle) * 0.08, 0.72, 0.42, 0.6, car.angle, [0.10, 0.14, 0.20], {});
  const glass = [0.55, 0.75, 0.88];
  geo.box(cx + Math.cos(car.angle) * 0.42, 0.78, cz + Math.sin(car.angle) * 0.42, 0.06, 0.3, 0.5, car.angle, glass, {});
  for (const [lx, lz] of [[-0.45, -0.36], [-0.45, 0.36], [0.45, -0.36], [0.45, 0.36]]) {
    const c = Math.cos(car.angle); const s = Math.sin(car.angle);
    geo.box(cx + lx * c - lz * s, 0.18, cz + lx * s + lz * c, 0.26, 0.36, 0.12, car.angle, [0.08, 0.08, 0.10], {});
  }
  // Headlights (emissive) and tail lights.
  const fx = Math.cos(car.angle); const fz = Math.sin(car.angle);
  const rx = -fz; const rz = fx;
  for (const side of [-1, 1]) {
    geo.box(cx + fx * 0.68 + rx * side * 0.24, 0.42, cz + fz * 0.68 + rz * side * 0.24, 0.06, 0.12, 0.12, car.angle, [1.0, 0.97, 0.78], { emis: 1 });
    geo.box(cx - fx * 0.68 + rx * side * 0.24, 0.42, cz - fz * 0.68 + rz * side * 0.24, 0.06, 0.12, 0.12, car.angle, car.braking ? [1, 0.15, 0.1] : [0.85, 0.3, 0.25], { emis: car.braking ? 1 : 0.4 });
  }
  if (car.kind === 'police') {
    geo.box(cx, 0.52, cz, 0.9, 0.14, 0.7, car.angle, [0.16, 0.29, 0.54], {});
    // Flashing light bar.
    const left = flash ? [1, 0.2, 0.15] : [0.2, 0.45, 1];
    const right = flash ? [0.2, 0.45, 1] : [1, 0.2, 0.15];
    geo.box(cx - 0.14, 1.06, cz, 0.24, 0.1, 0.5, car.angle, left, { emis: 1 });
    geo.box(cx + 0.14, 1.06, cz, 0.24, 0.1, 0.5, car.angle, right, { emis: 1 });
  }
  if (isPlayer) {
    geo.ring(cx, cz, 0.07, 0.85, 1.05, [1, 0.82, 0.24], 0.95);
  }
  // Headlight beams on the ground after dusk.
  if (nightF > 0.25) {
    const bx = cx + fx * 1.6; const bz = cz + fz * 1.6;
    const ex = cx + fx * 5.2; const ez = cz + fz * 5.2;
    const w0 = 0.32; const w1 = 1.1;
    trans.quad(
      [bx - rx * w0, 0.06, bz - rz * w0], [bx + rx * w0, 0.06, bz + rz * w0],
      [ex + rx * w1, 0.06, ez + rz * w1], [ex - rx * w1, 0.06, ez - rz * w1],
      [0, 1, 0], [1, 0.96, 0.78], [[0, 0], [1, 0], [1, 1], [0, 1]], 0, 0, 0.20 * nightF);
  }
}

function drawCharacter(geo, trans, x, y, angle, shirt, skin, opt = {}) {
  const cx = wx(x); const cz = wz(y);
  const bob = opt.bob || 0;
  trans.quad(
    [cx - 0.3, 0.05, cz - 0.3], [cx + 0.3, 0.05, cz - 0.3], [cx + 0.3, 0.05, cz + 0.3], [cx - 0.3, 0.05, cz + 0.3],
    [0, 1, 0], [0, 0, 0], [[0, 0], [1, 0], [1, 1], [0, 1]], 0, 0, 0.25);
  const s = hexRgb(shirt); const sk = hexRgb(skin);
  // Legs, torso, head.
  geo.box(cx - 0.11, 0.28 + bob * 0.03, cz, 0.18, 0.56, 0.2, angle, [0.16, 0.17, 0.24], {});
  geo.box(cx + 0.11, 0.28 - bob * 0.03, cz, 0.18, 0.56, 0.2, angle, [0.16, 0.17, 0.24], {});
  geo.box(cx, 0.92 + bob, cz, 0.52, 0.62, 0.3, angle, s, {});
  geo.box(cx, 1.48 + bob, cz, 0.34, 0.34, 0.34, angle, sk, {});
  if (opt.aimAngle !== undefined) {
    const ax = cx + Math.cos(opt.aimAngle) * 0.42; const az = cz + Math.sin(opt.aimAngle) * 0.42;
    geo.box(ax, 1.0 + bob, az, 0.42, 0.1, 0.1, opt.aimAngle, [0.12, 0.12, 0.14], {});
  }
  if (opt.ring) geo.ring(cx, cz, 0.07, 0.55, 0.72, opt.ring, 0.95);
  if (opt.healthBar !== undefined && opt.healthBar < 100) {
    // Health bar floating above the head, facing the camera via billboard.
    const right = opt.camRight || [1, 0, 0];
    geo.billboard([cx, 1.95 + bob, cz], 0.8, 0.1, right, [0.35, 0.08, 0.08], 0.95);
    geo.billboard([cx - (1 - opt.healthBar / 100) * 0.4, 1.95 + bob, cz], 0.8 * (opt.healthBar / 100), 0.1, right, [1, 0.3, 0.25], 0.95);
  }
}

function drawHelicopter(geo, trans, h, time, camRight) {
  const cx = wx(h.x); const cz = wz(h.y);
  // Lower altitude and a hover near the road centreline keep the
  // body inside the third-person frame against the open sky (the HUD
  // tracker/banner moved off the top centre for the same reason).
  // A bigger body scale makes it read at chase distance.
  const alt = 6.8;
  const k = 1.6; // body scale
  const body = [0.22, 0.40, 0.52];
  geo.box(cx, alt, cz, 2.4 * k, 0.85 * k, 1.0 * k, h.angle * 0.15, body, {});
  geo.box(cx - Math.cos(h.angle * 0.15) * 1.9 * k, alt + 0.1, cz - Math.sin(h.angle * 0.15) * 1.9 * k, 1.5 * k, 0.3 * k, 0.3 * k, h.angle * 0.15, body, {});
  geo.box(cx + Math.cos(h.angle * 0.15) * 0.7 * k, alt + 0.1, cz + Math.sin(h.angle * 0.15) * 0.7 * k, 0.5 * k, 0.5 * k, 0.7 * k, h.angle * 0.15, [0.55, 0.75, 0.88], {});
  // Rotor, spinning. Short blades, kept inside the body's silhouette:
  // a full-length blade swept up across the wanted stars in the
  // chase frame.
  const ra = h.rotor;
  geo.box(cx, alt + 0.62 * k, cz, 1.2 * k, 0.07, 0.14, ra, [0.1, 0.1, 0.12], {});
  geo.box(cx, alt + 0.62 * k, cz, 0.14, 0.07, 1.2 * k, ra, [0.1, 0.1, 0.12], {});
  // Skids.
  geo.box(cx - 0.3 * k, alt - 0.62 * k, cz, 1.6 * k, 0.08, 0.08, h.angle * 0.15, [0.15, 0.15, 0.17], {});
  geo.box(cx + 0.3 * k, alt - 0.62 * k, cz, 1.6 * k, 0.08, 0.08, h.angle * 0.15, [0.15, 0.15, 0.17], {});
  // Searchlight cone + ground pool: narrower and a touch softer now
  // that the helicopter flies lower, so the beam reads without
  // washing out the street.
  const lx = wx(h.lightX); const lz = wz(h.lightY);
  trans.cone([cx, alt - 0.3, cz], [lx, 0.1, lz], 1.8, [1, 0.96, 0.78], 0.20, 10);
  trans.quad(
    [lx - 1.9, 0.08, lz - 1.1], [lx + 1.9, 0.08, lz - 1.1], [lx + 1.9, 0.08, lz + 1.1], [lx - 1.9, 0.08, lz + 1.1],
    [0, 1, 0], [1, 0.96, 0.78], [[0, 0], [1, 0], [1, 1], [0, 1]], 0, 0, 0.30);
  // Shadow blob on the ground.
  trans.quad(
    [lx - 1.2, 0.06, lz - 0.5], [lx + 1.2, 0.06, lz - 0.5], [lx + 1.2, 0.06, lz + 0.5], [lx - 1.2, 0.06, lz + 0.5],
    [0, 1, 0], [0, 0, 0], [[0, 0], [1, 0], [1, 1], [0, 1]], 0, 0, 0.18);
}

function buildDynamic(glState, state, cam) {
  const geo = glState.dyn; const trans = glState.trans;
  geo.reset(); trans.reset();
  const time = state.time;
  const nightF = Math.max(0, Math.min(1, (state.clockMin - 1110) / 45));
  const flash = Math.floor(time * 6) % 2 === 0;
  const camRight = cam.right;
  // Ferry on its route (same route the 2D renderer used).
  const ferryY = 120 + ((time * 24) % 2760);
  geo.box(wx(55), 0.3, wz(ferryY + 11), 1.8, 0.5, 0.55, 0, [0.16, 0.29, 0.42], {});
  geo.box(wx(55), 0.7, wz(ferryY + 11), 1.2, 0.35, 0.4, 0, [1, 0.91, 0.66], { emis: 0.5 });
  // Lighthouse beam: a rotating translucent cone over the water.
  const beamA = time * 0.55;
  trans.cone([wx(61), 6.5, wz(1436)], [wx(61) + Math.cos(beamA) * 8, 0.2, wz(1436) + Math.sin(beamA) * 8], 1.6, [1, 0.96, 0.78], 0.16, 8);
  // Roadblock cones.
  if (state.roadblock) {
    const rb = state.roadblock;
    const spots = rb.horizontal
      ? [[rb.x - 90, rb.y - 40], [rb.x + 90, rb.y + 40], [rb.x - 90, rb.y + 40], [rb.x + 90, rb.y - 40]]
      : [[rb.x - 40, rb.y - 90], [rb.x + 40, rb.y + 90], [rb.x + 40, rb.y - 90], [rb.x - 40, rb.y + 90]];
    for (const [cx, cy] of spots) {
      trans.cone([wx(cx), 0.42, wz(cy)], [wx(cx), 0.02, wz(cy)], 0.16, [1, 0.48, 0.1], 1, 6);
    }
    for (const car of rb.cars) drawCar(geo, trans, car, false, time, nightF, flash);
  }
  for (const car of state.parked) drawCar(geo, trans, car, false, time, nightF, flash);
  for (const car of state.traffic) drawCar(geo, trans, car, false, time, nightF, flash);
  for (const car of state.police) drawCar(geo, trans, car, false, time, nightF, flash);
  if (state.player.car) drawCar(geo, trans, state.player.car, true, time, nightF, flash);
  // Crew at the garage yard + the companion.
  for (const npc of state.crewNpcs || []) {
    drawCharacter(geo, trans, npc.x, npc.y, 0, npc.color, '#e8b98a', { camRight });
    geo.ring(wx(npc.x), wz(npc.y), 0.07, 0.5, 0.65, hexRgb(npc.color), 0.8);
  }
  if (state.companion?.active) {
    drawCharacter(geo, trans, state.companion.x, state.companion.y, state.player.angle, state.companion.color, '#e8b98a', { camRight });
  }
  // Pedestrians + guards.
  for (const ped of state.peds) {
    if (ped.health <= 0 && ped.guard) continue;
    const bob = ped.state === 'walk' ? Math.sin(time * 8 + ped.x) * 0.04 : 0;
    drawCharacter(geo, trans, ped.x, ped.y, ped.angle, ped.shirt, ped.skin, {
      bob, camRight,
      aimAngle: ped.guard ? ped.angle : undefined,
      ring: ped.guard ? [1, 0.23, 0.16] : undefined,
      healthBar: ped.guard ? ped.health : undefined,
    });
  }
  // The player on foot.
  const p = state.player;
  if (p.onFoot) {
    const bob = Math.sin(time * 8) * 0.04;
    drawCharacter(geo, trans, p.x, p.y, p.angle, '#e8493a', '#e8b98a', {
      bob, camRight, aimAngle: p.aimAngle, ring: [1, 0.82, 0.24],
    });
    if (state.muzzle > 0) {
      const mx = wx(p.x + Math.cos(p.aimAngle) * 26); const mz = wz(p.y + Math.sin(p.aimAngle) * 26);
      geo.box(mx, 1.0, mz, 0.22, 0.22, 0.22, 0, [1, 0.91, 0.54], { emis: 1 });
    }
  }
  // Pickups: spinning crates.
  for (const pk of state.pickups) {
    if (pk.taken) continue;
    const pulse = 1 + Math.sin(time * 4 + pk.x) * 0.15;
    const c = pk.kind === 'health' ? [0.18, 0.68, 0.29] : [0.16, 0.48, 0.91];
    geo.box(wx(pk.x), 0.45, wz(pk.y), 0.55 * pulse, 0.55 * pulse, 0.55 * pulse, time * 2, c, { emis: 0.5 });
  }
  // Mission marker: floating gold diamond + light beam + ground ring.
  const step = currentStep(state);
  if (step && !state.missionDone) {
    const mx = wx(step.x); const mz = wz(step.y);
    const bobY = 3.2 + Math.sin(time * 3) * 0.3;
    trans.cone([mx, bobY + 0.55, mz], [mx, bobY, mz], 0.42, [1, 0.82, 0.24], 1, 4, Math.PI / 4);
    trans.cone([mx, bobY, mz], [mx, bobY - 0.55, mz], 0.42, [1, 0.82, 0.24], 1, 4, Math.PI / 4);
    trans.quad(
      [mx - 0.35, 0.06, mz - 3.2], [mx + 0.35, 0.06, mz - 3.2], [mx + 0.35, 0.06, mz + 3.2], [mx - 0.35, 0.06, mz + 3.2],
      [0, 1, 0], [1, 0.82, 0.24], [[0, 0], [1, 0], [1, 1], [0, 1]], 0, 0, 0.14);
    trans.quad(
      [mx - 3.2, 0.06, mz - 0.35], [mx + 3.2, 0.06, mz - 0.35], [mx + 3.2, 0.06, mz + 0.35], [mx - 3.2, 0.06, mz + 0.35],
      [0, 1, 0], [1, 0.82, 0.24], [[0, 0], [1, 0], [1, 1], [0, 1]], 0, 0, 0.14);
    geo.ring(mx, mz, 0.07, 0.9, 1.15, [1, 0.82, 0.24], 0.9);
  }
  // Bullets: short tracer boxes at chest height.
  for (const b of state.bullets) {
    const a = Math.atan2(b.vy, b.vx);
    geo.box(wx(b.x), 1.0, wz(b.y), 0.5, 0.08, 0.08, a, b.hostile ? [1, 0.54, 0.42] : [1, 0.91, 0.54], { emis: 1 });
  }
  // Sparks / smoke / fire.
  for (const s of state.sparks) {
    const a = Math.max(0, Math.min(1, (s.life || 0.5) * 2));
    const c = hexRgb(s.color.startsWith('#') ? s.color : '#ffd76a');
    geo.box(wx(s.x), 0.9, wz(s.y), 0.18, 0.18, 0.18, 0, c, { alpha: a });
  }
  // Helicopter last (highest).
  if (state.helicopter) drawHelicopter(geo, trans, state.helicopter, time, camRight);
}

// ---- Frame render ----
export function drawGLScene(glState, state, opts = {}) {
  const gl = glState.gl;
  const canvas = glState.canvas;
  const aspect = canvas.width / Math.max(1, canvas.height);
  const nightF = Math.max(0, Math.min(1, (state.clockMin - 1110) / 45));
  // Camera: snap on a new state object or when asked; otherwise smooth.
  const now = (typeof performance !== 'undefined' ? performance.now() : 0);
  const cam = glState.cam;
  let eye, center, yaw;
  if (opts.cinematic) {
    const a = now / 1000 * 0.06;
    eye = [Math.cos(a) * 58, 30, Math.sin(a) * 58];
    center = [0, 0, 0];
    yaw = a + Math.PI / 2;
  } else {
    const inst = instantCam(state, aspect);
    if (cam.state !== state || opts.snap) {
      cam.yaw = inst.yaw; cam.eye = inst.eye.slice(); cam.center = inst.center.slice();
      cam.state = state; cam.lastT = now;
    } else {
      const dt = Math.max(0, Math.min(0.1, (now - cam.lastT) / 1000));
      cam.lastT = now;
      const fYaw = 1 - Math.exp(-3.5 * dt);
      let d = inst.yaw - cam.yaw;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      cam.yaw += d * fYaw;
      const fPos = 1 - Math.exp(-4.5 * dt);
      for (let i = 0; i < 3; i++) {
        cam.eye[i] += (inst.eye[i] - cam.eye[i]) * fPos;
        cam.center[i] += (inst.center[i] - cam.center[i]) * fPos;
      }
    }
    eye = cam.eye.slice(); center = cam.center.slice(); yaw = cam.yaw;
    // Camera shake on hard crashes.
    if (state.shake > 0) {
      eye[0] += Math.sin(state.time * 47) * state.shake * 0.35;
      eye[1] += Math.cos(state.time * 39) * state.shake * 0.25;
    }
    // Never let the eye sit inside a building (hugging a block edge).
    eye = clampCameraEye(state, eye, center);
  }
  const view = matLookAt(eye, center, [0, 1, 0]);
  const proj = matPerspective((55 * Math.PI) / 180, aspect, 0.5, 500);
  const vp = matMul(proj, view);
  const right = [Math.cos(yaw + Math.PI / 2), 0, Math.sin(yaw + Math.PI / 2)];
  lastVP = { view, proj, vp, vw: state.camera.w, vh: state.camera.h };
  // Sky + fog colours slide from dusk into night.
  const sky = [0.93 - 0.80 * nightF, 0.60 - 0.48 * nightF, 0.42 - 0.22 * nightF];
  const fog = [0.88 - 0.76 * nightF, 0.58 - 0.46 * nightF, 0.44 - 0.24 * nightF];
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(sky[0], sky[1], sky[2], 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.useProgram(glState.prog);
  gl.uniformMatrix4fv(glState.loc.uVP, false, vp);
  gl.uniform3f(glState.loc.uEye, eye[0], eye[1], eye[2]);
  gl.uniform3f(glState.loc.uSunDir, -0.55, 0.62, -0.35);
  gl.uniform1f(glState.loc.uNight, nightF);
  gl.uniform3f(glState.loc.uFogColor, fog[0], fog[1], fog[2]);
  gl.uniform1i(glState.loc.uTex, 0);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, glState.tex);
  // Static city.
  const stat = uploadStatic(glState, state.city);
  bindAttribs(gl, glState.loc, glState.staticBuf);
  gl.disable(gl.BLEND);
  gl.depthMask(true);
  gl.drawArrays(gl.TRIANGLES, 0, stat.count);
  // Dynamic opaque.
  buildDynamic(glState, state, { right, yaw });
  gl.bindBuffer(gl.ARRAY_BUFFER, glState.dynBuf);
  gl.bufferData(gl.ARRAY_BUFFER, glState.dyn.a.subarray(0, glState.dyn.n), gl.DYNAMIC_DRAW);
  bindAttribs(gl, glState.loc, glState.dynBuf);
  gl.drawArrays(gl.TRIANGLES, 0, glState.dyn.n / STRIDE);
  // Transparent: beams, cones, shadows, glows.
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.depthMask(false);
  gl.bindBuffer(gl.ARRAY_BUFFER, glState.transBuf);
  gl.bufferData(gl.ARRAY_BUFFER, glState.trans.a.subarray(0, glState.trans.n), gl.DYNAMIC_DRAW);
  bindAttribs(gl, glState.loc, glState.transBuf);
  gl.drawArrays(gl.TRIANGLES, 0, glState.trans.n / STRIDE);
  gl.depthMask(true);
  gl.disable(gl.BLEND);
  return { eye, center, yaw, right, nightF };
}
