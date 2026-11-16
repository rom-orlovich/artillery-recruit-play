import { EVENTS } from './config.js';
import { save, player, runtime, emit } from './state.js';
import { MAP_NPC_ROSTERS } from './npc-rosters.js';
import { MAX_FOLLOWERS, RANK_LEVELS, TASKS, isOrderable } from './npc-data.js';
import { planPath } from './npc-path.js';
import { getNpcOrderSpeed } from './battery-events.js';

const OFFICER_MIN_LEVEL = 3;
const AMMO_DELIVERY_AMOUNT = 4;
const AMMO_DUMP_MAX_DIST = 22;

let orderStore = null;

export function bindNpcOrderStore(store) {
  orderStore = store;
}

export function completeAmmoDelivery(n, roster) {
  const heroKey = runtime.heroGunId || roster.heroGunId || 'hero';
  runtime.gunAmmo = runtime.gunAmmo || {};
  runtime.gunAmmo[heroKey] = (Number(runtime.gunAmmo[heroKey]) || 0) + AMMO_DELIVERY_AMOUNT;
  runtime.gunShells = (runtime.gunShells ?? 0) + AMMO_DELIVERY_AMOUNT;
  emit(EVENTS.AMMO_DELIVERED || 'npc:ammo_delivered', { npcId: n.id, gunId: heroKey, amount: AMMO_DELIVERY_AMOUNT });
  n.task = null;
  n.taskPhase = 0;
  n.stuckTime = 0;
  n.object.userData.mapIcon = false;
  n.pose = n.basePose;
}

export function issueNpcOrder(npcId, taskKey, targetPos) {
  if (!orderStore) return { ok: false, reason: 'not_ready' };
  const n = orderStore.byId.get(npcId);
  if (!n) return { ok: false, reason: 'not_found' };
  const playerRankId = player.rankId || save.rankId || 'turai';
  if ((RANK_LEVELS[n.rank] ?? 0) > OFFICER_MIN_LEVEL && !isOrderable(n.rank, playerRankId)) {
    return { ok: false, reason: 'rank' };
  }
  const mapId = orderStore.getMapId();
  const roster = MAP_NPC_ROSTERS[mapId] || MAP_NPC_ROSTERS.shivta;
  n.orderSpeed = getNpcOrderSpeed(n);
  n.stuckTime = 0;

  if (taskKey === 'return') {
    n.task = 'return';
    n.taskPhase = 0;
    n.taskTarget.x = n.home.x;
    n.taskTarget.z = n.home.z;
    n.object.userData.mapIcon = false;
    planPath(n.pos.x, n.pos.z, n.home.x, n.home.z, n.path);
    n.pathIdx = 0;
    return { ok: true, npcId, task: 'return' };
  }

  if (taskKey === 'follow') {
    const fl = orderStore.getFollowers();
    if (n.task !== 'follow' && fl.length >= MAX_FOLLOWERS) {
      return { ok: false, reason: 'max_followers' };
    }
    n.task = 'follow';
    n.lastFollowGoalX = Infinity;
    n.lastFollowGoalZ = Infinity;
    n.object.userData.mapIcon = true;
    n.object.userData.taskLabel = TASKS.follow.label;
    return { ok: true, npcId, task: 'follow' };
  }

  if (taskKey === 'ammo') {
    const dump = roster.ammoDump;
    const rack = roster.shellRack || dump;
    const dumpDist = Math.hypot(n.pos.x - dump.x, n.pos.z - dump.z) + Math.hypot(dump.x - roster.heroGunPos.x, dump.z - roster.heroGunPos.z);
    const pick = dumpDist <= AMMO_DUMP_MAX_DIST ? dump : rack;
    n.task = 'ammo';
    n.taskPhase = 0;
    n.taskTarget.x = pick.x;
    n.taskTarget.z = pick.z;
    planPath(n.pos.x, n.pos.z, pick.x, pick.z, n.path);
    n.pathIdx = 0;
    n.object.userData.mapIcon = true;
    n.object.userData.taskLabel = TASKS.ammo.label;
    return { ok: true, npcId, task: 'ammo' };
  }

  const fallbackPost = taskKey === 'guard' && roster.guardPosts.length ? roster.guardPosts[0] : n.home;
  const tx = targetPos?.x ?? fallbackPost.x;
  const tz = targetPos?.z ?? fallbackPost.z;
  n.task = taskKey;
  n.taskPhase = 0;
  n.taskTarget.x = tx;
  n.taskTarget.z = tz;
  planPath(n.pos.x, n.pos.z, tx, tz, n.path);
  n.pathIdx = 0;
  n.object.userData.mapIcon = true;
  n.object.userData.taskLabel = TASKS[taskKey]?.label || taskKey;
  return { ok: true, npcId, task: taskKey };
}
