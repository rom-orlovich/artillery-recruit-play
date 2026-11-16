import * as THREE from 'three';
import { player, runtime } from './state.js';
import { TASKS } from './npc-data.js';

const TAG_SHOW_DIST = 6;
const TAG_HIDE_DIST = 8;
const HEAD_OFFSET_Y = 2.05;
const EDGE_PAD_X = 70;
const EDGE_TOP_Y = 40;
const EDGE_BOTTOM_Y = 90;
const projVec = new THREE.Vector3();

let nameTagEl = null;
let taskBadgesEl = null;
let shownNpc = null;
let lastTagText = '';
let lastTaskSig = '';

export function initNpcHud(rootEl) {
  nameTagEl = document.createElement('div');
  nameTagEl.id = 'npc-name-tag';
  nameTagEl.dir = 'rtl';
  nameTagEl.style.display = 'none';
  rootEl.appendChild(nameTagEl);

  taskBadgesEl = document.createElement('div');
  taskBadgesEl.id = 'npc-task-badges';
  taskBadgesEl.dir = 'rtl';
  rootEl.appendChild(taskBadgesEl);

  shownNpc = null;
  lastTagText = '';
  lastTaskSig = '';
}

export function renderTaskBadges(list) {
  if (!taskBadgesEl || !list) return;
  let sig = '';
  for (let i = 0; i < list.length; i++) {
    if (list[i].task && list[i].task !== 'sleep_cot') sig += `${list[i].id}:${list[i].task}|`;
  }
  if (sig === lastTaskSig) return;
  lastTaskSig = sig;
  if (!sig) { taskBadgesEl.innerHTML = ''; return; }
  let html = '';
  for (let i = 0; i < list.length; i++) {
    const n = list[i];
    if (!n.task || n.task === 'sleep_cot') continue;
    const def = TASKS[n.task];
    html += `<div class="map-npc-task">${def?.icon || '•'} ${n.name}: ${def?.label || n.task}</div>`;
  }
  taskBadgesEl.innerHTML = html;
}

export function updateNpcHud(nearestNpc, camera, list) {
  renderTaskBadges(list);
  if (shownNpc && list && list.indexOf(shownNpc) === -1) {
    shownNpc = null;
  }
  if (nearestNpc) {
    const d = Math.hypot(nearestNpc.pos.x - player.pos.x, nearestNpc.pos.z - player.pos.z);
    if (d <= TAG_SHOW_DIST) shownNpc = nearestNpc;
  }
  if (shownNpc) {
    const d = Math.hypot(shownNpc.pos.x - player.pos.x, shownNpc.pos.z - player.pos.z);
    if (d > TAG_HIDE_DIST || (nearestNpc && shownNpc.region !== nearestNpc.region)) {
      shownNpc = null;
    }
  }
  if (!shownNpc || runtime.titleActive || runtime.dialogueOpen) {
    if (nameTagEl && nameTagEl.style.display !== 'none') nameTagEl.style.display = 'none';
    return;
  }
  const text = `${shownNpc.rank} ${shownNpc.name} · ${shownNpc.role}`;
  if (text !== lastTagText) { lastTagText = text; nameTagEl.textContent = text; }
  nameTagEl.style.display = 'block';
  if (camera) {
    projVec.set(shownNpc.pos.x, shownNpc.pos.y + HEAD_OFFSET_Y, shownNpc.pos.z).project(camera);
    const sx = Math.max(EDGE_PAD_X, Math.min(window.innerWidth - EDGE_PAD_X, (projVec.x * 0.5 + 0.5) * window.innerWidth));
    const sy = Math.max(EDGE_TOP_Y, Math.min(window.innerHeight - EDGE_BOTTOM_Y, (-projVec.y * 0.5 + 0.5) * window.innerHeight));
    nameTagEl.style.left = `${sx}px`;
    nameTagEl.style.top = `${sy}px`;
  }
}
