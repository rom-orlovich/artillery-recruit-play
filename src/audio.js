import { EVENTS } from './config.js';
import { on } from './state.js';

let audioCtx = null;
let masterGain = null;
let masterVolume = 0.8;
let noiseBuffer = null;
let initialized = false;

function buildNoiseBuffer(ctx) {
  const sampleRate = ctx.sampleRate || 44100;
  const length = Math.floor(sampleRate * 0.6);
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

export function ensureAudio() {
  try {
    if (!audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      audioCtx = new Ctx();
      masterGain = audioCtx.createGain();
      masterGain.gain.value = masterVolume;
      masterGain.connect(audioCtx.destination);
      noiseBuffer = buildNoiseBuffer(audioCtx);
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  } catch {
    return null;
  }
}

export function setVolume(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return masterVolume;
  masterVolume = Math.max(0, Math.min(1, num));
  if (masterGain) {
    masterGain.gain.value = masterVolume;
  }
  return masterVolume;
}

export function getVolume() {
  return masterGain ? masterGain.gain.value : masterVolume;
}

function playTone(type, startFreq, endFreq, duration, gainPeak = 0.2, delay = 0) {
  const ctx = ensureAudio();
  if (!ctx || ctx.state !== 'running') return;
  const t = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(startFreq, t);
  if (endFreq !== startFreq) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t + duration);
  }
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.linearRampToValueAtTime(gainPeak, t + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(gain);
  gain.connect(masterGain || ctx.destination);
  osc.start(t);
  osc.stop(t + duration + 0.02);
}

function playNoise(filterType, filterFreq, duration, gainPeak = 0.25, delay = 0) {
  const ctx = ensureAudio();
  if (!ctx || ctx.state !== 'running' || !noiseBuffer) return;
  const t = ctx.currentTime + delay;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  const filter = ctx.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.setValueAtTime(filterFreq, t);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(gainPeak, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(masterGain || ctx.destination);
  src.start(t);
  src.stop(t + duration + 0.02);
}

export function playShootSound() {
  playNoise('bandpass', 1400, 0.11, 0.28);
  playTone('triangle', 220, 65, 0.09, 0.24);
}

export function playCannonSound() {
  playNoise('lowpass', 420, 0.52, 0.42);
  playTone('sine', 110, 32, 0.48, 0.4);
}

export function playTargetHitSound() {
  playTone('sine', 880, 1280, 0.09, 0.18);
  playTone('triangle', 1320, 1560, 0.11, 0.12, 0.05);
}

export function playExplosionSound() {
  playNoise('lowpass', 650, 0.4, 0.35);
  playTone('sawtooth', 140, 36, 0.34, 0.28);
}

export function playSuccessSound() {
  playTone('triangle', 523.25, 523.25, 0.12, 0.16, 0);
  playTone('triangle', 659.25, 659.25, 0.12, 0.16, 0.09);
  playTone('triangle', 783.99, 783.99, 0.14, 0.16, 0.18);
  playTone('triangle', 1046.5, 1046.5, 0.24, 0.18, 0.27);
}

export function playStepThud() {
  playTone('sine', 95, 45, 0.07, 0.09);
}

export function playHurtSound() {
  playTone('sawtooth', 190, 75, 0.18, 0.24);
  playNoise('lowpass', 500, 0.14, 0.15);
}

export function playRadarPingSound() {
  playTone('sine', 1420, 1380, 0.22, 0.14);
  playTone('sine', 1420, 1380, 0.18, 0.08, 0.16);
}

export function playThreatAlarmSound(severity = 'red') {
  if (getVolume() <= 0) return;
  if (severity === 'amber') {
    playTone('triangle', 660, 880, 0.12, 0.16, 0);
    playTone('triangle', 880, 660, 0.12, 0.14, 0.14);
    return;
  }
  playTone('sawtooth', 780, 980, 0.11, 0.18, 0);
  playTone('sawtooth', 980, 740, 0.11, 0.18, 0.13);
  playTone('sawtooth', 780, 980, 0.13, 0.16, 0.26);
}

export function initAudio() {
  if (initialized) return;
  initialized = true;
  if (typeof window !== 'undefined') {
    window.addEventListener('pointerdown', () => ensureAudio(), { once: true, passive: true });
  }
  on(EVENTS.WEAPON_FIRED, () => playShootSound());
  on(EVENTS.RANGE_HIT, () => playTargetHitSound());
  on(EVENTS.DRONE_DESTROYED, () => playExplosionSound());
  on(EVENTS.MISSION_COMPLETED, () => playSuccessSound());
  on(EVENTS.RANK_PROMOTED, () => playSuccessSound());
  on(EVENTS.CEREMONY_UNLOCKED, () => playSuccessSound());
  on(EVENTS.PLAYER_DAMAGED, () => playHurtSound());
  on(EVENTS.ABILITY_USED, (payload) => {
    if (payload?.roleId === 'doher') playCannonSound();
    else if (payload?.roleId === 'rokhash' || payload?.roleId === 'mafik') playRadarPingSound();
    else playSuccessSound();
  });
}
