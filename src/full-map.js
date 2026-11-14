import { REGIONS } from './world-layout.js';
import { getMapImage, mapToImage, getMapLabels, getObjectiveTarget, drawPlayerArrow } from './map-image.js';
import { player, runtime } from './state.js';
import { travelTo, getRegionAt } from './world.js';
import { resetInputState, releaseGameLock } from './controls.js';
import { closeAllModals, setModalVisible } from './modal-manager.js';

const MODAL_ID = 'full-map-modal';
const REGION_FONT = 'bold 15px Tahoma, Arial, sans-serif';
const LANDMARK_FONT = 'bold 12px Tahoma, Arial, sans-serif';

let bound = false;

function isFullMapOpen() {
  const modal = document.getElementById(MODAL_ID);
  return Boolean(modal && !modal.classList.contains('hidden'));
}

function fitTransform(canvas, image) {
  const scale = Math.min(canvas.width / image.width, canvas.height / image.height);
  return { scale, offsetX: (canvas.width - image.width * scale) / 2, offsetY: (canvas.height - image.height * scale) / 2 };
}

function drawLabels(ctx, toScreen, dpr) {
  const placed = [];
  for (const label of getMapLabels()) {
    const [x, y] = toScreen(label.x, label.z);
    ctx.font = label.kind === 'region' ? REGION_FONT : LANDMARK_FONT;
    ctx.font = ctx.font.replace(/(\d+)px/, (_, px) => `${Math.round(px * dpr)}px`);
    const width = ctx.measureText(label.text).width + 8 * dpr;
    const height = (label.kind === 'region' ? 19 : 15) * dpr;
    const box = { left: x - width / 2, right: x + width / 2, top: y - height / 2, bottom: y + height / 2 };
    if (placed.some((p) => box.left < p.right && box.right > p.left && box.top < p.bottom && box.bottom > p.top)) continue;
    placed.push(box);
    ctx.fillStyle = label.kind === 'region' ? 'rgba(18, 30, 34, 0.82)' : 'rgba(12, 16, 18, 0.62)';
    ctx.fillRect(box.left, box.top, width, height);
    ctx.fillStyle = label.kind === 'region' ? '#7ee8dc' : '#f4efe0';
    ctx.fillText(label.text, x, y + 1);
  }
}

function drawMap() {
  const canvas = document.getElementById('full-map-canvas');
  if (!canvas) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.round(rect.width * dpr));
  canvas.height = Math.max(1, Math.round(rect.height * dpr));
  const ctx = canvas.getContext('2d');
  const image = getMapImage();
  const { scale, offsetX, offsetY } = fitTransform(canvas, image);
  const toScreen = (x, z) => {
    const [ix, iy] = mapToImage(x, z);
    return [offsetX + ix * scale, offsetY + iy * scale];
  };
  ctx.fillStyle = '#10161a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, offsetX, offsetY, image.width * scale, image.height * scale);
  const active = getRegionAt(player.pos.x, player.pos.z);
  ctx.lineWidth = 2 * dpr;
  for (const region of Object.values(REGIONS)) {
    const [minX, maxX, minZ, maxZ] = region.rect;
    const [x0, y0] = toScreen(Math.max(minX, -208), Math.max(minZ, -448));
    const [x1, y1] = toScreen(Math.min(maxX, 208), Math.min(maxZ, 98));
    ctx.setLineDash(region.id === active ? [] : [6 * dpr, 5 * dpr]);
    ctx.strokeStyle = region.id === active ? 'rgba(126, 232, 220, 0.95)' : 'rgba(255, 255, 255, 0.35)';
    ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
  }
  ctx.setLineDash([]);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.direction = 'rtl';
  drawLabels(ctx, toScreen, dpr);
  const target = getObjectiveTarget();
  if (target) {
    const [tx, ty] = toScreen(target.x, target.z);
    ctx.beginPath();
    ctx.arc(tx, ty, 7 * dpr, 0, Math.PI * 2);
    ctx.fillStyle = '#ffd15c';
    ctx.fill();
    ctx.strokeStyle = '#2a2008';
    ctx.lineWidth = 2 * dpr;
    ctx.stroke();
  }
  const [px, py] = toScreen(player.pos.x, player.pos.z);
  drawPlayerArrow(ctx, px, py, player.yaw, 7 * dpr);
  for (const button of document.querySelectorAll('.btn-travel')) button.classList.toggle('active', button.dataset.region === active);
}

function closeFullMap() {
  setModalVisible(MODAL_ID, false);
  closeAllModals();
}

export function openFullMap() {
  if (!runtime.isPlaying || runtime.isDead || runtime.modalOpen || runtime.shopOpen || runtime.campaignModalOpen || isFullMapOpen()) return;
  resetInputState();
  releaseGameLock();
  runtime.modalOpen = true;
  setModalVisible(MODAL_ID, true);
  drawMap();
}

export function initFullMap() {
  if (bound) return;
  bound = true;
  document.getElementById('btn-close-full-map')?.addEventListener('click', closeFullMap);
  for (const button of document.querySelectorAll('.btn-travel')) {
    button.addEventListener('click', () => {
      travelTo(button.dataset.region);
      closeFullMap();
    });
  }
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyM' && !isFullMapOpen()) openFullMap();
    if (e.code !== 'Escape' || !isFullMapOpen()) return;
    e.stopImmediatePropagation();
    closeFullMap();
  }, true);
  window.addEventListener('resize', () => {
    if (isFullMapOpen()) drawMap();
  });
}
