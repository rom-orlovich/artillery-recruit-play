import { getDrones } from './entities.js';

const DIM_FACTOR = 0.25;
const INTENSITY_EPSILON = 0.001;

const lightOriginals = new Map();
const ambientOriginals = new Map();
const ambientBoosted = new Map();

let pendingDimmed = false;
let pendingBoost = 0;

function traversePointLight(obj) {
  if (!obj || !obj.isLight) return;
  if (obj.isPointLight || obj.isSpotLight) {
    if (!lightOriginals.has(obj)) lightOriginals.set(obj, obj.intensity);
    const base = lightOriginals.get(obj);
    obj.intensity = pendingDimmed ? base * DIM_FACTOR : base;
  }
}

function traverseAmbientApply(obj) {
  if (!obj || !obj.isLight) return;
  if (obj.isAmbientLight || obj.isHemisphereLight) {
    if (!ambientOriginals.has(obj)) ambientOriginals.set(obj, obj.intensity);
    const base = ambientOriginals.get(obj);
    const next = base + pendingBoost;
    obj.intensity = next;
    ambientBoosted.set(obj, next);
  }
}

function traverseAmbientSync(obj) {
  if (!obj || !obj.isLight) return;
  if (obj.isAmbientLight || obj.isHemisphereLight) {
    if (!ambientBoosted.has(obj)) {
      ambientOriginals.set(obj, obj.intensity);
      const next = obj.intensity + pendingBoost;
      obj.intensity = next;
      ambientBoosted.set(obj, next);
      return;
    }
    const prevSet = ambientBoosted.get(obj);
    if (Math.abs(obj.intensity - prevSet) > INTENSITY_EPSILON) {
      ambientOriginals.set(obj, obj.intensity);
      const next = obj.intensity + pendingBoost;
      obj.intensity = next;
      ambientBoosted.set(obj, next);
    }
  }
}

function traverseAmbientRestore(obj) {
  if (!obj || !obj.isLight) return;
  if (obj.isAmbientLight || obj.isHemisphereLight) {
    if (ambientOriginals.has(obj) && ambientBoosted.has(obj)) {
      const prevSet = ambientBoosted.get(obj);
      if (Math.abs(obj.intensity - prevSet) <= INTENSITY_EPSILON) {
        obj.intensity = ambientOriginals.get(obj);
      }
    }
  }
}

function setInfiltratorsRevealed(revealed) {
  const drones = getDrones();
  if (!Array.isArray(drones)) return;
  for (let i = 0; i < drones.length; i += 1) {
    const d = drones[i];
    if (d && d.enemyType === 'infiltrator') {
      d.revealed = revealed;
      d.targetable = revealed;
      if (d.group) d.group.visible = revealed;
      if (d.hitMesh) d.hitMesh.visible = revealed;
    }
  }
}

export function clearLightingOriginals() {
  lightOriginals.clear();
  ambientOriginals.clear();
  ambientBoosted.clear();
}

export function setScenePointLightsDimmed(sceneRef, dimmed) {
  if (!sceneRef || typeof sceneRef.traverse !== 'function') return;
  pendingDimmed = dimmed;
  sceneRef.traverse(traversePointLight);
}

export function applySceneAmbientBoost(sceneRef, boost) {
  if (!sceneRef || typeof sceneRef.traverse !== 'function') return;
  pendingBoost = boost;
  sceneRef.traverse(traverseAmbientApply);
}

export function syncSceneAmbientBoost(sceneRef, boost) {
  if (!sceneRef || typeof sceneRef.traverse !== 'function') return;
  pendingBoost = boost;
  sceneRef.traverse(traverseAmbientSync);
}

export function clearSceneAmbientBoost(sceneRef) {
  if (sceneRef && typeof sceneRef.traverse === 'function') {
    sceneRef.traverse(traverseAmbientRestore);
  }
  ambientOriginals.clear();
  ambientBoosted.clear();
}

export function revealInfiltrators() {
  setInfiltratorsRevealed(true);
}

export function concealInfiltrators() {
  setInfiltratorsRevealed(false);
}
