import { runtime } from './state.js';

const DEFAULT_TIME_OF_DAY = 10;
const GAME_HOURS_PER_REAL_SEC = 1 / 60;

let timeChangeListener = null;

function normalizeHours(hours) {
  return ((Number(hours) % 24) + 24) % 24;
}

export function ensureTimeOfDay() {
  if (typeof runtime.timeOfDay !== 'number' || !Number.isFinite(runtime.timeOfDay)) {
    runtime.timeOfDay = DEFAULT_TIME_OF_DAY;
  }
  return normalizeHours(runtime.timeOfDay);
}

export function getSkyPhase(hours) {
  const h = hours === undefined ? ensureTimeOfDay() : normalizeHours(hours);
  if (h >= 5 && h < 7) return 'dawn';
  if (h >= 7 && h < 17) return 'day';
  if (h >= 17 && h < 19.5) return 'dusk';
  return 'night';
}

export function setTimeOfDay(hours) {
  if (typeof hours !== 'number' || !Number.isFinite(hours)) return ensureTimeOfDay();
  runtime.timeOfDay = normalizeHours(hours);
  if (timeChangeListener) timeChangeListener();
  return runtime.timeOfDay;
}

export function registerTimeListener(fn) {
  timeChangeListener = fn;
}

export function advanceGameClock(dtSec) {
  if (typeof runtime.forcedTimeOfDay === 'number' && Number.isFinite(runtime.forcedTimeOfDay)) {
    runtime.timeOfDay = normalizeHours(runtime.forcedTimeOfDay);
    return runtime.timeOfDay;
  }
  const cur = ensureTimeOfDay();
  if (
    runtime.paused ||
    runtime.titleActive ||
    runtime.modalOpen ||
    runtime.shopOpen ||
    runtime.campaignModalOpen ||
    runtime.enlistOpen ||
    dtSec <= 0
  ) return cur;
  runtime.timeOfDay = normalizeHours(cur + dtSec * GAME_HOURS_PER_REAL_SEC);
  return runtime.timeOfDay;
}

export function formatClock(hours) {
  const h = hours === undefined ? ensureTimeOfDay() : normalizeHours(hours);
  const totalMinutes = Math.floor(h * 60 + 1e-6) % 1440;
  const hh = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
  const mm = String(totalMinutes % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}
