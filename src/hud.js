import { EVENTS, SHOP_ITEMS, stripKeyHints } from './config.js';
import { save, player, runtime, getCurrentRole, getCurrentRank, on } from './state.js';
import { renderMissionsList, invalidateMissionsListKey, initMissionsPanel } from './hud-missions.js';
import { getCurrentTarget } from './current-target.js';
import { ensureHitMarker, showHitMarker, hideRadio, showRadio, showToast } from './hud-feedback.js';
import { formatClock } from './world-time.js';

export { showHitMarker, hideRadio, showRadio, showToast };


const refs = {};
function ref(id) {
  if (!refs[id]) refs[id] = document.getElementById(id);
  return refs[id];
}

const ACTION_LABELS = {
  pickup_sandbag: 'הרם שק',
  drop_sandbag: 'הנח שק',
  campaign_pickup: 'הרם פריט',
  campaign_drop: 'הנח פריט',
  campaign_interact: 'בצע פעולה',
  shop: 'אפסנאות',
  clinic: 'מרפאה',
  barracks: 'מסדר',
  start_range: 'מטווח',
  pickup_shell: 'הרם פגז',
  load_shell: 'טען פגז',
  fire_doher: 'ירי סוללתי',
  calibrate_roem: 'כייל צומת',
  launch_uav: 'שגר כטמ"ם',
  calibrate_radar: 'כייל מכ"ם',
  talk: 'דבר',
  dialogue: 'דבר',
  npc: 'דבר'
};

let listenersBound = false;
let lastNearby = null;
let interactLabelEl = null;

let lastStatusKey = '';
let lastAbilityKey = '';
let lastTimerKey = '';
let lastCarryKey = '';
let lastInteractKey = null;
let lastChapterKey = '';
let lastObjectiveKey = '';
let lastClockKey = '';

function getContextActionLabel(nearby) {
  if (!nearby) return '';
  if (nearby.shortLabel) return stripKeyHints(nearby.shortLabel).trim();
  if (nearby.type && ACTION_LABELS[nearby.type]) return ACTION_LABELS[nearby.type];
  const raw = stripKeyHints(nearby.label || '').replace(/^\[[^\]]+\]\s*/, '').trim();
  if (!raw) return 'פעולה';
  const head = raw.split(/[—\-]/)[0].trim();
  const words = head.split(/\s+/).filter(Boolean);
  return words.slice(0, 2).join(' ') || 'פעולה';
}

function syncStatusPanel() {
  const role = getCurrentRole();
  const rank = getCurrentRank();
  const rankDisplay = save.rank || rank.name;
  const ceilHp = Math.ceil(player.hp);
  const gearKey = SHOP_ITEMS.map((i) => (save.gear[i.id] ? '1' : '0')).join('');
  const statusKey = `${rankDisplay}|${save.profile.name}|${role.name}|${save.day}|${save.ceremonies.turquoiseBeret ? 1 : 0}|${save.ceremonies.fighterPin ? 1 : 0}|${ceilHp}|${player.maxHp}|${save.money}|${save.score}|${gearKey}`;

  if (statusKey === lastStatusKey) return;
  lastStatusKey = statusKey;

  const titleEl = ref('soldier-title');
  const rankEl = ref('rank-badge');
  const dayEl = ref('day-text');
  const beretEl = ref('beret-badge');
  const hpText = ref('hp-text');
  const hpFill = ref('hp-bar-fill');
  const moneyEl = ref('money-text');
  const scoreEl = ref('score-text');
  const armorEl = ref('armor-pct');

  if (titleEl) titleEl.textContent = `${rankDisplay} ${save.profile.name} — ${role.name}`;
  if (rankEl) rankEl.textContent = rankDisplay;
  if (dayEl) dayEl.textContent = `יום ${save.day}`;

  if (beretEl) {
    if (save.ceremonies.turquoiseBeret && save.ceremonies.fighterPin) {
      beretEl.textContent = '🪖 כומתת טורקיז | 🎖️ סיכת לוחם';
    } else if (save.ceremonies.turquoiseBeret) {
      beretEl.textContent = '🪖 כומתת טורקיז';
    } else if (save.ceremonies.fighterPin) {
      beretEl.textContent = '🎖️ סיכת לוחם';
    } else {
      beretEl.textContent = '🪖 טירון';
    }
  }

  const hpPct = Math.max(0, Math.min(100, (player.hp / player.maxHp) * 100));
  if (hpText) hpText.textContent = `${ceilHp} / ${player.maxHp}`;
  if (hpFill) {
    hpFill.style.width = `${hpPct}%`;
    if (hpPct <= 25) hpFill.style.background = 'linear-gradient(90deg, #c93b32, #ef5b50)';
    else if (hpPct <= 55) hpFill.style.background = 'linear-gradient(90deg, #d99b26, #ffd15c)';
    else hpFill.style.background = 'linear-gradient(90deg, #43b56c, #79d97d)';
  }

  if (moneyEl) moneyEl.textContent = `${save.money} ₪`;
  if (scoreEl) scoreEl.textContent = `${save.score}`;

  const armorPct = (save.gear.helmet ? 25 : 0) + (save.gear.vest ? 40 : 0);
  if (armorEl) armorEl.textContent = `${armorPct}%`;

  for (const item of SHOP_ITEMS) {
    const chip = ref(`gear-${item.id}`);
    if (chip) chip.classList.toggle('owned', Boolean(save.gear[item.id]));
  }
}

function updateClock() {
  const clockEl = ref('clock-text');
  if (!clockEl) return;
  const clockText = formatClock();
  if (clockText !== lastClockKey) {
    lastClockKey = clockText;
    clockEl.textContent = clockText;
    clockEl.classList.remove('hidden');
  }
}

function updateObjectivePill() {
  const textEl = ref('objective-text');
  const distEl = ref('objective-distance');
  const target = getCurrentTarget();
  const cleaned = target?.text ? stripKeyHints(target.text).trim() : '';
  const rawDisplay = cleaned || (target ? 'משימה פעילה' : 'אין משימה פעילה');
  const displayText = rawDisplay.length > 36 ? `${rawDisplay.slice(0, 35)}…` : rawDisplay;

  if (displayText !== lastObjectiveKey) {
    lastObjectiveKey = displayText;
    if (textEl) textEl.textContent = displayText;
  }

  if (distEl) {
    const distText = target ? `${Math.max(0, Math.round(Math.hypot(target.x - player.pos.x, target.z - player.pos.z)))}m` : '';
    if (distEl.textContent !== distText) distEl.textContent = distText;
  }
}

export function updateHUD(nearbyInteraction) {
  lastNearby = nearbyInteraction || null;
  syncStatusPanel();
  updateClock();
  renderMissionsList();
  updateObjectivePill();

  const role = getCurrentRole();
  const activeSec = runtime.abilityActiveLeft > 0 ? Math.ceil(runtime.abilityActiveLeft) : 0;
  const cdSec = runtime.abilityCooldownLeft > 0 ? Math.ceil(runtime.abilityCooldownLeft) : 0;
  const abilityStatusText = activeSec > 0
    ? `פעיל (${activeSec}ש׳)`
    : (cdSec > 0 ? `טעינה (${cdSec}ש׳)` : stripKeyHints('מוכן [Q]'));
  const abilityTitle = role.abilityName || 'יכולת תפקיד';
  const abilityKey = `${abilityTitle}|${abilityStatusText}`;
  if (abilityKey !== lastAbilityKey) {
    lastAbilityKey = abilityKey;
    const abilityNameEl = ref('ability-name');
    const abilityStatusEl = ref('ability-status');
    if (abilityNameEl) abilityNameEl.textContent = abilityTitle;
    if (abilityStatusEl) abilityStatusEl.textContent = abilityStatusText;
  }

  let timerKey = 'none';
  if (runtime.rangeActive) {
    timerKey = `range|${Math.ceil(runtime.rangeTimeLeft)}|${runtime.rangeHits}|10`;
  } else if (runtime.roemRapidActive) {
    timerKey = `roem|${Math.ceil(runtime.roemRapidTimeLeft)}|${runtime.roemRapidHits}|6`;
  }
  if (timerKey !== lastTimerKey) {
    lastTimerKey = timerKey;
    const timerBox = ref('range-timer-box');
    const timerVal = ref('range-timer-val');
    const hitsVal = ref('range-hits-val');
    const totalVal = ref('range-target-total');
    if (timerBox) {
      if (runtime.rangeActive) {
        timerBox.classList.remove('hidden');
        if (timerVal) timerVal.textContent = `${Math.ceil(runtime.rangeTimeLeft)}`;
        if (hitsVal) hitsVal.textContent = `${runtime.rangeHits}`;
        if (totalVal) totalVal.textContent = '10';
      } else if (runtime.roemRapidActive) {
        timerBox.classList.remove('hidden');
        if (timerVal) timerVal.textContent = `${Math.ceil(runtime.roemRapidTimeLeft)}`;
        if (hitsVal) hitsVal.textContent = `${runtime.roemRapidHits}`;
        if (totalVal) totalVal.textContent = '6';
      } else {
        timerBox.classList.add('hidden');
      }
    }
  }

  const carryKey = player.carryingType || '';
  if (carryKey !== lastCarryKey) {
    lastCarryKey = carryKey;
    const carryEl = ref('carry-indicator');
    if (carryEl) {
      if (carryKey === 'sandbag') {
        carryEl.textContent = stripKeyHints('🧱 נושא שק חול — הנח בעמדה הירוקה בשער הצפוני [E]');
        carryEl.classList.remove('hidden');
      } else if (carryKey === 'shell') {
        carryEl.textContent = stripKeyHints('💣 נושא פגז 155 מ"מ — טען לסדן תומ"ת "דוהר" [E]');
        carryEl.classList.remove('hidden');
      } else if (carryKey) {
        carryEl.textContent = stripKeyHints('📦 נושא ציוד — הבא לנקודת הפריקה [E]');
        carryEl.classList.remove('hidden');
      } else {
        carryEl.classList.add('hidden');
      }
    }
  }

  const cleanPrompt = nearbyInteraction?.label ? stripKeyHints(nearbyInteraction.label).trim() : '';
  const interactKey = nearbyInteraction ? `${nearbyInteraction.type || ''}|${cleanPrompt}` : '';
  if (interactKey !== lastInteractKey) {
    lastInteractKey = interactKey;
    const interactEl = ref('interact-prompt');
    if (interactEl) {
      if (cleanPrompt) {
        interactEl.textContent = cleanPrompt;
        interactEl.classList.remove('hidden');
      } else {
        interactEl.classList.add('hidden');
      }
    }
    const btnInteract = ref('btn-touch-interact');
    if (btnInteract) {
      if (!interactLabelEl) interactLabelEl = btnInteract.querySelector('.label');
      const actionLabel = getContextActionLabel(nearbyInteraction);
      if (actionLabel) {
        if (interactLabelEl) interactLabelEl.textContent = actionLabel;
        btnInteract.classList.remove('hidden');
        btnInteract.classList.add('pulse');
      } else {
        if (interactLabelEl) interactLabelEl.textContent = 'פעולה';
        btnInteract.classList.add('hidden');
        btnInteract.classList.remove('pulse');
      }
    }
  }
}

export function initHUD() {
  ensureHitMarker();
  if (!listenersBound) {
    listenersBound = true;
    const syncAll = () => {
      updateHUD(lastNearby);
    };
    const statusEl = ref('hud-status');
    if (statusEl) {
      statusEl.addEventListener('click', (e) => {
        if (e.target && e.target.closest && e.target.closest('button')) return;
        const expanded = statusEl.classList.toggle('expanded');
        statusEl.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      });
    }
    on(EVENTS.STATE_CHANGED, syncAll);
    on(EVENTS.ROLE_CHANGED, syncAll);
    on(EVENTS.ENLIST_COMPLETED, syncAll);
    on(EVENTS.MISSION_UPDATED, syncAll);
    on(EVENTS.GEAR_PURCHASED, syncAll);
    on(EVENTS.PLAYER_DAMAGED, syncAll);
    on(EVENTS.PLAYER_RESPAWNED, syncAll);
    on('combat:hit', showHitMarker);
    on(EVENTS.RANGE_HIT, showHitMarker);
    on(EVENTS.DRONE_DESTROYED, showHitMarker);
    on(EVENTS.TOAST, (payload) => {
      showToast(payload?.message, payload?.duration || 2500);
    });
    on(EVENTS.MISSION_COMPLETED, (payload) => {
      syncAll();
      const title = payload?.title || 'משימה';
      const rewardText = payload?.moneyReward ? ` (+${payload.moneyReward} ₪, +${payload.scoreReward || 0} נק׳)` : '';
      showToast(`✅ הושלמה: ${title}${rewardText}`, 2500);
    });
    on(EVENTS.RANK_PROMOTED, (payload) => {
      syncAll();
      const rankName = payload?.newRank?.name || '';
      const bonus = payload?.bonusMoney ? ` (+${payload.bonusMoney} ₪)` : '';
      showToast(`🎖️ קידום לדרגת ${rankName}!${bonus}`, 2500);
    });
    on(EVENTS.CEREMONY_UNLOCKED, (payload) => {
      syncAll();
      if (payload?.title) showToast(`🪖 ${payload.title}`, 2500);
    });
    on('ui:radio', (payload) => {
      showRadio(payload);
    });
    on('campaign:chapter_changed', (payload) => {
      const badge = ref('chapter-badge');
      const label = payload?.title
        ? (payload.chapterNumber ? `פרק ${payload.chapterNumber}: ${payload.title}` : payload.title)
        : (payload?.chapterId || '');
      if (badge && label && label !== lastChapterKey) {
        lastChapterKey = label;
        badge.textContent = label;
        badge.classList.remove('hidden');
      }
      if (payload?.title) {
        showToast(`📖 ${payload.title}`, 2500);
      }
      syncStatusPanel();
    });
    on('campaign:achievement', (payload) => {
      const title = payload?.title || payload?.name || 'הישג חדש';
      const reward = payload?.rewardCoins || payload?.moneyReward || 0;
      const suffix = reward ? ` (+${reward} ₪)` : '';
      showToast(`🏆 הישג נפתח: ${title}${suffix}`, 2500);
    });
    on('mission:objective_updated', () => {
      updateObjectivePill();
      renderMissionsList();
    });
  }

  invalidateMissionsListKey();
  initMissionsPanel();
  lastStatusKey = '';
  lastAbilityKey = '';
  lastTimerKey = '';
  lastCarryKey = '';
  lastInteractKey = null;
  lastChapterKey = '';
  lastObjectiveKey = '';
  lastClockKey = '';
  hideRadio();
  updateHUD(null);
  updateObjectivePill();
}
