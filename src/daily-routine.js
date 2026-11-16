import { EVENTS, LANDMARKS } from './config.js';
import { emit, player, save, writeSave } from './state.js';
import { getCurrentMapId } from './world.js';
import { addXp } from './player-level.js';
import {
  getFitnessRunTarget,
  performFitnessStep,
  resetFitnessProgress,
  runState,
  updateFitnessRun
} from './routine-fitness.js';

const ROUTINE_MAP_ID = 'line';
const STATION_RADIUS_M = 4;
const GUARD_RADIUS_M = 6;
const GUARD_SHIFT_SEC = 20;
const STEP_TOAST_MS = 2200;
const TASK_TOAST_MS = 3200;
const EPSILON = 1e-6;
const OBJECTIVE_UPDATED_EVENT = EVENTS.OBJECTIVE_UPDATED || 'mission:objective_updated';
const DONE_SHORT_LABEL = 'בוצע';
const DONE_LABEL = '[E] בוצע היום';

export const ROUTINE_TASKS = [
  { id: 'fitness', title: 'כושר בוקר', label: '[E] כושר בוקר', landmark: 'fieldGym', xp: 60, shortLabel: 'מתח', stationHint: 'מתקן הכושר' },
  { id: 'parade', title: 'מסדר בוקר', label: '[E] מסדר בוקר', landmark: 'dutyBoard', xp: 30, shortLabel: 'מסדר', stationHint: 'לוח התורנויות' },
  { id: 'meal', title: 'ארוחת צהריים', label: '[E] ארוחת צהריים', landmark: 'dinnerTent', xp: 30, shortLabel: 'ארוחת', stationHint: 'חדר האוכל' },
  { id: 'weapon_cleaning', title: 'ניקוי נשק', label: '[E] ניקוי נשק', landmark: 'batteryTents', xp: 30, shortLabel: 'ניקוי', stationHint: 'אוהלי הסוללה' },
  { id: 'guard', title: 'שמירה', label: '[E] שמירה', landmark: 'commanderTent', xp: 30, shortLabel: 'שמירה', stationHint: 'עמדת השמירה ליד אוהל המפקד' }
];

const guardState = {
  active: false,
  elapsed: 0
};

let commanderTargetTaskId = null;

const routineView = ROUTINE_TASKS.map((t) => ({ id: t.id, title: t.title, done: false }));
const stationTarget = { x: 0, y: 0, z: 0 };
const routineCandidate = {
  dist: 0,
  type: 'routine',
  label: '',
  shortLabel: '',
  target: stationTarget,
  taskId: ''
};
const routineTargetObj = { text: '', x: 0, z: 0 };

function findTaskById(taskId) {
  for (let i = 0; i < ROUTINE_TASKS.length; i += 1) {
    if (ROUTINE_TASKS[i].id === taskId) return ROUTINE_TASKS[i];
  }
  return null;
}

function resetInProgress() {
  resetFitnessProgress();
  guardState.active = false;
  guardState.elapsed = 0;
  commanderTargetTaskId = null;
}

function ensureRoutineSave() {
  const currentDay = typeof save.day === 'number' ? save.day : 1;
  if (!save.routine || typeof save.routine !== 'object') {
    save.routine = { day: currentDay, done: {} };
    resetInProgress();
    return save.routine;
  }
  if (!save.routine.done || typeof save.routine.done !== 'object') {
    save.routine.done = {};
  }
  if (save.routine.day !== currentDay) {
    save.routine.day = currentDay;
    for (const key of Object.keys(save.routine.done)) delete save.routine.done[key];
    resetInProgress();
  }
  return save.routine;
}

function completeRoutineTask(task) {
  const r = ensureRoutineSave();
  if (r.done[task.id]) return false;
  r.done[task.id] = true;
  if (task.id === 'fitness') {
    resetFitnessProgress();
  } else if (task.id === 'guard') {
    guardState.active = false;
    guardState.elapsed = 0;
  }
  if (commanderTargetTaskId === task.id) {
    commanderTargetTaskId = null;
  }
  emit(EVENTS.TOAST, { message: `הושלם: ${task.title} (+${task.xp} XP)`, duration: TASK_TOAST_MS });
  addXp(task.xp);
  emit(OBJECTIVE_UPDATED_EVENT, {});
  writeSave();
  return true;
}

function completeFitnessTask() {
  return completeRoutineTask(ROUTINE_TASKS[0]);
}

export function getDailyRoutine() {
  const r = ensureRoutineSave();
  for (let i = 0; i < ROUTINE_TASKS.length; i += 1) {
    routineView[i].done = Boolean(r.done[ROUTINE_TASKS[i].id]);
  }
  return routineView;
}

export function getRoutineRun() {
  ensureRoutineSave();
  return runState;
}

export function getNextRoutineTask() {
  const r = ensureRoutineSave();
  for (let i = 0; i < ROUTINE_TASKS.length; i += 1) {
    if (!r.done[ROUTINE_TASKS[i].id]) return ROUTINE_TASKS[i];
  }
  return null;
}

export function setCommanderRoutineTarget(taskId) {
  const r = ensureRoutineSave();
  if (!taskId || r.done[taskId]) {
    commanderTargetTaskId = null;
    emit(OBJECTIVE_UPDATED_EVENT, {});
    return null;
  }
  commanderTargetTaskId = taskId;
  emit(OBJECTIVE_UPDATED_EVENT, {});
  return findTaskById(taskId);
}

export function getRoutineTarget() {
  if (getCurrentMapId() !== ROUTINE_MAP_ID) return null;
  const r = ensureRoutineSave();
  if (runState.active) {
    return getFitnessRunTarget(routineTargetObj);
  }
  if (commanderTargetTaskId) {
    if (r.done[commanderTargetTaskId]) {
      commanderTargetTaskId = null;
      return null;
    }
    const task = findTaskById(commanderTargetTaskId);
    const pos = task ? LANDMARKS[task.landmark] : null;
    if (!task || !pos) {
      commanderTargetTaskId = null;
      return null;
    }
    routineTargetObj.text = task.title;
    routineTargetObj.x = pos.x;
    routineTargetObj.z = pos.z;
    return routineTargetObj;
  }
  return null;
}

export function getRoutineInteraction(playerPos) {
  if (getCurrentMapId() !== ROUTINE_MAP_ID || !playerPos) return null;
  const r = ensureRoutineSave();
  let bestTask = null;
  let bestPos = null;
  let bestDist = Infinity;

  for (let i = 0; i < ROUTINE_TASKS.length; i += 1) {
    const task = ROUTINE_TASKS[i];
    if (task.id === 'fitness' && runState.active) continue;
    const pos = LANDMARKS[task.landmark];
    if (!pos) continue;
    const dist = Math.hypot(playerPos.x - pos.x, playerPos.z - pos.z);
    if (dist <= STATION_RADIUS_M && dist < bestDist) {
      bestTask = task;
      bestPos = pos;
      bestDist = dist;
    }
  }

  if (!bestTask || !bestPos) return null;
  const done = Boolean(r.done[bestTask.id]);
  stationTarget.x = bestPos.x;
  stationTarget.y = 0;
  stationTarget.z = bestPos.z;
  routineCandidate.dist = bestDist;
  routineCandidate.taskId = bestTask.id;
  routineCandidate.shortLabel = done ? DONE_SHORT_LABEL : bestTask.shortLabel;
  routineCandidate.label = done ? DONE_LABEL : bestTask.label;
  return routineCandidate;
}

export function performRoutineStep(taskId) {
  if (getCurrentMapId() !== ROUTINE_MAP_ID) return false;
  const r = ensureRoutineSave();
  const task = findTaskById(taskId);
  if (!task) return false;
  if (r.done[task.id]) return true;

  if (task.id === 'fitness') {
    return performFitnessStep();
  }

  if (task.id === 'guard') {
    if (!guardState.active) {
      guardState.active = true;
      guardState.elapsed = 0;
    }
    emit(EVENTS.TOAST, { message: 'משמרת שמירה פעילה — הישאר בעמדה 20 שניות.', duration: STEP_TOAST_MS });
    return true;
  }

  return completeRoutineTask(task);
}

export function updateDailyRoutine(dt) {
  if (!dt || dt <= 0) return;
  if (getCurrentMapId() !== ROUTINE_MAP_ID) return;
  const r = ensureRoutineSave();

  updateFitnessRun(dt, r.done.fitness, completeFitnessTask);

  if (guardState.active) {
    if (r.done.guard) {
      guardState.active = false;
      guardState.elapsed = 0;
      return;
    }
    const post = LANDMARKS.commanderTent;
    if (!post) return;
    const dist = Math.hypot(player.pos.x - post.x, player.pos.z - post.z);
    if (dist <= GUARD_RADIUS_M) {
      guardState.elapsed += dt;
      if (guardState.elapsed >= GUARD_SHIFT_SEC - EPSILON) {
        completeRoutineTask(ROUTINE_TASKS[4]);
      }
    } else {
      guardState.elapsed = 0;
    }
  }
}
