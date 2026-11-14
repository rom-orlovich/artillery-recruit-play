import { save, player, runtime, writeSave, resetSave } from './state.js';
import { resetInputState, releaseGameLock } from './controls.js';
import { showToast } from './hud.js';
import { initEnlistment, openRoleSelectorModal } from './enlistment.js';
import { openShop, closeShop } from './shop.js';
import { openCampaignModal, closeCampaignModal } from './campaign.js';

const MODAL_IDS = [
  'title-screen',
  'enlist-modal',
  'pause-modal',
  'shop-modal',
  'campaign-modal',
  'fire-map-modal',
  'discharge-modal',
  'death-modal'
];

const els = {};
let startGameFn = null;
let onResetFn = null;
let bound = false;

function el(id) {
  if (!els[id]) els[id] = document.getElementById(id);
  return els[id];
}

function isOpen(id) {
  const node = el(id);
  return Boolean(node && !node.classList.contains('hidden'));
}

export function initModalManager(ctx) {
  startGameFn = typeof ctx.startGame === 'function' ? ctx.startGame : null;
  onResetFn = typeof ctx.onReset === 'function' ? ctx.onReset : null;
  for (const id of MODAL_IDS) el(id);
  el('reset-confirm');
}

export function setModalVisible(id, visible) {
  const node = el(id);
  if (!node) return;
  node.classList.toggle('hidden', !visible);
  node.style.display = visible ? 'flex' : 'none';
}

export function isAnyModalOpen() {
  return MODAL_IDS.some((id) => isOpen(id));
}

export function savePlayerPosition() {
  save.playerPos = { x: player.pos.x, z: player.pos.z, yaw: player.yaw };
  writeSave({ immediate: true });
}

export function restorePlayerPosition() {
  const pp = save.playerPos;
  if (!pp || typeof pp.x !== 'number') return;
  player.pos.x = pp.x;
  player.pos.z = pp.z;
  player.yaw = pp.yaw || 0;
  player.pitch = 0;
}

export function openPauseModal() {
  if (runtime.isDead) return;
  savePlayerPosition();
  resetInputState();
  releaseGameLock();
  runtime.modalOpen = true;
  runtime.paused = true;
  runtime.isPlaying = false;
  setModalVisible('pause-modal', true);
}

export function closeAllModals() {
  for (const id of MODAL_IDS) setModalVisible(id, false);
  const confirm = el('reset-confirm');
  if (confirm) confirm.classList.add('hidden');
  runtime.modalOpen = false;
  runtime.shopOpen = false;
  runtime.enlistOpen = false;
  runtime.campaignModalOpen = false;
  runtime.fireMapOpen = false;
  runtime.dischargeModalOpen = false;
  runtime.paused = false;
  runtime.titleActive = false;
  runtime.isDead = false;
  resetInputState();
  if (startGameFn) startGameFn();
}

export function openModalByName(name) {
  if (name === 'pause') {
    openPauseModal();
    return;
  }
  if (name === 'shop') {
    savePlayerPosition();
    resetInputState();
    openShop();
    return;
  }
  if (name === 'campaign') {
    savePlayerPosition();
    resetInputState();
    openCampaignModal();
    return;
  }
  throw new Error(`unknown modal "${name}"`);
}

export function handleEscapeKey() {
  if (isOpen('death-modal')) return;
  if (isOpen('discharge-modal')) {
    setModalVisible('discharge-modal', false);
    runtime.dischargeModalOpen = false;
    if (startGameFn) startGameFn();
    return;
  }
  if (isOpen('fire-map-modal')) {
    setModalVisible('fire-map-modal', false);
    runtime.fireMapOpen = false;
    if (startGameFn) startGameFn();
    return;
  }
  if (runtime.campaignModalOpen) {
    closeCampaignModal();
    if (startGameFn) startGameFn();
    return;
  }
  if (runtime.shopOpen) {
    closeShop();
    if (startGameFn) startGameFn();
    return;
  }
  if (isOpen('pause-modal')) {
    closeAllModals();
    return;
  }
  if (isOpen('title-screen') || isOpen('enlist-modal')) return;
  openPauseModal();
}

function performReset() {
  resetSave();
  if (onResetFn) onResetFn();
  showToast('ההתקדמות אופסה', 2600);
  closeAllModals();
  initEnlistment(startGameFn);
}

export function bindTitleScreen() {
  const newBtn = el('btn-new-game');
  const contBtn = el('btn-continue');
  if (newBtn) {
    newBtn.addEventListener('click', () => {
      setModalVisible('title-screen', false);
      runtime.titleActive = false;
      resetSave();
      initEnlistment(startGameFn);
    });
  }
  if (contBtn) {
    contBtn.addEventListener('click', () => {
      setModalVisible('title-screen', false);
      runtime.titleActive = false;
      restorePlayerPosition();
      if (startGameFn) startGameFn();
    });
  }
}

export function bindPauseMenu() {
  const playBtn = el('btn-play');
  if (playBtn) playBtn.addEventListener('click', () => closeAllModals());
  const changeBtn = el('btn-change-role');
  if (changeBtn) {
    changeBtn.addEventListener('click', () => {
      setModalVisible('pause-modal', false);
      runtime.modalOpen = false;
      openRoleSelectorModal(() => {
        if (startGameFn) startGameFn();
      });
    });
  }
  const resetBtn = el('btn-reset');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      const confirm = el('reset-confirm');
      if (confirm) confirm.classList.remove('hidden');
    });
  }
  const cancelBtn = el('btn-reset-cancel');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      const confirm = el('reset-confirm');
      if (confirm) confirm.classList.add('hidden');
    });
  }
  const confirmBtn = el('btn-reset-confirm');
  if (confirmBtn) confirmBtn.addEventListener('click', () => performReset());
}

export function bindLifecycleHandlers() {
  if (bound) return;
  bound = true;
  const persist = () => savePlayerPosition();
  window.addEventListener('pagehide', persist);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') persist();
  });
}

export function showStartScreen(hasSavedGame) {
  runtime.titleActive = true;
  runtime.isPlaying = false;
  const contBtn = el('btn-continue');
  if (contBtn) contBtn.classList.toggle('hidden', !hasSavedGame);
  setModalVisible('title-screen', true);
  if (!hasSavedGame) initEnlistment(startGameFn);
}
