// Drawing only: the GTA III-style 3D world (raw WebGL, see gl3d.js),
// the 2D HUD overlay on a second canvas, and the menu screens.
// The GL canvas paints the city; the HUD canvas paints the panels,
// stars, tracker, minimap and menus on top, in logical 1280x720
// coordinates, scaled to the browser window.
import { drawHud } from './hud.js';
import { currentStep } from './missions.js';
import { initGL, drawGLScene } from './gl3d.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_BUSTED = 'busted';

export function createRenderer(canvas) {
  const glState = initGL(canvas);
  const hudCanvas = document.getElementById('hud');
  const hctx = hudCanvas.getContext('2d');

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const w = Math.round(window.innerWidth * ratio);
    const h = Math.round(window.innerHeight * ratio);
    canvas.width = w; canvas.height = h;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    hudCanvas.width = w; hudCanvas.height = h;
    hudCanvas.style.width = '100%';
    hudCanvas.style.height = '100%';
  }

  function drawTitle(state, saved, vw, vh) {
    hctx.fillStyle = 'rgba(20, 12, 26, 0.45)';
    hctx.fillRect(0, 0, vw, vh);
    hctx.textAlign = 'center';
    hctx.fillStyle = '#ffffff';
    hctx.font = 'bold 84px system-ui, sans-serif';
    hctx.shadowColor = 'rgba(0,0,0,0.55)';
    hctx.shadowBlur = 18;
    hctx.fillText('TELUK SENJA', vw / 2, vh * 0.30);
    hctx.shadowBlur = 0;
    hctx.font = 'bold 26px system-ui, sans-serif';
    hctx.fillStyle = '#ffe9c8';
    hctx.fillText('Kejahatan, kejar-kejaran, dan delapan misi di kota senja.', vw / 2, vh * 0.30 + 46);
    const portraits = [
      { initial: 'S', color: '#ff9ad5', name: 'SINTA', role: 'Sopir kabur · Q pengalih PTS', dx: -150 },
      { initial: 'D', color: '#7ac2ff', name: 'BANG DODI', role: 'Pagar & bengkel · F perbaikan', dx: 150 },
    ];
    for (const prt of portraits) {
      const cx = vw / 2 + prt.dx; const cy = vh * 0.30 + 96;
      hctx.fillStyle = prt.color;
      hctx.beginPath(); hctx.arc(cx, cy, 30, 0, Math.PI * 2); hctx.fill();
      hctx.fillStyle = '#241a30';
      hctx.font = 'bold 30px system-ui, sans-serif';
      hctx.fillText(prt.initial, cx, cy + 11);
      hctx.fillStyle = '#ffffff';
      hctx.font = 'bold 19px system-ui, sans-serif';
      hctx.fillText(prt.name, cx, cy + 56);
      hctx.font = '15px system-ui, sans-serif';
      hctx.fillStyle = '#ffe9c8';
      hctx.fillText(prt.role, cx, cy + 78);
    }
    hctx.font = '20px system-ui, sans-serif';
    hctx.fillStyle = '#ffffff';
    hctx.shadowColor = 'rgba(0,0,0,0.6)';
    hctx.shadowBlur = 8;
    const lines = [
      'Raka pulang ke Teluk Senja. Sinta, Bang Dodi, dan Tuan Kala menunggunya.',
      'Curi mobil, kabur dari PTS, dan rebut kembali kotanya — misi demi misi.',
      '',
      'WASD gerak / nyetir · E naik-turun mobil · Mouse bidik, klik tembak · 1/2/3 senjata',
      'Q Sinta (pengalih) · F Bang Dodi (bengkel) · G garasi · R radio · P jeda',
    ];
    lines.forEach((line, i) => hctx.fillText(line, vw / 2, vh * 0.52 + i * 30));
    hctx.shadowBlur = 0;
    hctx.font = 'bold 24px system-ui, sans-serif';
    hctx.fillStyle = '#ffd76a';
    hctx.fillText(saved ? 'ENTER: lanjutkan misi  ·  N: mulai dari awal' : 'ENTER: mulai permainan', vw / 2, vh * 0.78);
    hctx.font = '16px system-ui, sans-serif';
    hctx.fillStyle = 'rgba(255,255,255,0.9)';
    hctx.fillText('Kota, karakter, kendaraan, dan cerita orisinal — dibuat untuk bounty Make GTA 6.', vw / 2, vh - 28);
    void currentStep;
  }

  function drawOverlayPanel(title, lines, prompt, vw, vh) {
    hctx.fillStyle = 'rgba(8, 8, 14, 0.72)';
    hctx.fillRect(0, 0, vw, vh);
    const w = 620; const h = 130 + lines.length * 30 + 60;
    const x = (vw - w) / 2; const y = (vh - h) / 2;
    hctx.fillStyle = 'rgba(16, 18, 28, 0.95)';
    hctx.strokeStyle = '#ffd76a';
    hctx.lineWidth = 2;
    hctx.beginPath(); hctx.roundRect(x, y, w, h, 14); hctx.fill(); hctx.stroke();
    hctx.textAlign = 'center';
    hctx.fillStyle = '#ffffff';
    hctx.font = 'bold 44px system-ui, sans-serif';
    hctx.fillText(title, vw / 2, y + 64);
    hctx.font = '21px system-ui, sans-serif';
    lines.forEach((line, i) => hctx.fillText(line, vw / 2, y + 110 + i * 30));
    hctx.fillStyle = '#ffd76a';
    hctx.font = 'bold 22px system-ui, sans-serif';
    hctx.fillText(prompt, vw / 2, y + h - 26);
  }

  function draw(state, screen, saved, snap) {
    const vw = state.camera.w; const vh = state.camera.h;
    // HUD canvas: clear in device pixels, then work in logical coords.
    hctx.setTransform(1, 0, 0, 1, 0, 0);
    hctx.clearRect(0, 0, hudCanvas.width, hudCanvas.height);
    hctx.setTransform(hudCanvas.width / vw, 0, 0, hudCanvas.height / vh, 0, 0);
    if (screen === SCREEN_TITLE) {
      drawGLScene(glState, state, { cinematic: true, snap: false });
      drawTitle(state, saved, vw, vh);
      return;
    }
    drawGLScene(glState, state, { snap: !!snap });
    drawHud(hctx, state, vw, vh);
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
