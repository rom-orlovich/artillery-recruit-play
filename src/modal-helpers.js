import { SAVE_KEY } from './config.js';
import { save, player, runtime, writeSave } from './state.js';
import { appContext } from './main.js';

export const MODAL_IDS = [
  'title-screen',
  'enlist-modal',
  'pause-modal',
  'settings-modal',
  'shop-modal',
  'campaign-modal',
  'fire-map-modal',
  'full-map-modal',
  'discharge-modal',
  'death-modal'
];

const els = {};
let titlePanRaf = 0;

export function el(id) {
  if (!els[id]) els[id] = document.getElementById(id);
  return els[id];
}

export function isOpen(id) {
  const node = el(id);
  return Boolean(node && !node.classList.contains('hidden'));
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

export function hasUsableSave() {
  if (save.enlisted) return true;
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return Boolean(parsed && parsed.enlisted);
  } catch {
    return false;
  }
}

export function stopTitlePan() {
  if (titlePanRaf) {
    cancelAnimationFrame(titlePanRaf);
    titlePanRaf = 0;
  }
}

export function startTitlePan() {
  stopTitlePan();
  const updateCam = (now) => {
    const cam = appContext && appContext.camera;
    if (cam) {
      const t = now * 0.00018;
      cam.position.set(Math.sin(t) * 28, 12, -238 + Math.cos(t) * 14);
      cam.lookAt(0, 2.5, -284);
    }
  };
  updateCam(performance.now());
  const step = (now) => {
    if (!runtime.titleActive || isOpen('enlist-modal')) {
      titlePanRaf = 0;
      return;
    }
    updateCam(now);
    titlePanRaf = requestAnimationFrame(step);
  };
  titlePanRaf = requestAnimationFrame(step);
}

function lockLandscape() {
  try {
    const orient = screen && screen.orientation;
    if (orient && typeof orient.lock === 'function') {
      const res = orient.lock('landscape');
      if (res && typeof res.catch === 'function') res.catch(() => {});
    }
  } catch {}
}

export function requestPlayFullscreen() {
  try {
    const root = document.documentElement;
    if (root && !document.fullscreenElement) {
      const req = root.requestFullscreen || root.webkitRequestFullscreen;
      if (typeof req === 'function') {
        const res = req.call(root);
        if (res && typeof res.then === 'function') {
          res.then(lockLandscape, lockLandscape);
          return;
        }
      }
    }
    lockLandscape();
  } catch {
    lockLandscape();
  }
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
