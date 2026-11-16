import { player, runtime, save } from './state.js';
import { resetInputState, releaseGameLock } from './controls.js';
import { TASK_KEYS, TASKS, getDialogueChoices, getDialogueLine, isOrderable } from './npc-data.js';
import { getNpcs, issueNpcOrder, setTalkTarget } from './npc.js';
import { initNpcHud, renderTaskBadges, updateNpcHud } from './npc-hud-ui.js';
import { initNpcChatUi, updateNpcChatBubbles } from './npc-chat-ui.js';
import { applyTrustDelta, getTrustGreetingPrefix } from './battery-events.js';
import { getNextRoutineTask, setCommanderRoutineTarget } from './daily-routine.js';

const MAP_PICKER_SPAN_M = 40;
const TRUST_DEFAULT = 50;
const TRUST_DELTA_SUPPORTIVE = 12;
const TRUST_DELTA_STRICT = -5;
const TRUST_DELTA_NEUTRAL = 4;
const COMMANDER_OFFICER_ID = 'outpost_cmd';
const ROUTINE_CHOICE_LABEL = 'מה המשימה להיום?';
const ROUTINE_DONE_ANSWER = 'סיימת את כל השגרה להיום. כל הכבוד!';

let uiReady = false;
let panelEl = null;
let speakerEl = null;
let trustEl = null;
let lineEl = null;
let choicesEl = null;
let orderBtnEl = null;
let orderPickerEl = null;
let mapPickerEl = null;

let activeNpc = null;
let currentChoices = [];

function ensureStylesheet() {
  if (document.getElementById('npc-css-link')) return;
  const link = document.createElement('link');
  link.id = 'npc-css-link';
  link.rel = 'stylesheet';
  link.href = './styles/npc.css';
  document.head.appendChild(link);
}

function updateTrustBadge() {
  if (!trustEl || !activeNpc) return;
  trustEl.textContent = `אמון: ${Math.round(activeNpc.trust ?? TRUST_DEFAULT)}%`;
}

function buildOrderButtons() {
  if (!orderPickerEl) return;
  orderPickerEl.innerHTML = '';
  for (let i = 0; i < TASK_KEYS.length; i++) {
    const key = TASK_KEYS[i];
    const def = TASKS[key];
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'npc-order';
    btn.dataset.task = key;
    btn.textContent = `${def.icon} ${def.label}`;
    btn.addEventListener('click', () => onOrderSelected(key));
    orderPickerEl.appendChild(btn);
  }
}

function onOrderSelected(taskKey) {
  if (!activeNpc) return;
  if (taskKey === 'goto') {
    if (mapPickerEl) mapPickerEl.style.display = 'flex';
    return;
  }
  issueNpcOrder(activeNpc.id, taskKey);
  renderTaskBadges(getNpcs());
  closeDialogue();
}

export function initNpcUi(rootEl = document.body) {
  if (uiReady) return;
  uiReady = true;
  ensureStylesheet();
  initNpcHud(rootEl);
  initNpcChatUi(rootEl);

  panelEl = document.createElement('div');
  panelEl.id = 'npc-dialogue-panel';
  panelEl.dir = 'rtl';
  panelEl.style.display = 'none';
  panelEl.innerHTML =
    '<div class="npc-card">' +
      '<div class="npc-header"><strong id="npc-speaker"></strong><span id="npc-trust-badge"></span></div>' +
      '<p class="npc-line"></p>' +
      '<div class="npc-choices"></div>' +
      '<div id="npc-order-picker" style="display:none"></div>' +
      '<div id="npc-map-picker" style="display:none">' +
        '<div class="npc-map-hint">בחר נקודה על המפה</div>' +
        '<div id="npc-map-pad"></div>' +
      '</div>' +
      '<div class="npc-actions">' +
        '<button type="button" id="npc-order-btn" style="display:none">פקודה</button>' +
        '<button type="button" id="npc-close">סיום</button>' +
      '</div>' +
    '</div>';
  rootEl.appendChild(panelEl);

  speakerEl = panelEl.querySelector('#npc-speaker');
  trustEl = panelEl.querySelector('#npc-trust-badge');
  lineEl = panelEl.querySelector('.npc-line');
  choicesEl = panelEl.querySelector('.npc-choices');
  orderBtnEl = panelEl.querySelector('#npc-order-btn');
  orderPickerEl = panelEl.querySelector('#npc-order-picker');
  mapPickerEl = panelEl.querySelector('#npc-map-picker');

  buildOrderButtons();
  orderBtnEl.addEventListener('click', () => openOrderPicker(activeNpc));
  panelEl.querySelector('#npc-close').addEventListener('click', () => closeDialogue());
  panelEl.querySelector('#npc-map-pad').addEventListener('click', (e) => {
    if (!activeNpc) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / Math.max(1, rect.width) - 0.5) * 2;
    const nz = ((e.clientY - rect.top) / Math.max(1, rect.height) - 0.5) * 2;
    const target = { x: player.pos.x + nx * MAP_PICKER_SPAN_M, y: player.pos.y, z: player.pos.z + nz * MAP_PICKER_SPAN_M };
    issueNpcOrder(activeNpc.id, 'goto', target);
    renderTaskBadges(getNpcs());
    closeDialogue();
  });
}

export function openDialogue(npc, chapterId = 1) {
  initNpcUi();
  if (!npc) return;
  activeNpc = npc;
  if (typeof npc.trust !== 'number') npc.trust = TRUST_DEFAULT;
  runtime.dialogueOpen = true;
  setTalkTarget(npc);
  resetInputState?.();
  releaseGameLock?.();

  speakerEl.textContent = `${npc.rank} ${npc.name} · ${npc.role}`;
  updateTrustBadge();
  const prefix = getTrustGreetingPrefix(npc) || '';
  const baseLine = getDialogueLine(npc, chapterId);
  lineEl.textContent = prefix ? `${prefix}${prefix.endsWith(' ') ? '' : ' '}${baseLine}` : baseLine;

  currentChoices = getDialogueChoices(npc, chapterId);
  if (npc.officerId === COMMANDER_OFFICER_ID) {
    currentChoices = currentChoices.slice();
    currentChoices.push({
      label: ROUTINE_CHOICE_LABEL,
      tone: 'neutral',
      isRoutineQuery: true,
      answer: ''
    });
  }
  choicesEl.innerHTML = '';
  for (let i = 0; i < currentChoices.length; i++) {
    const ch = currentChoices[i];
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'npc-choice';
    btn.dataset.idx = String(i);
    btn.dataset.tone = ch.tone;
    btn.textContent = ch.label;
    btn.addEventListener('click', () => selectChoice(i));
    choicesEl.appendChild(btn);
  }

  const playerRankId = player.rankId || save.rankId || 'turai';
  orderBtnEl.style.display = isOrderable(npc.rank, playerRankId) ? 'inline-flex' : 'none';
  orderPickerEl.style.display = 'none';
  mapPickerEl.style.display = 'none';
  panelEl.style.display = 'flex';
}

export function selectChoice(index) {
  initNpcUi();
  if (!activeNpc || !currentChoices.length) return;
  const i = Math.max(0, Math.min(currentChoices.length - 1, index | 0));
  const choice = currentChoices[i];
  if (!choice) return;
  if (choice.isRoutineQuery) {
    const nextTask = getNextRoutineTask();
    if (nextTask) {
      setCommanderRoutineTarget(nextTask.id);
      lineEl.textContent = `היום: ${nextTask.title} — גש ל${nextTask.stationHint}`;
    } else {
      setCommanderRoutineTarget(null);
      lineEl.textContent = ROUTINE_DONE_ANSWER;
    }
  } else {
    lineEl.textContent = choice.answer;
  }
  const delta = choice.tone === 'supportive' ? TRUST_DELTA_SUPPORTIVE : (choice.tone === 'strict' ? TRUST_DELTA_STRICT : TRUST_DELTA_NEUTRAL);
  applyTrustDelta(activeNpc, delta);
  activeNpc.trust = Math.max(0, Math.min(100, activeNpc.trust ?? TRUST_DEFAULT));
  updateTrustBadge();
}

export function openOrderPicker(npc) {
  initNpcUi();
  if (npc) activeNpc = npc;
  if (orderPickerEl) {
    if (!orderPickerEl.children.length) buildOrderButtons();
    orderPickerEl.style.display = 'flex';
  }
  if (mapPickerEl) mapPickerEl.style.display = 'none';
}

export function closeDialogue() {
  if (!uiReady) return;
  panelEl.style.display = 'none';
  orderPickerEl.style.display = 'none';
  mapPickerEl.style.display = 'none';
  activeNpc = null;
  setTalkTarget(null);
  runtime.dialogueOpen = false;
  if (!runtime.isDead && !runtime.titleActive && !runtime.modalOpen) runtime.isPlaying = true;
}

export function updateNpcUi(nearestNpc, playerRankId, camera) {
  initNpcUi();
  updateNpcHud(nearestNpc, camera, getNpcs());
  updateNpcChatBubbles(camera, getNpcs(), player.pos);
}
