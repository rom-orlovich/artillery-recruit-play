import { EVENTS, isTouchDevice, SAVE_KEY } from './config.js';
import * as configMod from './config.js';
import * as stateMod from './state.js';
import { save, player, runtime, syncDerivedStats, emit, getCurrentRole, getCurrentRank } from './state.js';
import { createWorld, updateWorldAnimations } from './world.js';
import { initControls, requestGameLock, releaseGameLock, updatePlayerMovement, resetInputState } from './controls.js';
import {
  initModalManager,
  setModalVisible,
  savePlayerPosition,
  openPauseModal,
  closeAllModals,
  handleEscapeKey,
  bindTitleScreen,
  bindPauseMenu,
  bindLifecycleHandlers,
  showStartScreen
} from './modal-manager.js';
import { initWaypointCompass, updateWaypointCompass, refreshHudRects } from './waypoint-compass.js';
import { installDebugHook } from './debug-hook.js';
import { bindTargetEntities } from './current-target.js';

export const appContext = {
  scene: null,
  camera: null,
  renderer: null,
  canvas: null,
  modules: {}
};

async function loadOptionalModule(path) {
  try {
    return await import(path);
  } catch (err) {
    console.error('[ModuleLoadError]', path, err);
    return null;
  }
}

function isAnyModalOpen() {
  return Boolean(
    runtime.shopOpen ||
    runtime.enlistOpen ||
    runtime.campaignModalOpen ||
    runtime.fireMapOpen ||
    runtime.dischargeModalOpen ||
    runtime.modalOpen
  );
}

function isActivePlay() {
  return Boolean(runtime.isPlaying && !runtime.paused && !runtime.isDead && !isAnyModalOpen());
}

function syncFallbackHUD() {
  const role = getCurrentRole();
  const rank = getCurrentRank();
  const titleEl = document.getElementById('soldier-title');
  const rankEl = document.getElementById('rank-badge');
  const dayEl = document.getElementById('day-text');
  const hpText = document.getElementById('hp-text');
  const hpFill = document.getElementById('hp-bar-fill');
  const moneyEl = document.getElementById('money-text');
  const scoreEl = document.getElementById('score-text');
  if (titleEl) titleEl.textContent = `${rank.name} ${save.profile.name} — ${role.name}`;
  if (rankEl) rankEl.textContent = rank.name;
  if (dayEl) dayEl.textContent = `יום ${save.day}`;
  if (hpText) hpText.textContent = `${Math.ceil(player.hp)} / ${player.maxHp}`;
  if (hpFill) hpFill.style.width = `${Math.max(0, Math.min(100, (player.hp / player.maxHp) * 100))}%`;
  if (moneyEl) moneyEl.textContent = `${save.money} ₪`;
  if (scoreEl) scoreEl.textContent = `${save.score}`;
}

function updateTouchVisibility() {
  runtime.isMobile = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || window.innerWidth <= 900;
  const touchEl = document.getElementById('touch-controls');
  if (!touchEl) return;
  const active = runtime.isMobile && isActivePlay();
  const wasHidden = touchEl.classList.contains('hidden');
  touchEl.classList.toggle('hidden', !active);
  if (wasHidden === active) refreshHudRects();
}

function startGame() {
  setModalVisible('pause-modal', false);
  setModalVisible('enlist-modal', false);
  setModalVisible('death-modal', false);
  setModalVisible('shop-modal', false);
  setModalVisible('campaign-modal', false);
  setModalVisible('fire-map-modal', false);
  setModalVisible('discharge-modal', false);
  setModalVisible('title-screen', false);
  runtime.modalOpen = false;
  runtime.titleActive = false;
  runtime.enlistOpen = false;
  runtime.shopOpen = false;
  runtime.campaignModalOpen = false;
  runtime.fireMapOpen = false;
  runtime.dischargeModalOpen = false;
  runtime.paused = false;
  runtime.isPlaying = true;
  requestGameLock(appContext.canvas);
  updateTouchVisibility();
  refreshHudRects();
}

function togglePause() {
  if (runtime.enlistOpen || runtime.shopOpen || runtime.isDead) return;
  if (runtime.campaignModalOpen) {
    appContext.modules.campaign?.closeCampaignModal?.();
    startGame();
    return;
  }
  if (runtime.modalOpen) {
    closeAllModals();
  } else {
    openPauseModal();
  }
  updateTouchVisibility();
}

function openCampaignJournal() {
  if (runtime.campaignModalOpen || runtime.enlistOpen || runtime.shopOpen || runtime.isDead || runtime.titleActive || runtime.modalOpen) return;
  savePlayerPosition();
  resetInputState();
  releaseGameLock();
  runtime.isPlaying = false;
  appContext.modules.campaign?.openCampaignModal?.();
  updateTouchVisibility();
}

async function bootstrap() {
  const canvas = document.getElementById('game-canvas');
  document.body.classList.toggle('is-touch', isTouchDevice());
  const { scene, camera, renderer } = createWorld(canvas, runtime.isMobile);
  appContext.scene = scene;
  appContext.camera = camera;
  appContext.renderer = renderer;
  appContext.canvas = canvas;

  syncDerivedStats();
  camera.position.set(player.pos.x, player.pos.y + player.eyeHeight, player.pos.z);

  const [audioMod, enlistMod, combatMod, entitiesMod, shopMod, missionsMod, minimapMod, hudMod, campaignMod] = await Promise.all([
    loadOptionalModule('./audio.js'),
    loadOptionalModule('./enlistment.js'),
    loadOptionalModule('./combat.js'),
    loadOptionalModule('./entities.js'),
    loadOptionalModule('./shop.js'),
    loadOptionalModule('./missions.js'),
    loadOptionalModule('./minimap.js'),
    loadOptionalModule('./hud.js'),
    loadOptionalModule('./campaign.js')
  ]);

  appContext.modules = {
    audio: audioMod,
    enlistment: enlistMod,
    combat: combatMod,
    entities: entitiesMod,
    shop: shopMod,
    missions: missionsMod,
    minimap: minimapMod,
    hud: hudMod,
    campaign: campaignMod
  };

  audioMod?.initAudio?.();
  combatMod?.initCombat?.(scene, camera);
  const entitiesApi = entitiesMod?.initEntities?.(scene) || null;
  bindTargetEntities(entitiesApi);
  shopMod?.initShop?.(() => startGame());
  missionsMod?.initMissions?.(entitiesApi, shopMod, combatMod);
  campaignMod?.initCampaign?.(missionsMod);
  minimapMod?.initMinimap?.(document.getElementById('minimap-canvas'));
  hudMod?.initHUD?.();
  initWaypointCompass(scene, camera);
  if (!hudMod) syncFallbackHUD();

  function onInteract() {
    if (!isActivePlay()) return false;
    const wasShopOpen = runtime.shopOpen;
    const wasCampaignOpen = runtime.campaignModalOpen;
    const handled = missionsMod?.handleInteract?.(entitiesApi, shopMod, combatMod);
    if (!wasShopOpen && runtime.shopOpen) {
      savePlayerPosition();
      resetInputState();
      updateTouchVisibility();
      return true;
    }
    if (!handled && !runtime.shopOpen && !runtime.campaignModalOpen) {
      const campHandled = Boolean(campaignMod?.handleCampaignInteract?.(entitiesApi));
      if (!wasCampaignOpen && runtime.campaignModalOpen) {
        savePlayerPosition();
        resetInputState();
        releaseGameLock();
        runtime.isPlaying = false;
        updateTouchVisibility();
      }
      return campHandled;
    }
    if (!wasCampaignOpen && runtime.campaignModalOpen) {
      savePlayerPosition();
      resetInputState();
      releaseGameLock();
      runtime.isPlaying = false;
      updateTouchVisibility();
    }
    return Boolean(handled);
  }

  initControls(canvas, {
    onFire: () => combatMod?.fireWeapon?.(camera, entitiesApi, missionsMod),
    onInteract,
    onAbility: () => combatMod?.triggerRoleAbility?.(entitiesApi),
    onPauseToggle: togglePause
  });

  let lastTouchInteractAt = 0;
  const btnTouchInteract = document.getElementById('btn-touch-interact');
  btnTouchInteract?.addEventListener('touchstart', () => {
    lastTouchInteractAt = performance.now();
  }, { passive: true });
  btnTouchInteract?.addEventListener('click', () => {
    if (performance.now() - lastTouchInteractAt < 350) return;
    onInteract();
  });

  document.getElementById('btn-touch-campaign')?.addEventListener('click', () => {
    openCampaignJournal();
  });

  document.addEventListener('click', (e) => {
    if (e.target.closest('#btn-close-campaign')) {
      campaignMod?.closeCampaignModal?.();
      startGame();
    } else if (e.target.closest('.btn-start-campaign-mission')) {
      const btn = e.target.closest('.btn-start-campaign-mission');
      if (!btn.disabled) {
        campaignMod?.closeCampaignModal?.();
        startGame();
      }
    } else if (e.target.closest('#btn-close-fire-map')) {
      setModalVisible('fire-map-modal', false);
      runtime.fireMapOpen = false;
      startGame();
    }
  });

  window.addEventListener('keydown', (e) => {
    if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
    if (e.code === 'KeyJ') {
      if (runtime.campaignModalOpen) {
        campaignMod?.closeCampaignModal?.();
        startGame();
      } else {
        openCampaignJournal();
      }
    } else if (e.code === 'Escape') {
      handleEscapeKey();
      updateTouchVisibility();
    }
  });

  initModalManager({
    startGame,
    onReset: () => {
      entitiesMod?.clearAllDrones?.();
      missionsMod?.initMissions?.(entitiesApi, shopMod, combatMod);
      campaignMod?.initCampaign?.(missionsMod);
      if (!hudMod) syncFallbackHUD();
    }
  });
  bindTitleScreen();
  bindPauseMenu();
  bindLifecycleHandlers();
  showStartScreen(Boolean(localStorage.getItem(SAVE_KEY)));

  document.getElementById('btn-respawn')?.addEventListener('click', () => {
    runtime.isDead = false;
    player.hp = player.maxHp;
    player.pos.x = 0;
    player.pos.y = 0;
    player.pos.z = 18;
    player.velY = 0;
    player.yaw = 0;
    player.pitch = 0;
    resetInputState();
    emit(EVENTS.PLAYER_RESPAWNED, {});
    if (!hudMod) syncFallbackHUD();
    startGame();
  });

  installDebugHook({
    modules: { state: stateMod, config: configMod, campaign: campaignMod, entities: entitiesMod, combat: combatMod, missions: missionsMod, hud: hudMod },
    camera,
    entitiesApi,
    onInteract,
    startGame,
    togglePause,
    setModalVisible,
    syncFallbackHUD
  });

  window.addEventListener('resize', () => {
    updateTouchVisibility();
    refreshHudRects();
  });

  const crosshairEl = document.getElementById('crosshair');
  let lastCrosshairActive = null;
  let lastTouchState = null;

  let lastTime = performance.now();
  function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;
    const tSec = now / 1000;

    updateWorldAnimations(tSec);
    updateWaypointCompass(tSec);

    const activePlay = isActivePlay();
    if (crosshairEl && lastCrosshairActive !== activePlay) {
      lastCrosshairActive = activePlay;
      crosshairEl.classList.toggle('hidden', !activePlay);
    }
    const touchActive = runtime.isMobile && activePlay;
    if (lastTouchState !== touchActive) {
      lastTouchState = touchActive;
      updateTouchVisibility();
    }

    if (activePlay) {
      updatePlayerMovement(dt, camera);
      combatMod?.updateCombat?.(dt, scene);
      entitiesMod?.updateEntities?.(dt, tSec, (dmg) => combatMod?.applyDamage?.(dmg, entitiesApi));
      missionsMod?.updateMissions?.(dt, entitiesApi);
      campaignMod?.updateCampaignObjectives?.(dt, entitiesApi);
      const nearby = missionsMod?.findNearbyInteraction?.(entitiesApi) || null;
      hudMod?.updateHUD?.(nearby);
      minimapMod?.drawMinimap?.(entitiesApi);
    }

    renderer.render(scene, camera);
  }

  requestAnimationFrame(loop);
}

bootstrap();
