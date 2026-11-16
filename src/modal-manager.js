import { runtime, resetSave } from './state.js';
import { resetInputState, releaseGameLock } from './controls.js';
import { showToast } from './hud.js';
import { initEnlistment, openRoleSelectorModal } from './enlistment.js';
import { openShop, closeShop } from './shop.js';
import { openCampaignModal, closeCampaignModal } from './campaign.js';
import { initSettings, openSettingsModal, closeSettingsModal } from './settings.js';
import { appContext } from './main.js';
import {
  MODAL_IDS,
  el,
  isOpen,
  setModalVisible,
  isAnyModalOpen,
  hasUsableSave,
  stopTitlePan,
  startTitlePan,
  requestPlayFullscreen,
  savePlayerPosition,
  restorePlayerPosition
} from './modal-helpers.js';

export { setModalVisible, isAnyModalOpen, savePlayerPosition, restorePlayerPosition };

let startGameFn = null;
let onResetFn = null;
let bound = false;
let confirmRoleBound = false;
let extraBound = false;

function closeFullMap() {
  setModalVisible('full-map-modal', false);
  runtime.fullMapOpen = false;
  runtime.modalOpen = false;
  if (startGameFn) startGameFn();
}

function openFullMapFromPause() {
  setModalVisible('pause-modal', false);
  runtime.paused = false;
  runtime.modalOpen = false;
  runtime.isPlaying = true;
  const minimapMod = appContext && appContext.modules && appContext.modules.minimap;
  if (minimapMod && typeof minimapMod.openFullMap === 'function') {
    minimapMod.openFullMap();
  } else {
    setModalVisible('full-map-modal', true);
    if (minimapMod && typeof minimapMod.drawFullMap === 'function') {
      minimapMod.drawFullMap();
    }
  }
  runtime.modalOpen = true;
  runtime.fullMapOpen = true;
}

function openTitleModal(showContinue) {
  runtime.titleActive = true;
  runtime.isPlaying = false;
  const contBtn = el('btn-continue');
  const newBtn = el('btn-new-game');
  el('title-new-confirm')?.classList.add('hidden');

  if (contBtn) {
    contBtn.classList.toggle('hidden', !showContinue);
    contBtn.classList.toggle('btn-primary', showContinue);
    contBtn.classList.toggle('btn-secondary', !showContinue);
  }
  if (newBtn) {
    newBtn.classList.toggle('btn-primary', !showContinue);
    newBtn.classList.toggle('btn-secondary', showContinue);
    newBtn.textContent = 'התגייס לחיל התותחנים ◀';
  }
  setModalVisible('title-screen', true);
  startTitlePan();
}

export function initModalManager(ctx) {
  startGameFn = typeof ctx.startGame === 'function' ? ctx.startGame : null;
  onResetFn = typeof ctx.onReset === 'function' ? ctx.onReset : null;
  for (const id of MODAL_IDS) el(id);
  el('reset-confirm');
  initSettings(() => {
    if (startGameFn) startGameFn();
  });

  if (!confirmRoleBound) {
    const confirmRoleBtn = el('btn-confirm-role');
    if (confirmRoleBtn) {
      confirmRoleBtn.addEventListener('click', requestPlayFullscreen);
      confirmRoleBound = true;
    }
  }

  if (!extraBound) {
    extraBound = true;
    el('btn-close-pause')?.addEventListener('click', () => {
      requestPlayFullscreen();
      closeAllModals();
    });
    el('btn-close-full-map')?.addEventListener('click', closeFullMap);
    el('btn-full-map-done')?.addEventListener('click', closeFullMap);
    el('btn-campaign-done')?.addEventListener('click', () => {
      closeCampaignModal();
      if (startGameFn) startGameFn();
    });
    el('btn-fire-map-done')?.addEventListener('click', () => {
      setModalVisible('fire-map-modal', false);
      runtime.fireMapOpen = false;
      if (startGameFn) startGameFn();
    });
    el('btn-close-discharge')?.addEventListener('click', () => {
      setModalVisible('discharge-modal', false);
      runtime.dischargeModalOpen = false;
      if (startGameFn) startGameFn();
    });
    el('btn-close-death')?.addEventListener('click', () => {
      el('btn-respawn')?.click();
    });

    const closeEnlist = () => {
      setModalVisible('enlist-modal', false);
      runtime.enlistOpen = false;
      openTitleModal(hasUsableSave());
    };
    el('btn-close-enlist')?.addEventListener('click', closeEnlist);
    el('btn-close-enlist-gibbush')?.addEventListener('click', closeEnlist);
    document.querySelectorAll('.enlist-close-btn').forEach((btn) => {
      btn.addEventListener('click', closeEnlist);
    });
  }
}

export function openPauseModal() {
  if (runtime.isDead) return;
  savePlayerPosition();
  resetInputState();
  releaseGameLock();
  runtime.modalOpen = true;
  runtime.paused = true;
  runtime.isPlaying = false;
  el('reset-confirm')?.classList.add('hidden');
  setModalVisible('pause-modal', true);
}

export function closeAllModals() {
  stopTitlePan();
  for (const id of MODAL_IDS) setModalVisible(id, false);
  el('reset-confirm')?.classList.add('hidden');
  el('title-new-confirm')?.classList.add('hidden');
  runtime.modalOpen = false;
  runtime.shopOpen = false;
  runtime.enlistOpen = false;
  runtime.campaignModalOpen = false;
  runtime.fireMapOpen = false;
  runtime.fullMapOpen = false;
  runtime.settingsOpen = false;
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
  if (name === 'settings') {
    savePlayerPosition();
    resetInputState();
    openSettingsModal();
    return;
  }
  if (name === 'map' || name === 'full-map-modal' || name === 'full-map') {
    savePlayerPosition();
    resetInputState();
    openFullMapFromPause();
    return;
  }
  throw new Error(`unknown modal "${name}"`);
}

export function handleEscapeKey() {
  if (isOpen('death-modal')) return;
  if (isOpen('settings-modal')) {
    closeSettingsModal(() => {
      if (startGameFn) startGameFn();
    });
    return;
  }
  if (isOpen('full-map-modal')) {
    closeFullMap();
    return;
  }
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
    requestPlayFullscreen();
    closeAllModals();
    return;
  }
  if (isOpen('title-screen') || isOpen('enlist-modal')) return;
  openPauseModal();
}

function performReset() {
  resetSave();
  if (onResetFn) onResetFn();
  showToast('ההתקדמות אופסה', 2500);
  closeAllModals();
  initEnlistment(startGameFn);
}

function startFreshEnlistment() {
  stopTitlePan();
  requestPlayFullscreen();
  setModalVisible('title-screen', false);
  el('title-new-confirm')?.classList.add('hidden');
  runtime.titleActive = false;
  resetSave();
  if (onResetFn) onResetFn();
  initEnlistment(startGameFn);
}

export function bindTitleScreen() {
  const newBtn = el('btn-new-game');
  const contBtn = el('btn-continue');
  const confirmBox = el('title-new-confirm');
  const confirmBtn = el('btn-title-new-confirm');
  const cancelBtn = el('btn-title-new-cancel');

  if (newBtn) {
    newBtn.addEventListener('click', () => {
      if (contBtn && !contBtn.classList.contains('hidden') && confirmBox) {
        confirmBox.classList.remove('hidden');
        return;
      }
      startFreshEnlistment();
    });
  }
  if (confirmBtn) {
    confirmBtn.addEventListener('click', startFreshEnlistment);
  }
  if (cancelBtn && confirmBox) {
    cancelBtn.addEventListener('click', () => confirmBox.classList.add('hidden'));
  }
  if (contBtn) {
    contBtn.addEventListener('click', () => {
      stopTitlePan();
      requestPlayFullscreen();
      setModalVisible('title-screen', false);
      runtime.titleActive = false;
      restorePlayerPosition();
      if (startGameFn) startGameFn();
    });
  }
}

export function bindPauseMenu() {
  el('btn-play')?.addEventListener('click', () => {
    requestPlayFullscreen();
    closeAllModals();
  });
  el('btn-pause-campaign')?.addEventListener('click', () => {
    setModalVisible('pause-modal', false);
    runtime.modalOpen = false;
    runtime.paused = false;
    openCampaignModal();
  });
  el('btn-pause-map')?.addEventListener('click', openFullMapFromPause);
  el('btn-pause-shop')?.addEventListener('click', () => {
    setModalVisible('pause-modal', false);
    runtime.modalOpen = false;
    runtime.paused = false;
    openShop();
  });
  el('btn-pause-settings')?.addEventListener('click', () => {
    setModalVisible('pause-modal', false);
    openSettingsModal({ returnTo: 'pause' });
  });
  el('btn-pause-title')?.addEventListener('click', () => {
    for (const id of MODAL_IDS) setModalVisible(id, false);
    el('reset-confirm')?.classList.add('hidden');
    runtime.modalOpen = false;
    runtime.paused = false;
    runtime.isPlaying = false;
    resetInputState();
    releaseGameLock();
    openTitleModal(hasUsableSave());
  });
  el('btn-change-role')?.addEventListener('click', () => {
    setModalVisible('pause-modal', false);
    runtime.modalOpen = false;
    openRoleSelectorModal(() => {
      if (startGameFn) startGameFn();
    });
  });
  el('btn-reset')?.addEventListener('click', () => {
    el('reset-confirm')?.classList.remove('hidden');
  });
  el('btn-reset-cancel')?.addEventListener('click', () => {
    el('reset-confirm')?.classList.add('hidden');
  });
  el('btn-reset-confirm')?.addEventListener('click', performReset);
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
  const showContinue = Boolean(hasSavedGame && hasUsableSave());
  if (!showContinue) {
    openTitleModal(false);
    return;
  }
  openTitleModal(true);
}
