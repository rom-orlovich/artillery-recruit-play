import { EVENTS, SHOP_ITEMS, MISSIONS, stripKeyHints } from './config.js';
import { save, player, runtime, getCurrentRole, getCurrentRank, on } from './state.js';
import { renderMissionsList, invalidateMissionsListKey } from './hud-missions.js';

const refs = {};
function ref(id) {
  if (!refs[id]) refs[id] = document.getElementById(id);
  return refs[id];
}

let toastTimeout = null;
let radioTimeout = null;
let listenersBound = false;
let lastNearby = null;

let lastStatusKey = '';
let lastAbilityKey = '';
let lastTimerKey = '';
let lastCarryKey = '';
let lastInteractKey = '';
let lastChapterKey = '';
let lastObjectiveKey = '';

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

export function hideRadio() {
  clearTimeout(radioTimeout);
  radioTimeout = null;
  const box = ref('radio-bar');
  const speakerEl = ref('radio-speaker');
  const textEl = ref('radio-text');
  if (box) {
    box.classList.add('hidden');
    box.style.display = 'none';
  }
  if (speakerEl) speakerEl.textContent = '';
  if (textEl) textEl.textContent = '';
}

function ensureVisible(node, fallbackDisplay = 'block') {
  if (!node) return;
  node.classList.remove('hidden');
  node.style.display = '';
  if (typeof window !== 'undefined' && window.getComputedStyle(node).display === 'none') {
    node.style.display = fallbackDisplay;
  }
}

export function showRadio(payload = {}) {
  const speaker = typeof payload?.speaker === 'string' ? payload.speaker.trim() : '';
  const rawText = typeof payload?.text === 'string'
    ? payload.text.trim()
    : (typeof payload?.message === 'string' ? payload.message.trim() : '');
  const text = stripKeyHints(rawText).trim();

  if (!text) {
    hideRadio();
    return;
  }

  const box = ref('radio-bar');
  const speakerEl = ref('radio-speaker');
  const textEl = ref('radio-text');

  ensureVisible(box, 'flex');
  if (speakerEl) {
    speakerEl.textContent = speaker;
    ensureVisible(speakerEl, 'inline');
  }
  if (textEl) {
    textEl.textContent = text;
    ensureVisible(textEl, 'inline');
  }

  const durationMs = typeof payload?.durationMs === 'number'
    ? payload.durationMs
    : (typeof payload?.duration === 'number' ? payload.duration : 4500);
  clearTimeout(radioTimeout);
  if (durationMs > 0) {
    radioTimeout = setTimeout(hideRadio, durationMs);
  }
}

function updateObjectivePill(payload = {}) {
  const textEl = ref('objective-text');
  const distEl = ref('objective-distance');
  const rawText = typeof payload?.text === 'string' && payload.text.trim()
    ? payload.text.trim()
    : (typeof payload?.hudText === 'string' ? payload.hudText.trim() : '');
  const cleaned = stripKeyHints(rawText).trim();
  const displayText = cleaned.length > 36 ? `${cleaned.slice(0, 35)}…` : cleaned;

  if (displayText && displayText !== lastObjectiveKey) {
    lastObjectiveKey = displayText;
    if (textEl) textEl.textContent = displayText;
  } else if (!displayText && textEl && !textEl.textContent.trim()) {
    const fallback = MISSIONS[save.activeMissionId];
    if (textEl) textEl.textContent = stripKeyHints(fallback?.title || 'מטרה פעילה').slice(0, 36);
  }

  if (distEl) {
    const d = typeof payload?.distanceMeters === 'number' && Number.isFinite(payload.distanceMeters)
      ? Math.round(payload.distanceMeters)
      : 0;
    const distText = `${Math.max(0, d)}m`;
    if (distEl.textContent !== distText) distEl.textContent = distText;
  }
}

export function showToast(message, duration = 3200) {
  const banner = ref('toast-banner');
  const cleaned = stripKeyHints(message || '').trim();
  if (!banner || !cleaned) return;
  banner.textContent = cleaned;
  banner.classList.remove('hidden');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    banner.classList.add('hidden');
  }, duration);
}

export function updateHUD(nearbyInteraction) {
  lastNearby = nearbyInteraction || null;
  syncStatusPanel();
  renderMissionsList();

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
      } else {
        carryEl.classList.add('hidden');
      }
    }
  }

  const interactKey = nearbyInteraction && nearbyInteraction.label ? stripKeyHints(nearbyInteraction.label).trim() : '';
  if (interactKey !== lastInteractKey) {
    lastInteractKey = interactKey;
    const interactEl = ref('interact-prompt');
    if (interactEl) {
      if (interactKey) {
        interactEl.textContent = interactKey;
        interactEl.classList.remove('hidden');
      } else {
        interactEl.classList.add('hidden');
      }
    }
  }
}

export function initHUD() {
  if (!listenersBound) {
    listenersBound = true;
    const syncAll = () => {
      updateHUD(lastNearby);
    };
    on(EVENTS.STATE_CHANGED, syncAll);
    on(EVENTS.ROLE_CHANGED, syncAll);
    on(EVENTS.ENLIST_COMPLETED, syncAll);
    on(EVENTS.MISSION_UPDATED, syncAll);
    on(EVENTS.GEAR_PURCHASED, syncAll);
    on(EVENTS.PLAYER_DAMAGED, syncAll);
    on(EVENTS.PLAYER_RESPAWNED, syncAll);
    on(EVENTS.TOAST, (payload) => {
      showToast(payload?.message, payload?.duration || 3200);
    });
    on(EVENTS.MISSION_COMPLETED, (payload) => {
      syncAll();
      const title = payload?.title || 'משימה';
      const rewardText = payload?.moneyReward ? ` (+${payload.moneyReward} ₪, +${payload.scoreReward || 0} נק׳)` : '';
      showToast(`✅ הושלמה: ${title}${rewardText}`, 4000);
    });
    on(EVENTS.RANK_PROMOTED, (payload) => {
      syncAll();
      const rankName = payload?.newRank?.name || '';
      const bonus = payload?.bonusMoney ? ` (+${payload.bonusMoney} ₪)` : '';
      showToast(`🎖️ קידום לדרגת ${rankName}!${bonus}`, 4500);
    });
    on(EVENTS.CEREMONY_UNLOCKED, (payload) => {
      syncAll();
      if (payload?.title) showToast(`🪖 ${payload.title}`, 4800);
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
        showToast(`📖 ${payload.title}`, 4000);
      }
      syncStatusPanel();
    });
    on('campaign:achievement', (payload) => {
      const title = payload?.title || payload?.name || 'הישג חדש';
      const reward = payload?.rewardCoins || payload?.moneyReward || 0;
      const suffix = reward ? ` (+${reward} ₪)` : '';
      showToast(`🏆 הישג נפתח: ${title}${suffix}`, 4500);
    });
    on('mission:objective_updated', (payload) => {
      updateObjectivePill(payload);
      renderMissionsList();
    });
  }

  invalidateMissionsListKey();
  lastStatusKey = '';
  lastAbilityKey = '';
  lastTimerKey = '';
  lastCarryKey = '';
  lastInteractKey = '';
  lastChapterKey = '';
  lastObjectiveKey = '';
  hideRadio();
  updateHUD(null);
  updateObjectivePill({});
}
