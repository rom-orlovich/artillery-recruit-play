import { runtime } from './state.js';

const RESERVE_MAPS = new Set(['zaura', 'beit_hillel', 'kadita']);
const DECAY_ALERT_IDLE = 0.35;
const DECAY_ALERT_GUARD = 0.08;
const DECAY_MORALE = 0.22;
const HUD_ID = 'fun-battery-hud';

const readiness = { alertness: 100, ammo: 100, morale: 100 };
let hudEl = null;
let hudStatusEl = null;
let hudReadinessEl = null;
let lastStatusText = '';
let lastReadinessText = '';

const CRISIS_LABELS = {
  event_drone_swarm: 'התראת רחפנים',
  event_night_illum: 'ירי תאורה לילי',
  event_generator_out: 'תקלת גנרטור'
};

export function getReadinessState() {
  return readiness;
}

export function refillReadiness(field, value = 100) {
  if (field in readiness) {
    readiness[field] = Math.max(0, Math.min(100, value));
  }
}

export function updateBatteryReadiness(dt, mapId, hasSentry) {
  const isReserve = RESERVE_MAPS.has(mapId);
  const decayScale = isReserve ? 1 : 0.4;
  const alertDecay = hasSentry ? DECAY_ALERT_GUARD : DECAY_ALERT_IDLE;
  readiness.alertness = Math.max(0, readiness.alertness - alertDecay * decayScale * dt);
  if ((runtime.moraleBuffSec ?? 0) > 0) {
    readiness.morale = 100;
  } else {
    readiness.morale = Math.max(0, readiness.morale - DECAY_MORALE * decayScale * dt);
  }
  const ammoCount = runtime.gunAmmo?.hero ?? 0;
  readiness.ammo = Math.min(100, Math.round((ammoCount / 8) * 100));
}

export function initShiftHud() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(HUD_ID)) {
    hudEl = document.getElementById(HUD_ID);
    return;
  }
  const el = document.createElement('div');
  el.id = HUD_ID;
  el.dir = 'rtl';
  el.style.cssText = [
    'position:fixed',
    'top:52px',
    'right:10px',
    'z-index:25',
    'pointer-events:none',
    'display:flex',
    'flex-direction:column',
    'gap:3px',
    'padding:5px 9px',
    'border-radius:8px',
    'background:rgba(15,23,20,0.68)',
    'border:1px solid rgba(116,198,157,0.32)',
    'color:#e8f5e9',
    'font-family:system-ui,sans-serif',
    'font-size:11px',
    'line-height:1.25'
  ].join(';');
  hudReadinessEl = document.createElement('div');
  hudStatusEl = document.createElement('div');
  el.appendChild(hudReadinessEl);
  el.appendChild(hudStatusEl);
  document.body.appendChild(el);
  hudEl = el;
}

export function updateShiftHud(fireState, eventsState) {
  if (!hudEl || !hudReadinessEl || !hudStatusEl) return;
  const visible = Boolean(runtime.isPlaying && !runtime.titleActive);
  hudEl.style.display = visible ? 'flex' : 'none';
  if (!visible) return;
  const a = Math.round(readiness.alertness);
  const m = Math.round(readiness.ammo);
  const r = Math.round(readiness.morale);
  const rText = `כשירות | ערנות ${a}% · תחמושת ${m}% · מורל ${r}%`;
  if (rText !== lastReadinessText) {
    lastReadinessText = rText;
    hudReadinessEl.textContent = rText;
  }
  let sText = '';
  if (eventsState?.activeCrisis) {
    const label = CRISIS_LABELS[eventsState.activeCrisis] || eventsState.activeCrisis;
    sText = `אירוע: ${label} (${Math.ceil(eventsState.crisisTimer || 0)} שנ')`;
  } else if ((fireState?.scootTimer ?? 0) > 0) {
    sText = `סע-ירה: ${Math.ceil(fireState.scootTimer)} שנ' לדילוג`;
  } else if ((runtime.fireStreak ?? 0) > 1) {
    sText = `קצב אש ×${fireState?.streakMultiplier ?? 1} (רצף ${runtime.fireStreak})`;
  } else if ((runtime.moraleBuffSec ?? 0) > 0) {
    sText = `תוסף מטבח שדה: ${Math.ceil(runtime.moraleBuffSec)} שנ'`;
  }
  if (sText !== lastStatusText) {
    lastStatusText = sText;
    hudStatusEl.textContent = sText;
    hudStatusEl.style.display = sText ? 'block' : 'none';
  }
}
