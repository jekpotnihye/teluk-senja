// Synthesised sound and music: every sound is generated with WebAudio,
// nothing is loaded from a file. Audio only starts after a user gesture,
// so headless screenshot runs stay silent and error-free.
let ctx = null;
let master = null;
let radioTimer = null;
let radioStep = 0;
let sirenNodes = null;
let engineNodes = null;

export function initAudio() {
  if (ctx) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.35;
    master.connect(ctx.destination);
  } catch { ctx = null; }
}

export function audioReady() { return !!ctx; }

function tone(freq, dur, type, vol, slideTo) {
  if (!ctx || !master) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
    gain.gain.setValueAtTime(vol || 0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(gain); gain.connect(master);
    osc.start(); osc.stop(ctx.currentTime + dur);
  } catch { /* ignore */ }
}

function noiseBurst(dur, vol) {
  if (!ctx || !master) return;
  try {
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const gain = ctx.createGain(); gain.gain.value = vol || 0.3;
    src.connect(gain); gain.connect(master); src.start();
  } catch { /* ignore */ }
}

export function playShot() { noiseBurst(0.12, 0.5); tone(180, 0.08, 'square', 0.18, 60); }
export function playHit() { tone(220, 0.08, 'square', 0.2, 90); }
export function playCrash() { noiseBurst(0.25, 0.4); tone(90, 0.2, 'sawtooth', 0.2, 40); }
export function playPickup() { tone(660, 0.1, 'sine', 0.25); setTimeout(() => tone(880, 0.14, 'sine', 0.25), 70); }
export function playMissionDone() {
  [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.18, 'triangle', 0.3), i * 110));
}
export function playBusted() { [392, 330, 262, 196].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'sawtooth', 0.22), i * 140)); }
export function playClick() { tone(520, 0.05, 'square', 0.12); }

// A short looping melody per radio station, scheduled in small steps.
const RADIO_NOTES = [
  [392, 440, 523, 440, 392, 330, 392, 494],
  [330, 392, 440, 392, 330, 262, 330, 392],
  [262, 311, 392, 311, 262, 220, 262, 330],
];

export function startRadio(station) {
  stopRadio();
  if (!ctx || !master) return;
  radioStep = 0;
  const notes = RADIO_NOTES[station % RADIO_NOTES.length];
  radioTimer = window.setInterval(() => {
    if (!ctx) return;
    tone(notes[radioStep % notes.length], 0.24, 'triangle', 0.10);
    if (radioStep % 4 === 0) tone(notes[radioStep % notes.length] / 2, 0.3, 'sine', 0.12);
    radioStep += 1;
  }, 260);
}

export function stopRadio() {
  if (radioTimer) { window.clearInterval(radioTimer); radioTimer = null; }
}

export function setSiren(on) {
  if (!ctx || !master) return;
  try {
    if (on && !sirenNodes) {
      const osc = ctx.createOscillator(); osc.type = 'sine';
      const gain = ctx.createGain(); gain.gain.value = 0.05;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 1.1;
      const lfoGain = ctx.createGain(); lfoGain.gain.value = 300;
      lfo.connect(lfoGain); lfoGain.connect(osc.frequency);
      osc.frequency.value = 800;
      osc.connect(gain); gain.connect(master);
      osc.start(); lfo.start();
      sirenNodes = { osc, lfo, gain };
    } else if (!on && sirenNodes) {
      sirenNodes.osc.stop(); sirenNodes.lfo.stop();
      sirenNodes = null;
    }
  } catch { sirenNodes = null; }
}

export function setEngine(speedFrac, driving) {
  if (!ctx || !master) return;
  try {
    if (driving && !engineNodes) {
      const osc = ctx.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = 60;
      const gain = ctx.createGain(); gain.gain.value = 0.02;
      osc.connect(gain); gain.connect(master); osc.start();
      engineNodes = { osc, gain };
    }
    if (engineNodes) {
      if (!driving) {
        engineNodes.osc.stop(); engineNodes = null;
      } else {
        engineNodes.osc.frequency.value = 55 + speedFrac * 130;
        engineNodes.gain.gain.value = 0.015 + speedFrac * 0.03;
      }
    }
  } catch { engineNodes = null; }
}
