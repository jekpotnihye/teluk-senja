// Drawing only: the world, the dusk light, the helicopter, the HUD and
// the menu screens. The camera shows a 1280x720 window onto the city;
// the canvas is scaled to the browser window.
import { WORLD_W, WORLD_H, ROAD_X, ROAD_Y, DISTRICTS, districtAt, WEAPONS } from './config.js';
import { drawHud } from './hud.js';
import { currentStep } from './missions.js';
import { GARAGE } from './game.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_BUSTED = 'busted';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(window.innerWidth * ratio);
    canvas.height = Math.round(window.innerHeight * ratio);
    canvas.style.width = '100%';
    canvas.style.height = '100%';
  }

  function drawCarShape(car, isPlayer, time, nightF) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    // Headlight beams after dusk.
    if ((nightF || 0) > 0.25) {
      ctx.save();
      ctx.globalAlpha = 0.16 * nightF;
      ctx.fillStyle = '#fff6c8';
      ctx.beginPath();
      ctx.moveTo(26, -9);
      ctx.lineTo(150, -34);
      ctx.lineTo(150, 34);
      ctx.lineTo(26, 9);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.30)';
    ctx.beginPath();
    ctx.roundRect(-26 + 4, -13 + 6, 52, 26, 8);
    ctx.fill();
    // Body.
    ctx.fillStyle = car.color;
    ctx.beginPath();
    ctx.roundRect(-26, -13, 52, 26, 8);
    ctx.fill();
    // Roof + windshield.
    ctx.fillStyle = 'rgba(20,28,38,0.85)';
    ctx.beginPath();
    ctx.roundRect(-8, -10, 20, 20, 4);
    ctx.fill();
    ctx.fillStyle = 'rgba(160,210,240,0.75)';
    ctx.fillRect(8, -9, 6, 18);
    // Wheels.
    ctx.fillStyle = '#15151a';
    ctx.fillRect(-19, -15, 11, 5); ctx.fillRect(-19, 10, 11, 5);
    ctx.fillRect(8, -15, 11, 5); ctx.fillRect(8, 10, 11, 5);
    // Headlights.
    ctx.fillStyle = '#fff8c8';
    ctx.fillRect(24, -10, 3, 5); ctx.fillRect(24, 5, 3, 5);
    // Tail lights flare when braking.
    ctx.fillStyle = car.braking ? '#ff2a1a' : '#ff5a4a';
    const tw = car.braking ? 5 : 3;
    ctx.fillRect(-27, -10, tw, 5); ctx.fillRect(-27, 5, tw, 5);
    if (car.kind === 'police') {
      ctx.fillStyle = '#2a4a8a';
      ctx.fillRect(-16, -13, 32, 6);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('PTS', 0, 4);
      // Flashing light bar.
      const flash = Math.floor(time * 6) % 2 === 0;
      ctx.fillStyle = flash ? '#ff3a3a' : '#3a7aff';
      ctx.fillRect(-5, -16, 10, 4);
      ctx.fillStyle = flash ? '#3a7aff' : '#ff3a3a';
      ctx.fillRect(5, -16, 10, 4);
    }
    if (isPlayer) {
      ctx.strokeStyle = '#ffd23e';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(0, 0, 36, 22, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawPed(ped, time) {
    ctx.save();
    ctx.translate(ped.x, ped.y);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(2, 5, 9, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    const bob = ped.state === 'walk' ? Math.sin(time * 8 + ped.x) * 1.2 : 0;
    ctx.fillStyle = ped.shirt;
    ctx.beginPath();
    ctx.roundRect(-6, -4 + bob, 12, 13, 4);
    ctx.fill();
    ctx.fillStyle = ped.skin;
    ctx.beginPath();
    ctx.arc(0, -8 + bob, 6, 0, Math.PI * 2);
    ctx.fill();
    if (ped.guard) {
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(4, 0);
      ctx.lineTo(4 + Math.cos(ped.angle) * 16, Math.sin(ped.angle) * 16);
      ctx.stroke();
      ctx.fillStyle = '#ff5a4a';
      ctx.fillRect(-8, -20, 16, 3);
      ctx.fillStyle = '#7a1a12';
      ctx.fillRect(-8, -20, 16 * Math.max(0, ped.health / 100), 3);
    }
    ctx.restore();
  }

  function drawWorld(state) {
    const cam = state.camera;
    const time = state.time;
    // Ground + district tints.
    ctx.fillStyle = '#c9b18a';
    ctx.fillRect(cam.x, cam.y, cam.w, cam.h);
    for (const d of DISTRICTS) {
      ctx.fillStyle = d.ground;
      ctx.fillRect(d.x0, d.y0, d.x1 - d.x0, d.y1 - d.y0);
    }
    // Harbour water on the west edge, with a pier.
    ctx.fillStyle = '#3a7a9a';
    ctx.fillRect(0, 0, 110, WORLD_H);
    ctx.fillStyle = '#8a6f4d';
    ctx.fillRect(104, 0, 14, WORLD_H);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    for (let y = 60; y < WORLD_H; y += 130) {
      ctx.beginPath(); ctx.moveTo(18, y); ctx.quadraticCurveTo(40, y + 10, 62, y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(30, y + 55); ctx.quadraticCurveTo(52, y + 65, 74, y + 55); ctx.stroke();
    }
    ctx.fillStyle = '#6a5238';
    ctx.fillRect(110, 700, 130, 16);
    ctx.fillRect(110, 2100, 130, 16);
    // Living harbour: fishing boats bobbing, a ferry on its route, and
    // the Teluk Senja lighthouse sweeping its beam over the water.
    const bob = (i) => Math.sin(time * 0.7 + i * 1.7) * 6;
    for (let i = 0; i < 4; i++) {
      const bx = 34 + i * 18; const by = 380 + i * 620 + bob(i);
      ctx.fillStyle = '#5a3a22';
      ctx.beginPath(); ctx.moveTo(bx - 20, by); ctx.lineTo(bx + 20, by); ctx.lineTo(bx + 14, by + 12); ctx.lineTo(bx - 14, by + 12); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#e8e0d0';
      ctx.fillRect(bx - 6, by - 12, 12, 12);
      ctx.strokeStyle = '#3a2a18';
      ctx.beginPath(); ctx.moveTo(bx, by - 12); ctx.lineTo(bx, by - 30); ctx.stroke();
    }
    const ferryY = 120 + ((time * 24) % 2760);
    ctx.fillStyle = '#2a4a6a';
    ctx.beginPath(); ctx.moveTo(18, ferryY); ctx.lineTo(92, ferryY); ctx.lineTo(82, ferryY + 22); ctx.lineTo(28, ferryY + 22); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffe9a8';
    for (let wnd = 0; wnd < 4; wnd++) ctx.fillRect(28 + wnd * 15, ferryY + 5, 8, 8);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('FERI SENJA', 55, ferryY - 8);
    // Lighthouse.
    ctx.fillStyle = '#e8e0d0';
    ctx.fillRect(48, 1440, 26, 110);
    ctx.fillStyle = '#c94a3a';
    ctx.fillRect(48, 1470, 26, 20);
    ctx.fillRect(48, 1510, 26, 20);
    ctx.fillStyle = '#2a2a34';
    ctx.fillRect(44, 1428, 34, 16);
    ctx.fillStyle = '#ffe9a8';
    ctx.beginPath(); ctx.arc(61, 1436, 7, 0, Math.PI * 2); ctx.fill();
    const beamA = time * 0.55;
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = '#fff6c8';
    ctx.beginPath();
    ctx.moveTo(61, 1436);
    ctx.lineTo(61 + Math.cos(beamA) * 330, 1436 + Math.sin(beamA) * 330 - 60);
    ctx.lineTo(61 + Math.cos(beamA) * 330, 1436 + Math.sin(beamA) * 330 + 60);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('MERCUSUAR', 61, 1570);
    // District names painted on the ground.
    ctx.textAlign = 'center';
    ctx.font = 'bold 64px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(60,40,20,0.16)';
    ctx.fillText('PELABUHAN SENJA', 750, 1550);
    ctx.fillText('PASAR IKAN', 2100, 450);
    ctx.fillText('KOTA TUA', 2100, 2250);
    ctx.fillText('BUKIT KACA', 3450, 750);
    ctx.fillText('DERMAGA LAMA', 3450, 2250);

    // Roads.
    for (const rx of ROAD_X) {
      ctx.fillStyle = '#4a4650';
      ctx.fillRect(rx - 46, 0, 92, WORLD_H);
    }
    for (const ry of ROAD_Y) {
      ctx.fillStyle = '#4a4650';
      ctx.fillRect(0, ry - 46, WORLD_W, 92);
    }
    // Centre dashes.
    ctx.fillStyle = '#e8c84a';
    for (const rx of ROAD_X) {
      for (let y = 20; y < WORLD_H; y += 64) ctx.fillRect(rx - 3, y, 6, 30);
    }
    for (const ry of ROAD_Y) {
      for (let x = 20; x < WORLD_W; x += 64) ctx.fillRect(x, ry - 3, 30, 6);
    }
    // Crosswalks at intersections.
    ctx.fillStyle = 'rgba(240,240,240,0.75)';
    for (const rx of ROAD_X) {
      for (const ry of ROAD_Y) {
        for (let i = -2; i <= 2; i++) {
          ctx.fillRect(rx - 40 + i * 16, ry - 58, 8, 14);
          ctx.fillRect(rx - 40 + i * 16, ry + 44, 8, 14);
        }
      }
    }
    // Garage yard.
    ctx.fillStyle = '#7a6a52';
    ctx.fillRect(GARAGE.x, GARAGE.y, GARAGE.w, GARAGE.h);
    ctx.strokeStyle = '#ffd23e';
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 8]);
    ctx.strokeRect(GARAGE.x, GARAGE.y, GARAGE.w, GARAGE.h);
    ctx.setLineDash([]);
    ctx.fillStyle = '#ffd23e';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('GARASI BANG DODI', GARAGE.x + GARAGE.w / 2, GARAGE.y + 30);
    ctx.font = 'bold 30px system-ui, sans-serif';
    ctx.fillText('🔧', GARAGE.x + GARAGE.w / 2, GARAGE.y + 72);

    // Market stalls: open by day, shuttered after 19:00.
    const nightNow = state.clockMin >= 1140;
    for (const s of state.city.stalls) {
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(s.x + 3, s.y + 4, s.w, s.h);
      ctx.fillStyle = nightNow ? '#5a5348' : s.color;
      ctx.fillRect(s.x, s.y, s.w, s.h);
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(nightNow ? 'TUTUP' : s.label, s.x + s.w / 2, s.y + 19);
    }
    // Props.
    for (const pr of state.city.props) {
      if (pr.kind === 'tree') {
        ctx.fillStyle = 'rgba(0,0,0,0.22)';
        ctx.beginPath(); ctx.ellipse(pr.x + 6, pr.y + 6, 14 * pr.s, 7 * pr.s, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#5a3a22';
        ctx.fillRect(pr.x - 2, pr.y, 4, 12);
        ctx.fillStyle = '#3f7a3a';
        ctx.beginPath(); ctx.arc(pr.x, pr.y - 8 * pr.s, 13 * pr.s, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#5a9a4a';
        ctx.beginPath(); ctx.arc(pr.x - 4, pr.y - 12 * pr.s, 7 * pr.s, 0, Math.PI * 2); ctx.fill();
      } else if (pr.kind === 'lamp') {
        ctx.fillStyle = '#3a3a44';
        ctx.fillRect(pr.x - 2, pr.y - 14, 4, 16);
        const nightF = Math.max(0, Math.min(1, (state.clockMin - 1110) / 45));
        if (nightF > 0) {
          ctx.save();
          ctx.globalAlpha = 0.35 * nightF;
          ctx.fillStyle = '#ffe9a8';
          ctx.beginPath(); ctx.arc(pr.x, pr.y - 16, 20, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        }
        ctx.fillStyle = '#ffe9a8';
        ctx.beginPath(); ctx.arc(pr.x, pr.y - 16, 5, 0, Math.PI * 2); ctx.fill();
      } else if (pr.kind === 'container') {
        ctx.fillStyle = pr.color;
        ctx.fillRect(pr.x - 26, pr.y - 12, 52, 24);
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(pr.x + i * 10, pr.y - 12); ctx.lineTo(pr.x + i * 10, pr.y + 12); ctx.stroke(); }
      } else {
        ctx.fillStyle = pr.color;
        ctx.fillRect(pr.x - 10 * pr.s, pr.y - 10 * pr.s, 20 * pr.s, 20 * pr.s);
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.strokeRect(pr.x - 10 * pr.s, pr.y - 10 * pr.s, 20 * pr.s, 20 * pr.s);
      }
    }
    // Buildings, with long dusk shadows and lit windows.
    for (const b of state.city.buildings) {
      ctx.fillStyle = 'rgba(40,20,10,0.28)';
      ctx.fillRect(b.x + b.height * 3, b.y + b.height * 4, b.w, b.h);
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      ctx.fillRect(b.x, b.y, b.w, 8);
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.strokeRect(b.x, b.y, b.w, b.h);
      // Windows.
      const cols = Math.max(1, Math.floor(b.w / 34));
      const rows = Math.max(1, Math.floor(b.h / 34));
      for (let cx = 0; cx < cols; cx++) {
        for (let cy = 0; cy < rows; cy++) {
          const lit = ((cx * 7 + cy * 3 + b.x) % 3) !== 0;
          ctx.fillStyle = lit ? '#ffe9a8' : '#2a3038';
          ctx.fillRect(b.x + 10 + cx * 34, b.y + 10 + cy * 34, 14, 12);
        }
      }
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.textAlign = 'left';
    }

    // Pickups.
    for (const pk of state.pickups) {
      if (pk.taken) continue;
      const pulse = 1 + Math.sin(time * 4 + pk.x) * 0.15;
      ctx.save();
      ctx.translate(pk.x, pk.y);
      ctx.scale(pulse, pulse);
      ctx.fillStyle = pk.kind === 'health' ? '#2fae4a' : '#2a7ae8';
      ctx.beginPath(); ctx.arc(0, 0, 13, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 16px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(pk.kind === 'health' ? '+' : '🛡', 0, 6);
      ctx.restore();
    }

    // Mission marker: beam + pulsing diamond.
    const step = currentStep(state);
    if (step && !state.missionDone) {
      const pulse = 1 + Math.sin(time * 5) * 0.25;
      ctx.save();
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = '#ffd23e';
      ctx.fillRect(step.x - 8, step.y - 130, 16, 130);
      ctx.restore();
      ctx.save();
      ctx.translate(step.x, step.y - 34);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = '#ffd23e';
      ctx.strokeStyle = '#7a5a00';
      ctx.lineWidth = 2;
      const s = 15 * pulse;
      ctx.fillRect(-s / 2, -s / 2, s, s);
      ctx.strokeRect(-s / 2, -s / 2, s, s);
      ctx.restore();
      ctx.strokeStyle = 'rgba(255, 210, 62, 0.8)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(step.x, step.y, 44 + Math.sin(time * 5) * 6, 20, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Cars: parked, traffic, police, roadblock cars. nightF drives headlights.
    const nightF = Math.max(0, Math.min(1, (state.clockMin - 1110) / 45));
    for (const car of state.parked) drawCarShape(car, false, time, nightF);
    for (const car of state.traffic) drawCarShape(car, false, time, nightF);
    if (state.roadblock) {
      for (const car of state.roadblock.cars) drawCarShape(car, false, time, nightF);
      // Cones around the roadblock.
      ctx.fillStyle = '#ff7a1a';
      const rb = state.roadblock;
      const coneSpots = rb.horizontal
        ? [[rb.x - 90, rb.y - 40], [rb.x + 90, rb.y + 40], [rb.x - 90, rb.y + 40], [rb.x + 90, rb.y - 40]]
        : [[rb.x - 40, rb.y - 90], [rb.x + 40, rb.y + 90], [rb.x + 40, rb.y - 90], [rb.x - 40, rb.y + 90]];
      for (const [cx, cy] of coneSpots) {
        ctx.beginPath(); ctx.moveTo(cx, cy - 9); ctx.lineTo(cx - 7, cy + 6); ctx.lineTo(cx + 7, cy + 6); ctx.closePath(); ctx.fill();
      }
    }
    for (const car of state.police) drawCarShape(car, false, time, nightF);
    if (state.player.car) drawCarShape(state.player.car, true, time, nightF);

    // Crew at home in the garage yard, and the companion walking with Raka.
    function drawCrewMember(x, y, shirt, label, ringColor) {
      ctx.save();
      ctx.translate(x, y);
      ctx.strokeStyle = ringColor;
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(0, 0, 18, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath(); ctx.ellipse(2, 6, 9, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = shirt;
      ctx.beginPath(); ctx.roundRect(-7, -5, 14, 14, 4); ctx.fill();
      ctx.fillStyle = '#e8b98a';
      ctx.beginPath(); ctx.arc(0, -9, 6.5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(label, x, y - 24);
    }
    for (const npc of state.crewNpcs || []) drawCrewMember(npc.x, npc.y, npc.color, npc.name, npc.color);
    if (state.companion?.active) {
      drawCrewMember(state.companion.x, state.companion.y, state.companion.color, state.companion.name, '#ffd23e');
    }

    // Pedestrians and the player on foot.
    for (const ped of state.peds) {
      if (ped.health <= 0 && ped.guard) continue;
      drawPed(ped, time);
    }
    const p = state.player;
    if (p.onFoot) {
      // Player ring + body + aim arm.
      ctx.strokeStyle = '#ffd23e';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 22, 0, Math.PI * 2);
      ctx.stroke();
      ctx.save();
      ctx.translate(p.x, p.y);
      const bob = Math.sin(time * 8) * 1;
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath(); ctx.ellipse(2, 6, 9, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e8493a';
      ctx.beginPath(); ctx.roundRect(-7, -5 + bob, 14, 14, 4); ctx.fill();
      ctx.fillStyle = '#e8b98a';
      ctx.beginPath(); ctx.arc(0, -9 + bob, 6.5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(5, 0);
      ctx.lineTo(5 + Math.cos(p.aimAngle) * 20, Math.sin(p.aimAngle) * 20);
      ctx.stroke();
      ctx.restore();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('RAKA', p.x, p.y - 26);
      if (state.muzzle > 0) {
        ctx.fillStyle = '#ffe98a';
        ctx.beginPath();
        ctx.arc(p.x + Math.cos(p.aimAngle) * 26, p.y + Math.sin(p.aimAngle) * 26, 7, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Bullets and sparks.
    for (const b of state.bullets) {
      ctx.strokeStyle = b.hostile ? '#ff8a6a' : '#ffe98a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    for (const s of state.sparks) {
      ctx.globalAlpha = Math.max(0, Math.min(1, s.life * 2));
      ctx.fillStyle = s.color;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.size || 4, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Helicopter: LARGE, with a visible searchlight cone onto the player.
    if (state.helicopter) {
      const h = state.helicopter;
      // Searchlight cone.
      ctx.save();
      ctx.globalAlpha = 0.30;
      ctx.fillStyle = '#fff6c8';
      ctx.beginPath();
      ctx.moveTo(h.x, h.y);
      ctx.lineTo(h.lightX - 55, h.lightY);
      ctx.lineTo(h.lightX + 55, h.lightY);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = 'rgba(255, 246, 200, 0.55)';
      ctx.beginPath(); ctx.ellipse(h.lightX, h.lightY, 58, 30, 0, 0, Math.PI * 2); ctx.fill();
      // Shadow + body.
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.beginPath(); ctx.ellipse(h.x + 26, h.y + 30, 40, 14, 0, 0, Math.PI * 2); ctx.fill();
      ctx.save();
      ctx.translate(h.x, h.y);
      ctx.rotate(h.angle * 0.15);
      ctx.fillStyle = '#3d6a8a';
      ctx.beginPath(); ctx.roundRect(-48, -17, 96, 34, 14); ctx.fill();
      ctx.fillStyle = '#eef6ff';
      ctx.fillRect(-48, -6, 96, 8);
      ctx.fillStyle = '#7ac2ff';
      ctx.beginPath(); ctx.roundRect(18, -12, 22, 24, 7); ctx.fill();
      ctx.fillStyle = '#e8e8e8';
      ctx.fillRect(-88, -5, 42, 8);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 15px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('PTS', -6, 6);
      // Rotor, spinning.
      ctx.strokeStyle = 'rgba(20,20,26,0.85)';
      ctx.lineWidth = 4;
      const ra = h.rotor;
      ctx.beginPath();
      ctx.moveTo(Math.cos(ra) * 58, Math.sin(ra) * 10);
      ctx.lineTo(-Math.cos(ra) * 58, -Math.sin(ra) * 10);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(Math.cos(ra + Math.PI / 2) * 58, Math.sin(ra + Math.PI / 2) * 10);
      ctx.lineTo(-Math.cos(ra + Math.PI / 2) * 58, -Math.sin(ra + Math.PI / 2) * 10);
      ctx.stroke();
      ctx.restore();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 14px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('HELIKOPTER PTS', h.x, h.y - 34);
    }

    // Dusk light: warm wash + vignette, kept light so the HUD stays crisp.
    // After 18:30 the city slides into night: darker wash, lit windows
    // already drawn brighter by the overlay below.
    const nightF2 = Math.max(0, Math.min(1, (state.clockMin - 1110) / 45));
    const grad = ctx.createLinearGradient(cam.x, cam.y, cam.x, cam.y + cam.h);
    grad.addColorStop(0, 'rgba(255, 150, 60, 0.10)');
    grad.addColorStop(0.55, 'rgba(255, 110, 90, 0.05)');
    grad.addColorStop(1, 'rgba(60, 30, 90, 0.14)');
    ctx.fillStyle = grad;
    ctx.fillRect(cam.x, cam.y, cam.w, cam.h);
    if (nightF2 > 0) {
      ctx.fillStyle = `rgba(16, 20, 52, ${0.30 * nightF2})`;
      ctx.fillRect(cam.x, cam.y, cam.w, cam.h);
    }
  }

  function drawTitle(state, saved) {
    const vw = state.camera.w; const vh = state.camera.h;
    ctx.fillStyle = '#1a1420';
    ctx.fillRect(0, 0, vw, vh);
    // Sun + skyline silhouette.
    const grad = ctx.createLinearGradient(0, 0, 0, vh);
    grad.addColorStop(0, '#ff9a4a');
    grad.addColorStop(0.5, '#e85a6a');
    grad.addColorStop(1, '#3a2450');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, vw, vh);
    ctx.fillStyle = '#ffd76a';
    ctx.beginPath(); ctx.arc(vw * 0.72, vh * 0.34, 74, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#241a30';
    const skyline = [90, 150, 110, 190, 130, 170, 100, 160, 120, 185, 105];
    let sx = 0;
    skyline.forEach((bh, i) => {
      ctx.fillRect(sx, vh - 190 - bh, 128, 190 + bh);
      sx += 128;
    });
    ctx.fillStyle = '#120e18';
    ctx.fillRect(0, vh - 190, vw, 190);
    ctx.fillStyle = '#ffd76a';
    ctx.fillRect(0, vh - 190, vw, 4);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 84px system-ui, sans-serif';
    ctx.fillText('TELUK SENJA', vw / 2, vh * 0.36);
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.fillStyle = '#ffe9c8';
    ctx.fillText('Kejahatan, kejar-kejaran, dan delapan misi di kota senja.', vw / 2, vh * 0.36 + 46);
    // Crew briefing portraits, drawn in code: Sinta and Bang Dodi.
    const portraits = [
      { initial: 'S', color: '#ff9ad5', name: 'SINTA', role: 'Sopir kabur · Q pengalih PTS', dx: -150 },
      { initial: 'D', color: '#7ac2ff', name: 'BANG DODI', role: 'Pagar & bengkel · F perbaikan', dx: 150 },
    ];
    for (const prt of portraits) {
      const cx = vw / 2 + prt.dx; const cy = vh * 0.36 + 96;
      ctx.fillStyle = prt.color;
      ctx.beginPath(); ctx.arc(cx, cy, 30, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#241a30';
      ctx.font = 'bold 30px system-ui, sans-serif';
      ctx.fillText(prt.initial, cx, cy + 11);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 19px system-ui, sans-serif';
      ctx.fillText(prt.name, cx, cy + 56);
      ctx.font = '15px system-ui, sans-serif';
      ctx.fillStyle = '#ffe9c8';
      ctx.fillText(prt.role, cx, cy + 78);
    }
    ctx.font = '20px system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    const lines = [
      'Raka pulang ke Teluk Senja. Sinta, Bang Dodi, dan Tuan Kala menunggunya.',
      'Curi mobil, kabur dari PTS, dan rebut kembali kotanya — misi demi misi.',
      '',
      'WASD gerak / nyetir · E naik-turun mobil · Mouse bidik, klik tembak · 1/2/3 senjata',
      'Q Sinta (pengalih) · F Bang Dodi (bengkel) · G garasi · R radio · P jeda',
    ];
    lines.forEach((line, i) => ctx.fillText(line, vw / 2, vh * 0.52 + i * 30));
    ctx.font = 'bold 24px system-ui, sans-serif';
    ctx.fillStyle = '#ffd76a';
    ctx.fillText(saved ? 'ENTER: lanjutkan misi  ·  N: mulai dari awal' : 'ENTER: mulai permainan', vw / 2, vh * 0.78);
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText('Kota, karakter, kendaraan, dan cerita orisinal — dibuat untuk bounty Make GTA 6.', vw / 2, vh - 28);
  }

  function drawOverlayPanel(title, lines, prompt, vw, vh) {
    ctx.fillStyle = 'rgba(8, 8, 14, 0.72)';
    ctx.fillRect(0, 0, vw, vh);
    const w = 620; const h = 130 + lines.length * 30 + 60;
    const x = (vw - w) / 2; const y = (vh - h) / 2;
    ctx.fillStyle = 'rgba(16, 18, 28, 0.95)';
    ctx.strokeStyle = '#ffd76a';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 14); ctx.fill(); ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 44px system-ui, sans-serif';
    ctx.fillText(title, vw / 2, y + 64);
    ctx.font = '21px system-ui, sans-serif';
    lines.forEach((line, i) => ctx.fillText(line, vw / 2, y + 110 + i * 30));
    ctx.fillStyle = '#ffd76a';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillText(prompt, vw / 2, y + h - 26);
  }

  function draw(state, screen, saved) {
    const vw = state.camera.w; const vh = state.camera.h;
    ctx.setTransform(canvas.width / vw, 0, 0, canvas.height / vh, 0, 0);
    if (screen === SCREEN_TITLE) {
      drawTitle(state, saved);
      return;
    }
    const cam = state.camera;
    const shakeX = state.shake > 0 ? Math.sin(state.time * 47) * state.shake * 7 : 0;
    const shakeY = state.shake > 0 ? Math.cos(state.time * 39) * state.shake * 7 : 0;
    ctx.save();
    ctx.translate(-cam.x + shakeX, -cam.y + shakeY);
    drawWorld(state);
    ctx.restore();
    // HUD in screen space.
    ctx.setTransform(canvas.width / vw, 0, 0, canvas.height / vh, 0, 0);
    drawHud(ctx, state, vw, vh);
    if (screen === SCREEN_PAUSED) {
      drawOverlayPanel('JEDA', ['Permainan berhenti. Kota menunggu.', `Misi: ${state.mission ? state.mission.title : '—'}`], 'P / ENTER: lanjutkan', vw, vh);
    } else if (screen === SCREEN_BUSTED) {
      drawOverlayPanel('TERTANGKAP OLEH PTS', ['Raka ditangkap dan kehilangan $50.', 'Hormat dan misi yang sudah selesai tetap tersimpan.'], 'ENTER: kembali ke jalan', vw, vh);
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, resize };
}

export function viewSize(canvas) {
  return { w: canvas.clientWidth || 1280, h: canvas.clientHeight || 720 };
}
