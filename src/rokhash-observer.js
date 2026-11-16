const LAZE_LOCK_SEC = 0.35;
const INITIAL_CEP_M = 18;
const CORRECTED_CEP_M = 2.5;
const DEG_TO_RAD = Math.PI / 180;
const MIN_RANGE_M = 40;

export function createObserverState() {
  return {
    lazing: false,
    lazeElapsed: 0,
    lazeDuration: LAZE_LOCK_SEC,
    lazeTarget: { x: 0, y: 0, z: 0 },
    spottedTarget: { x: 0, y: 0, z: 0 },
    hasSpottedTarget: false,
    cepRadius: INITIAL_CEP_M,
    lastCorrection: { rangeM: 0, azDeg: 0 }
  };
}

export function resetMissionDispersion(obsState) {
  obsState.cepRadius = INITIAL_CEP_M;
}

export function beginBinocularLaze(obsState, targetPos) {
  obsState.lazing = true;
  obsState.lazeElapsed = 0;
  obsState.lazeTarget.x = targetPos?.x ?? 80;
  obsState.lazeTarget.y = targetPos?.y ?? 0;
  obsState.lazeTarget.z = targetPos?.z ?? -280;
}

export function updateBinocularLaze(obsState, dt, runtime, onLazeLocked) {
  if (!obsState.lazing) return false;
  obsState.lazeElapsed += dt;
  if (obsState.lazeElapsed < obsState.lazeDuration) return false;
  obsState.lazing = false;
  obsState.spottedTarget.x = obsState.lazeTarget.x;
  obsState.spottedTarget.y = obsState.lazeTarget.y;
  obsState.spottedTarget.z = obsState.lazeTarget.z;
  obsState.hasSpottedTarget = true;
  runtime.spottedTarget = obsState.spottedTarget;
  if (onLazeLocked) onLazeLocked(obsState.spottedTarget);
  return true;
}

export function applyFireCorrection(obsState, missionTarget, correction, gunOrigin) {
  const rangeM = Number(correction?.rangeM) || 0;
  const azDeg = Number(correction?.azDeg) || 0;
  obsState.lastCorrection.rangeM = rangeM;
  obsState.lastCorrection.azDeg = azDeg;
  const ox = gunOrigin?.x ?? 0;
  const oz = gunOrigin?.z ?? 0;
  const dx = missionTarget.x - ox;
  const dz = missionTarget.z - oz;
  const curRange = Math.max(MIN_RANGE_M, Math.hypot(dx, dz));
  const curYaw = Math.atan2(dx, -dz) + azDeg * DEG_TO_RAD;
  const nextRange = Math.max(MIN_RANGE_M, curRange + rangeM);
  missionTarget.x = ox + Math.sin(curYaw) * nextRange;
  missionTarget.z = oz - Math.cos(curYaw) * nextRange;
  obsState.cepRadius = CORRECTED_CEP_M;
  return obsState.cepRadius;
}
