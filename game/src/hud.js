// The HUD: health/armour bars, cash and respect, the wanted stars,
// the mission tracker (full text, wrapped, never truncated), weapon
// slots, speed/clock/district/radio, crew abilities and hints. All text
// is large enough to read when the frame is shrunk to 768x480, and no
// panel overlaps another.
import { WEAPONS, RADIO_STATIONS, CREW } from './config.js';
import { wrapText, clamp } from './util.js';
import { currentStep } from './missions.js';
import { drawMinimap } from './minimap.js';

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(12, 14, 22, 0.78)';
  ctx.strokeStyle = 'rgba(255, 214, 106, 0.45)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 10);
  ctx.fill();
  ctx.stroke();
}

function bar(ctx, x, y, w, h, frac, color, bg) {
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w * clamp(frac, 0, 1), h);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.strokeRect(x, y, w, h);
}

function stars(ctx, cx, y, wanted) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  for (let i = 0; i < 5; i++) {
    ctx.font = '34px system-ui, sans-serif';
    ctx.fillStyle = i < wanted ? '#ffd23e' : 'rgba(220,220,220,0.55)';
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.lineWidth = 3;
    const sx = cx + (i - 2) * 40;
    ctx.strokeText('★', sx, y);
    ctx.fillText('★', sx, y);
  }
}

export function drawHud(ctx, state, vw, vh) {
  const p = state.player;
  ctx.textBaseline = 'alphabetic';

  // --- Top left: survival + progression.
  panel(ctx, 14, 12, 268, 118);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 17px system-ui, sans-serif';
  ctx.fillText('SEHAT', 26, 38);
  bar(ctx, 96, 24, 172, 15, p.health / 100, '#39d353', '#3a1520');
  ctx.fillText('ROMPI', 26, 62);
  bar(ctx, 96, 48, 172, 15, p.armor / 100, '#4aa8ff', '#152033');
  ctx.font = 'bold 24px system-ui, sans-serif';
  ctx.fillStyle = '#ffd76a';
  ctx.fillText(`$${p.cash}`, 26, 100);
  ctx.fillStyle = '#7ac2ff';
  ctx.fillText(`Hormat ${p.respect}`, 138, 100);
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`Misi selesai ${state.completedMissions}/8`, 26, 122);

  // --- Top centre: wanted stars + mission tracker.
  const trackerW = Math.min(660, vw - 560);
  const trackerX = (vw - trackerW) / 2;
  stars(ctx, vw / 2, 44, state.wanted);
  if (state.wanted > 0) {
    ctx.font = 'bold 19px system-ui, sans-serif';
    ctx.fillStyle = '#ff6a5a';
    ctx.textAlign = 'center';
    ctx.fillText('DICARI PTS', vw / 2, 68);
  }
  const step = currentStep(state);
  if (state.mission && step) {
    ctx.font = 'bold 19px system-ui, sans-serif';
    const title = `Misi ${state.mission.id}/8: ${state.mission.title}  •  ${state.mission.giver}`;
    const lines = wrapText(ctx, step.label, trackerW - 28);
    const th = 34 + lines.length * 24 + 12;
    const ty = state.wanted > 0 ? 74 : 56;
    panel(ctx, trackerX, ty, trackerW, th);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffd76a';
    ctx.fillText('◆ ' + title, trackerX + 14, ty + 24);
    ctx.fillStyle = '#ffffff';
    ctx.font = '19px system-ui, sans-serif';
    lines.forEach((line, i) => ctx.fillText(line, trackerX + 14, ty + 48 + i * 24));
    state._missionBottom = ty + th;
  } else if (state.completedMissions >= 8) {
    panel(ctx, trackerX, 56, trackerW, 40);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd76a';
    ctx.font = 'bold 19px system-ui, sans-serif';
    ctx.fillText('SEMUA MISI SELESAI — Teluk Senja bebas!', vw / 2, 82);
  }

  // --- Centre message banner (below the tracker, never overlapping it).
  if (state.messageTimer > 0 && state.message) {
    ctx.font = '19px system-ui, sans-serif';
    const mw = Math.min(760, vw - 80);
    const mlines = wrapText(ctx, state.message, mw - 30);
    const mh = mlines.length * 24 + 18;
    const my = (state._missionBottom || 150) + 10;
    panel(ctx, (vw - mw) / 2, my, mw, mh);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    mlines.forEach((line, i) => ctx.fillText(line, (vw - mw) / 2 + 15, my + 24 + i * 24));
  }

  // --- Top right: minimap + district.
  const mw2 = 212; const mh2 = 158;
  drawMinimap(ctx, state, vw - mw2 - 14, 12, mw2, mh2);
  ctx.textAlign = 'right';
  ctx.font = 'bold 18px system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(state.district || 'Kota Tua', vw - 16, 192);

  // --- Bottom left: weapon slots, speed, clock, radio.
  const bw = 330;
  panel(ctx, 14, vh - 128, bw, 114);
  ctx.textAlign = 'left';
  ctx.font = 'bold 16px system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('SENJATA', 26, vh - 104);
  WEAPONS.forEach((w, i) => {
    const bx = 26 + i * 104; const by = vh - 96;
    ctx.fillStyle = i === p.weaponIndex ? 'rgba(255, 214, 106, 0.35)' : 'rgba(255,255,255,0.10)';
    ctx.fillRect(bx, by, 96, 34);
    ctx.strokeStyle = i === p.weaponIndex ? '#ffd76a' : 'rgba(255,255,255,0.4)';
    ctx.strokeRect(bx, by, 96, 34);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.fillText(`${i + 1} ${w.name}`, bx + 7, by + 22);
  });
  const hours = Math.floor(state.clockMin / 60) % 24;
  const mins = Math.floor(state.clockMin % 60);
  const clock = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  const speed = p.car ? Math.round(Math.abs(p.car.speed) * 0.55) : 0;
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`${speed} km/j`, 26, vh - 34);
  ctx.fillText(clock, 140, vh - 34);
  ctx.fillStyle = RADIO_STATIONS[state.radioStation].hue;
  ctx.fillText('♪ ' + RADIO_STATIONS[state.radioStation].name, 214, vh - 34);

  // --- Bottom right: crew, garage and controls.
  const cw = 372;
  panel(ctx, vw - cw - 14, vh - 128, cw, 114);
  ctx.textAlign = 'left';
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  const sinta = state.crewCooldowns.sinta > 0 ? `Q Sinta (${Math.ceil(state.crewCooldowns.sinta)}s)` : 'Q Sinta: pengalih PTS';
  const dodi = state.crewCooldowns.dodi > 0 ? `F Bang Dodi (${Math.ceil(state.crewCooldowns.dodi)}s)` : 'F Bang Dodi: bengkel';
  ctx.fillText(sinta, vw - cw, vh - 104);
  ctx.fillText(dodi, vw - cw, vh - 82);
  ctx.fillStyle = '#ffd76a';
  ctx.fillText('G: garasi (di halaman bengkel)', vw - cw, vh - 60);
  ctx.fillStyle = '#cfd6e4';
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillText('WASD gerak/nyetir · E naik-turun mobil · Klik tembak', vw - cw, vh - 38);
  ctx.fillText('1/2/3 senjata · R radio · Shift lari · P jeda', vw - cw, vh - 20);
}
