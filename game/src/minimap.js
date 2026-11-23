// The live minimap: the whole city shrunk into a panel, always
// populated — roads, buildings, the mission marker, the player, police,
// traffic, guards, the helicopter and the garage.
import { WORLD_W, WORLD_H, ROAD_X, ROAD_Y, DISTRICTS } from './config.js';
import { currentStep } from './missions.js';
import { GARAGE } from './game.js';

export function drawMinimap(ctx, state, x, y, w, h) {
  const sx = w / WORLD_W; const sy = h / WORLD_H;
  ctx.save();
  ctx.fillStyle = 'rgba(10, 12, 20, 0.88)';
  ctx.strokeStyle = '#ffd76a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();

  // District ground tints.
  for (const d of DISTRICTS) {
    ctx.fillStyle = d.id === 'pelabuhan' ? '#6a5a44' : d.id === 'pasar' ? '#6a5a3a' : d.id === 'bukit' ? '#3a4a55' : '#554a3a';
    ctx.fillRect(x + d.x0 * sx, y + d.y0 * sy, (d.x1 - d.x0) * sx, (d.y1 - d.y0) * sy);
  }
  // Roads.
  ctx.strokeStyle = 'rgba(230, 220, 190, 0.55)';
  ctx.lineWidth = 2;
  for (const rx of ROAD_X) { ctx.beginPath(); ctx.moveTo(x + rx * sx, y); ctx.lineTo(x + rx * sx, y + h); ctx.stroke(); }
  for (const ry of ROAD_Y) { ctx.beginPath(); ctx.moveTo(x, y + ry * sy); ctx.lineTo(x + w, y + ry * sy); ctx.stroke(); }
  // Buildings, faint.
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  for (const b of state.city.buildings) {
    ctx.fillRect(x + b.x * sx, y + b.y * sy, Math.max(1.5, b.w * sx), Math.max(1.5, b.h * sy));
  }
  const dot = (wx, wy, r, color) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x + wx * sx, y + wy * sy, r, 0, Math.PI * 2);
    ctx.fill();
  };
  // Traffic and parked cars.
  for (const car of state.traffic) dot(car.x, car.y, 1.8, '#9aa4b8');
  for (const car of state.parked) dot(car.x, car.y, 1.6, '#c8c8c8');
  // Guards.
  for (const ped of state.peds) {
    if (ped.guard && ped.health > 0) dot(ped.x, ped.y, 2.6, '#ff5a4a');
  }
  // Garage.
  ctx.fillStyle = '#ff9a3a';
  ctx.fillRect(x + GARAGE.x * sx - 3, y + GARAGE.y * sy - 3, 7, 7);
  // Mission marker, pulsing.
  const step = currentStep(state);
  if (step) {
    const pulse = 4 + Math.sin(state.time * 5) * 1.5;
    ctx.fillStyle = '#ffd23e';
    ctx.save();
    ctx.translate(x + step.x * sx, y + step.y * sy);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-pulse / 2, -pulse / 2, pulse, pulse);
    ctx.restore();
  }
  // Police.
  for (const car of state.police) dot(car.x, car.y, 3, '#4aa8ff');
  // Helicopter searchlight cone, drawn on the minimap too.
  if (state.helicopter) {
    const hx = x + state.helicopter.x * sx; const hy = y + state.helicopter.y * sy;
    const lx = x + state.helicopter.lightX * sx; const ly = y + state.helicopter.lightY * sy;
    ctx.save();
    ctx.globalAlpha = 0.30;
    ctx.fillStyle = '#fff6c8';
    ctx.beginPath();
    ctx.moveTo(hx, hy);
    ctx.lineTo(lx - 7, ly);
    ctx.lineTo(lx + 7, ly);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  // Helicopter.
  if (state.helicopter) {
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('H', x + state.helicopter.x * sx, y + state.helicopter.y * sy + 4);
  }
  // Player, ringed and on top.
  const px = x + state.player.x * sx; const py = y + state.player.y * sy;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(px, py, 5.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(px, py - 5);
  ctx.lineTo(px + 4, py + 4);
  ctx.lineTo(px - 4, py + 4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Frame label.
  ctx.fillStyle = '#ffd76a';
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('N ↑  TELUK SENJA', x + 6, y + 13);
}
