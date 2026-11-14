import { EVENTS, LANDMARKS } from './config.js';
import { player, runtime, emit, writeSave } from './state.js';

let activeMissionRunner = null;
let lastTelemetrySig = '';
let missionCompleteHandler = null;
let lastEntitiesApi = null;
let carryingAtFrameStart = null;

function evName(key, fallback) {
  return EVENTS[key] || fallback;
}

function distXZ(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

export function getActiveMissionRunner() {
  return activeMissionRunner;
}

export function setActiveMissionRunner(runner) {
  activeMissionRunner = runner;
  lastTelemetrySig = '';
}

export function setMissionCompleteHandler(fn) {
  missionCompleteHandler = fn;
}

export function resetObjectiveTelemetry() {
  lastTelemetrySig = '';
}

export function completeActiveMission() {
  const runner = activeMissionRunner;
  if (!runner || runner.completed) return false;
  runner.completed = true;
  missionCompleteHandler?.(runner.mission.id);
  return true;
}

function completeIfAllDone() {
  const runner = activeMissionRunner;
  if (!runner || runner.completed) return false;
  if (!runner.states.every((s) => s.done)) return false;
  return completeActiveMission();
}

export function resetActiveMissionObjectives() {
  const runner = activeMissionRunner;
  if (!runner || runner.completed) return;
  runner.states.forEach((s) => resetObjectiveState(s, lastEntitiesApi));
  updateObjectiveTelemetry(runner, true);
}

export function createObjectiveState(obj) {
  return {
    def: obj,
    progress: 0,
    done: false,
    visited: new Set(),
    visitedPointIds: [],
    subIdx: 0,
    subStates: (obj.subObjectives || []).map((s) => createObjectiveState(s)),
    timer: obj.timeLimitSec || 0,
    holdTimer: 0,
    outTimer: 0,
    waveAlive: [],
    waveProvided: 0,
    waveTimer: 0,
    lastInteractAt: 0
  };
}

function resetObjectiveState(st, entitiesApi = null) {
  st.progress = 0;
  st.done = false;
  st.visited.clear();
  st.visitedPointIds = [];
  st.subIdx = 0;
  st.timer = st.def.timeLimitSec || 0;
  st.holdTimer = 0;
  st.outTimer = 0;
  for (const dr of st.waveAlive) entitiesApi?.destroyDrone?.(dr);
  st.waveAlive = [];
  st.waveProvided = 0;
  st.waveTimer = 0;
  st.lastInteractAt = 0;
  st.subStates.forEach((s) => resetObjectiveState(s, entitiesApi));
}

export function getLeafState(st) {
  if (!st || st.done) return null;
  if (st.def.type === 'sequence' || st.def.type === 'timed') {
    return getLeafState(st.subStates[st.subIdx]) || st;
  }
  return st;
}

function getLeafTargetPoint(leaf) {
  const pts = leaf?.def?.points;
  if (!pts || !pts.length) return null;
  if (leaf.def.type === 'carry') return player.carryingType ? (pts[1] || pts[0]) : pts[0];
  const idx = Math.min(Math.floor(leaf.progress || 0), pts.length - 1);
  return pts[idx] || pts[0];
}

function getStepTransitionSig(runner) {
  if (!runner) return '';
  const idx = runner.states.findIndex((s) => !s.done);
  const top = runner.states[idx >= 0 ? idx : runner.states.length - 1];
  if (!top) return `${idx}`;
  const leaf = getLeafState(top) || top;
  const leafProg = leaf.def.type === 'defend' || leaf.def.type === 'stealth' ? (leaf.done ? 1 : 0) : Math.floor(leaf.progress);
  return `${idx}:${top.subIdx}:${top.done ? 1 : 0}:${leaf.def.type}:${leafProg}:${leaf.done ? 1 : 0}`;
}

export function updateObjectiveTelemetry(runner, force = false) {
  if (!runner) return;
  const idx = runner.states.findIndex((s) => !s.done);
  runtime.activeObjectiveIdx = idx >= 0 ? idx : 0;
  const top = runner.states[runtime.activeObjectiveIdx];
  const leaf = getLeafState(top);
  if (!leaf) return;
  runtime.objectiveProgress = leaf.progress;
  runtime.objectiveTimer = top?.def.type === 'timed' ? top.timer : leaf.def.timeLimitSec ? leaf.timer : leaf.holdTimer;
  const intProgress = Math.floor(leaf.progress);
  const pt = getLeafTargetPoint(leaf);
  const distMeters = pt ? Math.round(distXZ(player.pos, pt)) : -1;
  const sig = `${runner.mission.id}:${runtime.activeObjectiveIdx}:${intProgress}:${leaf.def.targetCount}:${distMeters}`;
  if (!force && sig === lastTelemetrySig) return;
  lastTelemetrySig = sig;
  const progressText = `${leaf.def.label}: ${intProgress}/${leaf.def.targetCount}`;
  emit(evName('OBJECTIVE_UPDATED', 'mission:objective_updated'), {
    missionId: runner.mission.id,
    objIndex: runtime.activeObjectiveIdx,
    text: progressText,
    progress: intProgress,
    target: leaf.def.targetCount,
    distanceMeters: distMeters >= 0 ? distMeters : null,
    targetWorldPos: pt || null
  });
  emit(EVENTS.MISSION_UPDATED, {
    missionId: runner.mission.id,
    progressText,
    progress: intProgress,
    target: leaf.def.targetCount,
    distanceMeters: distMeters >= 0 ? distMeters : null
  });
}

export function getCampaignObjectiveState() {
  if (!activeMissionRunner) return null;
  const idx = activeMissionRunner.states.findIndex((s) => !s.done);
  const top = activeMissionRunner.states[idx >= 0 ? idx : activeMissionRunner.states.length - 1];
  const leaf = getLeafState(top) || top;
  const timerRemainingSec = top?.def?.type === 'timed' ? top.timer : leaf?.def?.timeLimitSec ? leaf.timer : null;
  return {
    missionId: activeMissionRunner.mission.id,
    stepProgress: leaf ? leaf.progress : 0,
    targetCount: leaf?.def?.targetCount ?? 0,
    timerRemainingSec,
    holdElapsedSec: leaf ? leaf.holdTimer : 0,
    done: Boolean(activeMissionRunner.completed || activeMissionRunner.states.every((s) => s.done))
  };
}

function spawnDroneWaveBatch(st, d, entitiesApi) {
  const maxAlive = Math.min(d.waveDrones, 3);
  const batch = Math.min(maxAlive - st.waveAlive.length, (d.targetCount || 0) - st.waveProvided);
  if (batch <= 0) return;
  let spawnedNow = 0;
  for (let i = 0; i < batch; i++) {
    const idx = st.waveProvided + spawnedNow;
    const drone = entitiesApi.spawnDrone({ x: player.pos.x + ((idx % 3) - 1) * 14, y: 5, z: player.pos.z - 45 - (idx % 3) * 8, isMissionDrone: true }, true);
    if (drone) {
      st.waveAlive.push(drone);
      spawnedNow += 1;
    }
  }
  st.waveProvided += spawnedNow;
  st.waveTimer = 2;
}

function tickLeafObjective(st, dt, entitiesApi) {
  if (st.done) return;
  const d = st.def;
  const pts = d.points || [];

  if (d.type === 'reach') {
    const pt = pts[st.progress];
    if (pt && distXZ(player.pos, pt) <= (pt.radius || 4.2)) {
      st.progress += 1;
      emit(EVENTS.TOAST, { message: `נקודה ${st.progress}/${d.targetCount}: ${pt.label || 'הושגה'}`, duration: 2200 });
      if (st.progress >= d.targetCount) st.done = true;
    }
  } else if (d.type === 'shoot-targets') {
    if (d.entityGroup === 'roemTargets' && !runtime.roemRapidActive) {
      runtime.roemRapidActive = true;
      entitiesApi?.roemTargets?.forEach((t) => { t.hit = false; });
      entitiesApi?.syncRoemVisuals?.();
    } else if (d.entityGroup !== 'roemTargets' && !runtime.rangeActive) {
      runtime.rangeActive = true;
      entitiesApi?.resetRangeTargets?.();
      entitiesApi?.popRandomRangeTarget?.();
    }
    if (d.timeLimitSec) {
      st.timer -= dt;
      if (st.timer <= 0) {
        st.timer = d.timeLimitSec;
        st.progress = 0;
        emit(EVENTS.TOAST, { message: 'זמן המטווח תם — נסה שנית!', duration: 2600 });
      }
    }
  } else if (d.type === 'destroy-drones') {
    if (d.waveDrones > 0 && entitiesApi?.spawnDrone) {
      st.waveAlive = st.waveAlive.filter((dr) => dr && !dr.destroyed && !dr.dead && !(typeof dr.hp === 'number' && dr.hp <= 0));
      const remaining = (d.targetCount || 0) - st.waveProvided;
      if (remaining > 0) {
        if (st.waveProvided > 0) st.waveTimer -= dt;
        if (st.waveProvided === 0 || st.waveTimer <= 0) spawnDroneWaveBatch(st, d, entitiesApi);
      }
    }
  } else if (d.type === 'defend') {
    const zone = pts[0] || LANDMARKS.outpostCenter;
    if (distXZ(player.pos, zone) <= (zone.radius || 12)) {
      st.holdTimer += dt;
      st.outTimer = 0;
      st.progress = Math.floor(st.holdTimer);
      if (st.holdTimer >= (d.holdDurationSec || 30)) st.done = true;
    } else {
      st.outTimer += dt;
      if (st.outTimer > 10) {
        st.holdTimer = 0;
        st.outTimer = 0;
        st.progress = 0;
        emit(EVENTS.TOAST, { message: 'יצאת מתחום ההגנה — הספירה אופסה!', duration: 2500 });
      }
    }
  } else if (d.type === 'stealth') {
    const radius = d.maxDetectionRadius || 13;
    const exposed = (entitiesApi?.drones || []).some((dr) => {
      if (!dr || dr.dead || (typeof dr.hp === 'number' && dr.hp <= 0)) return false;
      const worldPos = dr.pos || dr.group?.position;
      return worldPos && distXZ(player.pos, worldPos) <= radius;
    });
    if (exposed) {
      runtime.stealthAlertTimer += dt;
      if (runtime.stealthAlertTimer >= 0.8) {
        runtime.stealthAlertTimer = 0;
        st.holdTimer = 0;
        st.progress = 0;
        emit(EVENTS.TOAST, { message: 'נחשפת לרחפן סיור! הסתתר ונסה שוב.', duration: 2600 });
      }
    } else {
      runtime.stealthAlertTimer = 0;
      const pt = pts[st.progress];
      if (pt && distXZ(player.pos, pt) <= (pt.radius || 5.5)) {
        st.holdTimer += dt;
        if (st.holdTimer >= (d.holdDurationSec || 5)) {
          st.holdTimer = 0;
          st.progress += 1;
          if (st.progress >= d.targetCount) st.done = true;
        }
      }
    }
  }
}

function tickCompositeObjective(st, dt, entitiesApi) {
  if (st.done) return;
  if (st.def.type === 'timed') {
    st.timer -= dt;
    if (st.timer <= 0) {
      resetObjectiveState(st, entitiesApi);
      player.carryingType = null;
      emit(EVENTS.TOAST, { message: 'זמן עבר — נסה שנית!', duration: 2800 });
      return;
    }
  }
  if (st.def.type === 'sequence' || st.def.type === 'timed') {
    const cur = st.subStates[st.subIdx];
    if (!cur) {
      st.done = true;
      return;
    }
    tickCompositeObjective(cur, dt, entitiesApi);
    if (cur.done) {
      st.subIdx += 1;
      st.progress = st.subIdx;
      if (st.subIdx >= st.subStates.length) st.done = true;
    }
    return;
  }
  tickLeafObjective(st, dt, entitiesApi);
}

export function updateCampaignObjectives(dt, entitiesApi = null) {
  carryingAtFrameStart = player.carryingType;
  const runner = activeMissionRunner;
  if (!runner || runner.completed) return;
  if (!runtime.isPlaying || runtime.paused || runtime.isDead || runtime.shopOpen || runtime.enlistOpen || runtime.campaignModalOpen || runtime.fireMapOpen || runtime.dischargeModalOpen || runtime.modalOpen) return;
  if (entitiesApi) lastEntitiesApi = entitiesApi;
  const prevStepSig = getStepTransitionSig(runner);
  for (const st of runner.states) tickCompositeObjective(st, dt, entitiesApi);
  updateObjectiveTelemetry(runner);
  if (completeIfAllDone()) return;
  const nextStepSig = getStepTransitionSig(runner);
  if (nextStepSig !== prevStepSig) writeSave();
}

export function findNearbyCampaignInteraction() {
  const runner = activeMissionRunner;
  if (!runner || runner.completed) return null;
  const activeLeaves = runner.states.map(getLeafState).filter(Boolean);
  for (const leaf of activeLeaves) {
    const d = leaf.def;
    const pts = d.points || [];
    if (d.type === 'interact') {
      const repeatable = pts.length < d.targetCount;
      for (let i = 0; i < pts.length; i++) {
        const pt = pts[i];
        const ptId = String(pt.id ?? `pt_${i}`);
        if (distXZ(player.pos, pt) > (pt.radius || 4.5)) continue;
        if (leaf.visited.has(ptId) && !repeatable) continue;
        const targetLabel = pt.label || d.label || 'פעולה';
        return {
          type: pt.interactType || d.interactType || 'campaign_interact',
          shortLabel: pt.shortLabel || d.shortLabel || 'בצע פעולה',
          label: `[E] ${targetLabel}`
        };
      }
    } else if (d.type === 'carry') {
      const pickup = pts[0];
      const dropoff = pts[1];
      const itemType = d.carryItem || 'ammoCrate';
      const inPickup = Boolean(pickup && distXZ(player.pos, pickup) <= (pickup.radius || 4.5));
      const inDrop = Boolean(dropoff && distXZ(player.pos, dropoff) <= (dropoff.radius || 5.0));
      if (!player.carryingType && inPickup) {
        const isSandbag = itemType === 'sandbag';
        const isShell = itemType === 'shell';
        return {
          type: isSandbag ? 'pickup_sandbag' : isShell ? 'pickup_shell' : 'campaign_pickup',
          shortLabel: isSandbag ? 'הרם שק' : isShell ? 'הרם פגז' : 'הרם פריט',
          label: `[E] ${pickup.label || (isSandbag ? 'הרם שק חול' : isShell ? 'הרם פגז' : 'הרם פריט')}`
        };
      }
      if (player.carryingType && inDrop) {
        const isSandbag = itemType === 'sandbag' || player.carryingType === 'sandbag';
        const isShell = itemType === 'shell' || player.carryingType === 'shell';
        return {
          type: isSandbag ? 'drop_sandbag' : isShell ? 'load_shell' : 'campaign_drop',
          shortLabel: isSandbag ? 'הנח שק' : isShell ? 'טען פגז' : 'הנח פריט',
          label: `[E] ${dropoff.label || (isSandbag ? 'הנח שק חול' : isShell ? 'טען פגז' : 'הנח פריט')}`
        };
      }
    }
  }
  return null;
}

export function getActiveCarryPoints() {
  const runner = activeMissionRunner;
  if (!runner || runner.completed) return null;
  const activeLeaves = runner.states.map(getLeafState).filter(Boolean);
  for (const leaf of activeLeaves) {
    if (leaf.def.type === 'carry' && leaf.def.points?.length >= 2) {
      return {
        pickup: { x: leaf.def.points[0].x, z: leaf.def.points[0].z, label: leaf.def.points[0].label || '' },
        dropoff: { x: leaf.def.points[1].x, z: leaf.def.points[1].z, label: leaf.def.points[1].label || '' },
        carryItem: leaf.def.carryItem || 'ammoCrate'
      };
    }
  }
  return null;
}

export function handleCampaignInteract(entitiesApi = null) {
  const runner = activeMissionRunner;
  if (!runner || runner.completed) return false;
  const activeLeaves = runner.states.map(getLeafState).filter(Boolean);
  for (const leaf of activeLeaves) {
    const d = leaf.def;
    const pts = d.points || [];
    if (d.type === 'interact') {
      const repeatable = pts.length < d.targetCount;
      const now = performance.now();
      let hitId = null;
      for (let i = 0; i < pts.length; i++) {
        const pt = pts[i];
        const ptId = String(pt.id ?? `pt_${i}`);
        if (distXZ(player.pos, pt) > (pt.radius || 4.5)) continue;
        if (!leaf.visited.has(ptId)) {
          hitId = ptId;
          break;
        }
        if (repeatable && now - leaf.lastInteractAt >= 1000) {
          hitId = ptId;
          break;
        }
      }
      if (hitId !== null) {
        leaf.visited.add(hitId);
        if (!leaf.visitedPointIds.includes(hitId)) leaf.visitedPointIds.push(hitId);
        leaf.lastInteractAt = now;
        leaf.progress += 1;
        emit(EVENTS.TOAST, { message: `${d.label} (${leaf.progress}/${d.targetCount})`, duration: 2200 });
        if (leaf.progress >= d.targetCount) leaf.done = true;
        updateObjectiveTelemetry(runner, true);
        if (!completeIfAllDone()) writeSave();
        return true;
      }
    } else if (d.type === 'carry') {
      const pickup = pts[0];
      const dropoff = pts[1];
      const itemType = d.carryItem || 'ammoCrate';
      const inPickup = Boolean(pickup && distXZ(player.pos, pickup) <= (pickup.radius || 4.5));
      const inDrop = Boolean(dropoff && distXZ(player.pos, dropoff) <= (dropoff.radius || 5.0));
      const pickedUpThisPress = !carryingAtFrameStart && Boolean(player.carryingType);
      const droppedThisPress = carryingAtFrameStart === itemType && !player.carryingType;
      if (droppedThisPress && inPickup && inDrop) {
        leaf.progress += 1;
        emit(EVENTS.TOAST, { message: `הועברו ${leaf.progress}/${d.targetCount} פריטים`, duration: 2200 });
        if (leaf.progress >= d.targetCount) leaf.done = true;
        updateObjectiveTelemetry(runner, true);
        if (!completeIfAllDone()) writeSave();
        return true;
      }
      if (!player.carryingType && inPickup) {
        player.carryingType = itemType;
        emit(EVENTS.TOAST, { message: `הרמת פריט — הבא אל ${dropoff?.label || 'היעד'} [E]`, duration: 2400 });
        return true;
      }
      if (player.carryingType && inDrop && !pickedUpThisPress) {
        player.carryingType = null;
        leaf.progress += 1;
        emit(EVENTS.TOAST, { message: `הועברו ${leaf.progress}/${d.targetCount} פריטים`, duration: 2200 });
        if (leaf.progress >= d.targetCount) leaf.done = true;
        updateObjectiveTelemetry(runner, true);
        if (!completeIfAllDone()) writeSave();
        return true;
      }
    }
  }
  return false;
}

export function onCampaignArtilleryImpact(x, z, shellType) {
  const runner = activeMissionRunner;
  if (!runner || runner.completed) return;
  const activeLeaves = runner.states.map(getLeafState).filter(Boolean);
  for (const leaf of activeLeaves) {
    if (leaf.def.type !== 'call-fire') continue;
    if (leaf.def.shellType && leaf.def.shellType !== shellType) continue;
    const pt = leaf.def.points?.[0];
    if (pt && Math.hypot(x - pt.x, z - pt.z) > (pt.radius || 32)) continue;
    leaf.progress += 1;
    if (leaf.progress >= leaf.def.targetCount) leaf.done = true;
    updateObjectiveTelemetry(runner, true);
  }
  completeIfAllDone();
}
