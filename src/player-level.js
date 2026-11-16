import { EVENTS } from './config.js';
import { emit, on, save, writeSave } from './state.js';

const XP_PER_LEVEL = 100;
const LEVEL_BADGE_ID = 'level-badge';
const LEVEL_PREFIX = 'רמה ';
const LEVEL_UP_PREFIX = 'עלית לרמה ';
const LEVEL_UP_SUFFIX = '!';
const TOAST_DURATION_MS = 3500;

let listenersBound = false;

export function getPlayerLevel(xp = save.xp) {
  const safeXp = typeof xp === 'number' && Number.isFinite(xp) && xp > 0 ? xp : 0;
  return 1 + Math.floor(safeXp / XP_PER_LEVEL);
}

export function syncLevelBadge() {
  if (typeof document === 'undefined') return;
  const el = document.getElementById(LEVEL_BADGE_ID);
  const text = `${LEVEL_PREFIX}${getPlayerLevel()}`;
  if (el && el.textContent !== text) {
    el.textContent = text;
  }
}

export function initPlayerLevel() {
  if (!listenersBound) {
    listenersBound = true;
    on(EVENTS.STATE_CHANGED, syncLevelBadge);
  }
  syncLevelBadge();
}

export function addXp(amount) {
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
    return getPlayerLevel();
  }
  const prevXp = typeof save.xp === 'number' && Number.isFinite(save.xp) && save.xp > 0 ? save.xp : 0;
  const prevLevel = getPlayerLevel(prevXp);
  save.xp = prevXp + amount;
  const nextLevel = getPlayerLevel(save.xp);
  syncLevelBadge();
  if (nextLevel > prevLevel) {
    emit(EVENTS.TOAST, { message: `${LEVEL_UP_PREFIX}${nextLevel}${LEVEL_UP_SUFFIX}`, duration: TOAST_DURATION_MS });
  }
  writeSave();
  return nextLevel;
}
