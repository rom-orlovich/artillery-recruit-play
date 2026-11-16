const MRSI_COUNT = 3;
const MRSI_DELAYS_SEC = [0, 1.5, 3.0];
const MRSI_FLIGHT_SEC = [3.6, 2.2, 0.8];
const SCOOT_WINDOW_SEC = 30;
const SCOOT_MIN_DIST_M = 25;
const COUNTER_BATTERY_DMG = 25;
const SCOOT_BONUS_SCORE = 50;

export function createRoemState() {
  const shots = [];
  for (let i = 0; i < MRSI_COUNT; i += 1) {
    shots.push({
      active: false,
      delayLeft: 0,
      launched: false,
      flightLeft: 0,
      targetX: 0,
      targetY: 0,
      targetZ: 0
    });
  }
  return {
    shots,
    mrsiImpacts: [],
    scootTimer: 0,
    scootActive: false,
    scootOriginX: 0,
    scootOriginZ: 0,
    lastCounterResult: { displaced: true, dist: 0, damageTaken: 0 }
  };
}

export function startRoemMrsi(roemState, targetPos, playerPos, onLaunch) {
  const tx = targetPos?.x ?? 140;
  const ty = targetPos?.y ?? 0;
  const tz = targetPos?.z ?? -360;
  roemState.mrsiImpacts.length = 0;
  roemState.scootOriginX = playerPos?.x ?? 0;
  roemState.scootOriginZ = playerPos?.z ?? 0;
  roemState.scootTimer = SCOOT_WINDOW_SEC;
  roemState.scootActive = true;
  for (let i = 0; i < MRSI_COUNT; i += 1) {
    const s = roemState.shots[i];
    s.active = true;
    s.delayLeft = MRSI_DELAYS_SEC[i];
    s.launched = false;
    s.flightLeft = MRSI_FLIGHT_SEC[i];
    s.targetX = tx;
    s.targetY = ty;
    s.targetZ = tz;
    if (s.delayLeft <= 0) {
      s.launched = true;
      if (onLaunch) onLaunch(s);
    }
  }
}

export function updateRoemMrsi(roemState, dt, simTimeSec, onLaunch, onImpact, onScootExpire) {
  for (let i = 0; i < MRSI_COUNT; i += 1) {
    const s = roemState.shots[i];
    if (!s.active) continue;
    if (!s.launched) {
      s.delayLeft -= dt;
      if (s.delayLeft <= 0) {
        s.launched = true;
        if (onLaunch) onLaunch(s);
      }
      continue;
    }
    s.flightLeft -= dt;
    if (s.flightLeft <= 0) {
      s.active = false;
      roemState.mrsiImpacts.push(simTimeSec);
      if (onImpact) onImpact(s);
    }
  }
  if (roemState.scootActive && roemState.scootTimer > 0) {
    roemState.scootTimer = Math.max(0, roemState.scootTimer - dt);
    if (roemState.scootTimer <= 0) {
      roemState.scootActive = false;
      if (onScootExpire) onScootExpire();
    }
  }
}

export function resolveRoemCounterBattery(roemState, playerPos, onScore, onDamage) {
  const px = playerPos?.x ?? 0;
  const pz = playerPos?.z ?? 0;
  const dx = px - roemState.scootOriginX;
  const dz = pz - roemState.scootOriginZ;
  const dist = Math.hypot(dx, dz);
  const displaced = dist >= SCOOT_MIN_DIST_M;
  const res = roemState.lastCounterResult;
  res.displaced = displaced;
  res.dist = dist;
  roemState.scootActive = false;
  roemState.scootTimer = 0;
  if (displaced) {
    res.damageTaken = 0;
    if (onScore) onScore(SCOOT_BONUS_SCORE);
  } else {
    res.damageTaken = COUNTER_BATTERY_DMG;
    if (onDamage) onDamage(COUNTER_BATTERY_DMG);
  }
  return res;
}
