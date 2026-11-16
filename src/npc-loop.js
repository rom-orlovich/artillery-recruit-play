import { save, player, runtime } from './state.js';
import { ensureTimeOfDay } from './world-time.js';
import { updateNpcs, getNearestTalkableNpc } from './npc.js';
import { initNpcUi, updateNpcUi, openDialogue, closeDialogue } from './npc-ui.js';

const TALK_MAX_DIST = 6;
const nearbyPayload = { type: 'talk', shortLabel: 'דבר', label: '' };

let cameraRef = null;

export function initNpcLoop(camera) {
  cameraRef = camera || null;
  initNpcUi();
}

export function tickNpcLoop(dt) {
  if (runtime.titleActive || runtime.modalOpen || runtime.shopOpen || runtime.enlistOpen || runtime.campaignModalOpen || runtime.fireMapOpen || runtime.dischargeModalOpen) {
    return;
  }
  updateNpcs(dt, player.pos, ensureTimeOfDay());
  const near = getNearestTalkableNpc(player.pos, player.yaw, TALK_MAX_DIST);
  const rankId = player.rankId || save.rankId || 'turai';
  updateNpcUi(near, rankId, cameraRef);
}

export function findNearbyNpcInteraction() {
  const n = getNearestTalkableNpc(player.pos, player.yaw, TALK_MAX_DIST);
  if (!n) return null;
  nearbyPayload.label = `[E] דבר עם ${n.rank} ${n.name}`;
  return nearbyPayload;
}

export function handleNpcInteract() {
  const n = getNearestTalkableNpc(player.pos, player.yaw, TALK_MAX_DIST);
  if (!n) return false;
  const chapter = save.campaign?.currentChapter || 1;
  openDialogue(n, chapter);
  return true;
}

export function closeNpcDialogue() {
  if (!runtime.dialogueOpen) return false;
  closeDialogue();
  return true;
}
