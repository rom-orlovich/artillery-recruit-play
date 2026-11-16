import * as THREE from 'three';

const CHAT_BUBBLE_RANGE_M = 12;
const BUBBLE_HEAD_OFFSET_M = 2.1;
const BUBBLE_COUNT = 2;
const BUBBLE_CLASS = 'npc-chat-bubble';
const SCREEN_MARGIN_PX = 40;

const projVec = new THREE.Vector3();
const bubbles = [];
let initialized = false;

function hideBubble(slot) {
  const el = bubbles[slot];
  if (el && el.style.display !== 'none') el.style.display = 'none';
}

export function initNpcChatUi(rootEl) {
  if (initialized) return;
  initialized = true;
  const host = rootEl || document.body;
  for (let i = 0; i < BUBBLE_COUNT; i++) {
    const el = document.createElement('div');
    el.className = BUBBLE_CLASS;
    el.style.display = 'none';
    host.appendChild(el);
    bubbles.push(el);
  }
}

export function updateNpcChatBubbles(camera, npcs, playerPos) {
  initNpcChatUi();
  if (!camera || !npcs || !playerPos) {
    for (let i = 0; i < BUBBLE_COUNT; i++) hideBubble(i);
    return;
  }

  const maxSq = CHAT_BUBBLE_RANGE_M * CHAT_BUBBLE_RANGE_M;
  let idx0 = -1;
  let d0 = maxSq;
  let idx1 = -1;
  let d1 = maxSq;

  for (let i = 0; i < npcs.length; i++) {
    const n = npcs[i];
    if (!n || !n.pos || !n.chatWith || !n.chatLine) continue;
    const dx = n.pos.x - playerPos.x;
    const dy = n.pos.y - playerPos.y;
    const dz = n.pos.z - playerPos.z;
    const d2 = dx * dx + dy * dy + dz * dz;
    if (d2 > maxSq) continue;
    if (d2 < d0) {
      idx1 = idx0;
      d1 = d0;
      idx0 = i;
      d0 = d2;
    } else if (d2 < d1) {
      idx1 = i;
      d1 = d2;
    }
  }

  const w = window.innerWidth;
  const h = window.innerHeight;
  for (let slot = 0; slot < BUBBLE_COUNT; slot++) {
    const npcIdx = slot === 0 ? idx0 : idx1;
    if (npcIdx < 0) {
      hideBubble(slot);
      continue;
    }
    const n = npcs[npcIdx];
    projVec.set(n.pos.x, n.pos.y + BUBBLE_HEAD_OFFSET_M, n.pos.z);
    projVec.project(camera);
    if (projVec.z < -1 || projVec.z > 1) {
      hideBubble(slot);
      continue;
    }
    const sx = (projVec.x * 0.5 + 0.5) * w;
    const sy = (-projVec.y * 0.5 + 0.5) * h;
    if (sx < -SCREEN_MARGIN_PX || sx > w + SCREEN_MARGIN_PX || sy < -SCREEN_MARGIN_PX || sy > h + SCREEN_MARGIN_PX) {
      hideBubble(slot);
      continue;
    }
    const el = bubbles[slot];
    if (el.textContent !== n.chatLine) el.textContent = n.chatLine;
    el.style.left = `${Math.round(sx)}px`;
    el.style.top = `${Math.round(sy)}px`;
    if (el.style.display !== 'block') el.style.display = 'block';
  }
}
