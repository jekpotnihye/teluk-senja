// The story of Teluk Senja: eight jobs for Raka, from a first errand
// for Sinta to taking down the smuggler king of Dermaga Lama. Each
// mission is a list of steps; a step completes when the player reaches
// a marker, steals or delivers a car, collects a package, defeats the
// guards, talks to someone, or escapes the police.
import { dist } from './util.js';
import { playMissionDone, playPickup } from './audio.js';

export const MISSIONS = [
  {
    id: 1, title: 'Pulang ke Dermaga',
    giver: 'Sinta',
    brief: 'Sinta menunggumu di Dermaga Lama. Jalan kaki ke penanda kuning dan bicara dengannya. Dia punya pekerjaan pertama untukmu, dan dia tidak suka menunggu.',
    steps: [{ type: 'talk', x: 3050, y: 2650, label: 'Temui Sinta di Dermaga Lama', npc: 'Sinta' }],
    reward: 60, respect: 8,
  },
  {
    id: 2, title: 'Mobil Bang Dodi',
    giver: 'Bang Dodi',
    brief: 'Bang Dodi meminjamkan Senja GT-nya, tapi mobil itu diparkir di Kota Tua dan dijaga orang suruhan Tuan Kala. Curi mobilnya, hati-hati dengan penjaganya, lalu bawa pulang ke bengkel.',
    steps: [
      { type: 'steal', x: 2100, y: 1750, label: 'Curi Senja GT di Kota Tua (tekan E di samping mobil)', carDef: 'senjaGT' },
      { type: 'deliver', x: 3050, y: 2650, label: 'Antar Senja GT ke bengkel Bang Dodi di Dermaga Lama' },
    ],
    reward: 140, respect: 14,
  },
  {
    id: 3, title: 'Antar Ikan Segar',
    giver: 'Sinta',
    brief: 'Ikan segar dari Pasar Ikan harus sampai ke warung di Bukit Kaca sebelum matahari tenggelam. Ambil paketnya di pasar, lalu antar dengan mobil. Jangan sampai paketnya rusak karena tabrakan.',
    steps: [
      { type: 'collect', x: 2100, y: 850, label: 'Ambil paket ikan di Pasar Ikan' },
      { type: 'deliver', x: 3450, y: 650, label: 'Antar paket ke warung di Bukit Kaca' },
    ],
    reward: 180, respect: 12,
  },
  {
    id: 4, title: 'Gudang Pelabuhan',
    giver: 'Bang Dodi',
    brief: 'Anak buah Tuan Kala menyimpan muatan selundupan di gudang Pelabuhan Senja. Masuk ke gudang, kalahkan penjaganya, dan ambil dokumen muatannya. Bawa dokumen itu kembali ke Sinta.',
    steps: [
      { type: 'defeat', x: 700, y: 1450, label: 'Kalahkan 3 penjaga gudang di Pelabuhan Senja', count: 3, guards: [[640, 1400], [760, 1500], [700, 1560]] },
      { type: 'collect', x: 700, y: 1450, label: 'Ambil dokumen muatan di gudang' },
      { type: 'talk', x: 3050, y: 2650, label: 'Serahkan dokumen ke Sinta', npc: 'Sinta' },
    ],
    reward: 260, respect: 20,
  },
  {
    id: 5, title: 'Kabur dari PTS',
    giver: 'Sinta',
    brief: 'Operasi gudang membuat PTS mengejarmu. Kabur dari kejaran polisi dan capai titik aman di timur kota. Jangan sampai tertangkap — kalau bintangmu masih menyala, kamu belum aman.',
    steps: [{ type: 'escape', x: 3950, y: 650, label: 'Kabur dari PTS — capai titik aman di timur, dengan bintang 0' }],
    reward: 220, respect: 18,
  },
  {
    id: 6, title: 'Balapan Teluk Senja',
    giver: 'Bang Dodi',
    brief: 'Bang Dodi mendaftarkanmu ke balapan liar mengelilingi teluk. Lewati semua gerbang balapan dengan mobil, dari Pelabuhan sampai Bukit Kaca. Yang tercepat membawa pulang hadiahnya.',
    steps: [
      { type: 'goto', x: 900, y: 800, label: 'Gerbang 1 dari 4: perempatan Pelabuhan (naik mobil)' },
      { type: 'goto', x: 2100, y: 800, label: 'Gerbang 2 dari 4: Pasar Ikan' },
      { type: 'goto', x: 3300, y: 800, label: 'Gerbang 3 dari 4: Bukit Kaca' },
      { type: 'goto', x: 3300, y: 2300, label: 'Gerbang 4 dari 4: finis di Dermaga Lama' },
    ],
    reward: 320, respect: 24,
  },
  {
    id: 7, title: 'Jebakan di Dermaga',
    giver: 'Sinta',
    brief: 'Tuan Kala mengadakan pertemuan di Dermaga Lama. Sinta akan mengalihkan perhatian anak buahnya sementara kamu menyusup, mengalahkan penjaga, dan mengambil kunci kontainernya.',
    steps: [
      { type: 'talk', x: 3050, y: 2650, label: 'Temui Sinta — dia akan mengalihkan perhatian' , npc: 'Sinta' },
      { type: 'defeat', x: 3600, y: 2650, label: 'Kalahkan 4 penjaga di Dermaga Lama', count: 4, guards: [[3540, 2600], [3660, 2600], [3540, 2720], [3660, 2720]] },
      { type: 'collect', x: 3600, y: 2650, label: 'Ambil kunci kontainer Tuan Kala' },
    ],
    reward: 380, respect: 28,
  },
  {
    id: 8, title: 'Raja Selundupan',
    giver: 'Bang Dodi',
    brief: 'Ini puncaknya. Tuan Kala sendiri menjaga kapal terakhirnya di Pelabuhan Senja. Kalahkan pengawalnya, rebut kapalnya, dan akhiri kekuasaan selundupannya atas Teluk Senja — untuk selamanya.',
    steps: [
      { type: 'defeat', x: 350, y: 650, label: 'Kalahkan 5 pengawal Tuan Kala di Pelabuhan Senja', count: 5, guards: [[300, 600], [400, 600], [300, 720], [400, 720], [350, 660]] },
      { type: 'collect', x: 350, y: 650, label: 'Rebut kunci kapal Tuan Kala' },
      { type: 'goto', x: 2100, y: 1500, label: 'Kembali ke tengah Kota Tua — Teluk Senja bebas' },
    ],
    reward: 500, respect: 40,
  },
];

export function startMission(state, index) {
  const mission = MISSIONS[index];
  state.missionIndex = index;
  state.missionStep = 0;
  state.missionDone = false;
  state.guardsDefeated = 0;
  state.stepTimer = 0;
  state.mission = mission;
  spawnStepEntities(state);
  state.message = `Misi ${mission.id}: ${mission.title} — ${mission.brief}`;
  state.messageTimer = 6;
}

export function currentStep(state) {
  if (!state.mission) return null;
  return state.mission.steps[state.missionStep] || null;
}

function spawnStepEntities(state) {
  const step = currentStep(state);
  if (!step) return;
  // Remove old mission guards.
  state.peds = state.peds.filter((p) => !p.missionGuard);
  if (step.type === 'defeat' && step.guards) {
    for (const [gx, gy] of step.guards) {
      const g = { x: gx, y: gy, angle: 0, speed: 0, shirt: '#3a3a44', skin: '#c98a5a', state: 'guard', fleeTimer: 0, pauseTimer: 0, guard: true, health: 100, fireTimer: 0.6 + Math.random() * 0.8, homeX: gx, homeY: gy, missionGuard: true };
      state.peds.push(g);
    }
    state.guardsDefeated = 0;
  }
  if (step.type === 'steal' && !state.missionCar) {
    state.missionCar = { defKey: step.carDef || 'senjaGT', x: step.x, y: step.y, angle: 0 };
  }
}

export function updateMissions(state, dt) {
  const step = currentStep(state);
  if (!step || state.missionDone) return;
  const p = state.player;
  const d = dist(p.x, p.y, step.x, step.y);
  state.stepTimer += dt;
  const inCar = !!p.car;

  if (step.type === 'goto' || step.type === 'talk' || step.type === 'collect') {
    if (d < 70) {
      if (step.type === 'collect') playPickup();
      advanceStep(state);
    }
  } else if (step.type === 'steal') {
    if (inCar && p.car.missionTarget) advanceStep(state);
  } else if (step.type === 'deliver') {
    if (d < 90 && inCar) advanceStep(state);
  } else if (step.type === 'escape') {
    if (d < 110 && state.wanted === 0) advanceStep(state);
  } else if (step.type === 'defeat') {
    const remaining = state.peds.filter((g) => g.missionGuard && g.health > 0).length;
    if (remaining === 0 && state.guardsDefeated >= (step.count || 0)) advanceStep(state);
  }
}

function advanceStep(state) {
  state.missionStep += 1;
  if (state.missionStep >= state.mission.steps.length) {
    completeMission(state);
    return;
  }
  const step = currentStep(state);
  state.message = step.label;
  state.messageTimer = 4;
  playPickup();
  spawnStepEntities(state);
}

function completeMission(state) {
  const m = state.mission;
  state.missionDone = true;
  state.player.cash += m.reward;
  state.player.respect += m.respect;
  state.completedMissions += 1;
  state.message = `Misi selesai: ${m.title}! +$${m.reward}, +${m.respect} hormat.`;
  state.messageTimer = 5;
  playMissionDone();
  state.missionCar = null;
  if (typeof state.save === 'function') state.save();
}

export function nextMissionAvailable(state) {
  return state.missionIndex + 1 < MISSIONS.length;
}
