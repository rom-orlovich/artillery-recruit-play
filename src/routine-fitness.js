import { EVENTS, LANDMARKS } from './config.js';
import { emit, player } from './state.js';

const FLAG_RADIUS_M = 3;
const PULLUPS_REQUIRED = 5;
const RUN_TIMEOUT_SEC = 60;
const STEP_TOAST_MS = 2200;
const TASK_TOAST_MS = 3200;
const EPSILON = 1e-6;
const OBJECTIVE_UPDATED_EVENT = EVENTS.OBJECTIVE_UPDATED || 'mission:objective_updated';
const RUN_FLAG_LABELS = ['ריצה: דגל 1/3', 'ריצה: דגל 2/3', 'ריצה: דגל 3/3'];
const GYM_BASE = LANDMARKS.fieldGym || { x: -10, z: -236.5 };

export const runState = {
  active: false,
  flagIndex: 0,
  elapsed: 0,
  timeLeft: RUN_TIMEOUT_SEC,
  flags: [
    { x: GYM_BASE.x - 15, z: GYM_BASE.z - 10 },
    { x: GYM_BASE.x, z: GYM_BASE.z - 22 },
    { x: GYM_BASE.x + 15, z: GYM_BASE.z - 10 }
  ]
};

let pullupCount = 0;

export function resetFitnessProgress() {
  pullupCount = 0;
  runState.active = false;
  runState.flagIndex = 0;
  runState.elapsed = 0;
  runState.timeLeft = RUN_TIMEOUT_SEC;
}

export function getFitnessRunTarget(targetObj) {
  const flag = runState.flags[runState.flagIndex];
  if (!flag) return null;
  targetObj.text = RUN_FLAG_LABELS[runState.flagIndex] || RUN_FLAG_LABELS[0];
  targetObj.x = flag.x;
  targetObj.z = flag.z;
  return targetObj;
}

export function performFitnessStep() {
  if (runState.active) return false;
  pullupCount += 1;
  if (pullupCount < PULLUPS_REQUIRED) {
    emit(EVENTS.TOAST, { message: `מתח ${pullupCount}/${PULLUPS_REQUIRED}`, duration: STEP_TOAST_MS });
    return true;
  }
  runState.active = true;
  runState.flagIndex = 0;
  runState.elapsed = 0;
  runState.timeLeft = RUN_TIMEOUT_SEC;
  emit(EVENTS.TOAST, { message: '5/5 מתח! רוץ אל 3 הדגלים תוך 60 שניות!', duration: TASK_TOAST_MS });
  emit(OBJECTIVE_UPDATED_EVENT, {});
  return true;
}

export function updateFitnessRun(dt, fitnessDone, onComplete) {
  if (!runState.active) return;
  if (fitnessDone) {
    runState.active = false;
    return;
  }
  runState.elapsed += dt;
  runState.timeLeft = Math.max(0, RUN_TIMEOUT_SEC - runState.elapsed);
  const flag = runState.flags[runState.flagIndex];
  if (flag && Math.hypot(player.pos.x - flag.x, player.pos.z - flag.z) <= FLAG_RADIUS_M) {
    runState.flagIndex += 1;
    if (runState.flagIndex >= runState.flags.length) {
      onComplete();
    } else {
      emit(EVENTS.TOAST, { message: `דגל ${runState.flagIndex}/${runState.flags.length}`, duration: STEP_TOAST_MS });
      emit(OBJECTIVE_UPDATED_EVENT, {});
    }
  } else if (runState.elapsed >= RUN_TIMEOUT_SEC - EPSILON) {
    resetFitnessProgress();
    emit(EVENTS.TOAST, { message: 'זמן הריצה תם! חזור למתקן הכושר.', duration: TASK_TOAST_MS });
    emit(OBJECTIVE_UPDATED_EVENT, {});
  }
}
