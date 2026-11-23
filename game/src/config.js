// TELUK SENJA — tuning, districts, vehicles, weapons and names.
// Every name, place and vehicle here is invented for this game.
export const WORLD_W = 4200;
export const WORLD_H = 3000;
export const STEP = 1 / 60;
export const SAVE_KEY = 'teluk-senja-save-v1';

export const ROAD_X = [300, 900, 1500, 2100, 2700, 3300, 3900];
export const ROAD_Y = [300, 800, 1300, 1800, 2300, 2800];
export const ROAD_HALF = 46;

export const DISTRICTS = [
  { id: 'pelabuhan', name: 'Pelabuhan Senja', x0: 0, x1: 1500, y0: 0, y1: 3000, ground: '#b99b6b', roof: ['#8a6f4d', '#7d6248', '#96795a'], trim: '#e8d9b0' },
  { id: 'pasar', name: 'Pasar Ikan', x0: 1500, x1: 2700, y0: 0, y1: 1500, ground: '#c2a878', roof: ['#c96f3f', '#b8573a', '#d99a4e'], trim: '#f5e3c2' },
  { id: 'kotatua', name: 'Kota Tua', x0: 1500, x1: 2700, y0: 1500, y1: 3000, ground: '#b5a184', roof: ['#7a6a8a', '#5f6f7d', '#8a7a5a', '#a05a4e'], trim: '#efe0c0' },
  { id: 'bukit', name: 'Bukit Kaca', x0: 2700, x1: 4200, y0: 0, y1: 1500, ground: '#a89a7e', roof: ['#4e7d8a', '#5a8a9a', '#3f6d7a'], trim: '#d8ecf0' },
  { id: 'dermaga', name: 'Dermaga Lama', x0: 2700, x1: 4200, y0: 1500, y1: 3000, ground: '#ac8f66', roof: ['#6d5a49', '#7a6a52', '#5a6d5a'], trim: '#e0d3b8' },
];

export function districtAt(x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x0 && x < d.x1 && y >= d.y0 && y < d.y1) return d;
  }
  return DISTRICTS[2];
}

export const CAR_DEFS = {
  senjaGT: { name: 'Senja GT', color: '#d8a020', accel: 420, top: 520, grip: 3.4 },
  bakau: { name: 'Bakau Pickup', color: '#7a8a3a', accel: 340, top: 430, grip: 3.0 },
  ombak: { name: 'Ombak Sedan', color: '#3a6d9a', accel: 360, top: 460, grip: 3.2 },
  camar: { name: 'Camar Coupe', color: '#b03a3a', accel: 400, top: 500, grip: 3.3 },
  kargo: { name: 'Kargo Van', color: '#8a8a86', accel: 280, top: 360, grip: 2.6 },
  pts: { name: 'Patroli PTS', color: '#f2f2ea', accel: 430, top: 540, grip: 3.6 },
};

export const WEAPONS = [
  { name: 'Pistol Senja', damage: 34, rate: 0.28, spread: 0.03, range: 520, color: '#ffd76a' },
  { name: 'Bedil Laras', damage: 55, rate: 0.55, spread: 0.01, range: 760, color: '#ff9a4a' },
  { name: 'Hujan Peluru', damage: 16, rate: 0.09, spread: 0.09, range: 430, color: '#ffe98a' },
];

export const RADIO_STATIONS = [
  { name: 'Radio Senja FM', hue: '#7ac2ff' },
  { name: 'Dangdut Teluk', hue: '#ff9ad5' },
  { name: 'Gelombang Malam', hue: '#b49aff' },
];

export const CREW = [
  { id: 'sinta', name: 'Sinta', ability: 'Pengalih: polisi terdekat menjauh 12 detik', cooldown: 45 },
  { id: 'dodi', name: 'Bang Dodi', ability: 'Bengkel keliling: perbaiki mobil + isi rompi', cooldown: 60 },
];
