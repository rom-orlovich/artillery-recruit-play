import * as THREE from 'three';
import { EVENTS } from './config.js';
import { player, runtime, emit } from './state.js';
import { MAPS } from './maps/map-registry.js';
import { buildMapSkyline } from './maps/map-biomes.js';
import { resetWorldKit, disposeMapGroup, colliders, worldShootables, regionShootables, distanceCulled, createBake } from './world-kit.js';
import { setActiveTerrainMap, getTerrainHeight, createTerrainTiles, createGunPitBerms } from './world-terrain.js';
import { createSplat, createTerrainMaterial } from './world-ground.js';
import { createSky, disposeSky, applyMapAtmosphere } from './world-sky.js';
import { getSkyPhase, setTimeOfDay, advanceGameClock } from './world-time.js';
import { resetSoldiers, initSoldiers, updateSoldiers } from './world-soldiers.js';
import { initNpcsForMap } from './npc.js';
import { rebuildEntitiesForMap } from './entities.js';
import { resetFireMissionMapState } from './fire-mission-loop.js';

export { colliders, worldShootables, getTerrainHeight, getSkyPhase, setTimeOfDay };

const TILE_VIEW_DISTANCE = 380;
const SHADOW_EXTENT = 70;
const H_FOV = 95;
const V_FOV_MIN = 40;
const V_FOV_MAX = 72;
const FLAG_SPOTS = [
  { region: 'shivta', x: -18, z: -25.5 }, { region: 'shivta', x: -14, z: -25.5 }, { region: 'shivta', x: -10, z: -25.5 },
  { region: 'yoav', x: -104, z: -182.5 }, { region: 'line', x: -6, z: -396 }
];

const animatedFlags = [];
const state = {
  scene: null, camera: null, renderer: null, sky: null, mapGroup: null,
  splatTexture: null, terrainMaterial: null, tiles: [],
  currentMapId: 'shivta', lastKey: '', lastSkyTimeSec: null
};
let worldInitialized = false;
export const splatInfo = { data: null, size: 0 };

function distanceToRect(x, z, [minX, maxX, minZ, maxZ]) {
  return Math.hypot(Math.max(minX - x, 0, x - maxX), Math.max(minZ - z, 0, z - maxZ));
}

export function getColliders() {
  return colliders;
}

export function getCurrentMapId() {
  return state.currentMapId;
}

export function getRegionAt() {
  return state.currentMapId;
}

function mapSkyWeights(id) {
  return { shivta: 0, yoav: 0, line: 0, zaura: 0, beit_hillel: 0, tzeelim: 0, [id]: 1 };
}

function createFlagTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 160;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 256, 160);
  ctx.fillStyle = '#0038b8';
  ctx.fillRect(0, 18, 256, 24);
  ctx.fillRect(0, 118, 256, 24);
  ctx.strokeStyle = '#0038b8';
  ctx.lineWidth = 6;
  for (const [a, b] of [[52, 92], [106, 66]]) {
    ctx.beginPath();
    ctx.moveTo(128, a);
    ctx.lineTo(106, b);
    ctx.lineTo(150, b);
    ctx.closePath();
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function addFlagsForMap(id, mapGroup) {
  const spots = FLAG_SPOTS.filter((s) => s.region === id);
  if (!spots.length) return;
  const material = new THREE.MeshLambertMaterial({ map: createFlagTexture(), side: THREE.DoubleSide });
  for (const spot of spots) {
    const y = getTerrainHeight(spot.x, spot.z);
    const bake = createBake();
    bake.mesh('paint', new THREE.CylinderGeometry(0.06, 0.09, 9, 8), spot.x, y + 4.5, spot.z, 0, 0xd5d8d2);
    mapGroup.add(bake.build('flagpole'));
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.5, 8, 2), material);
    flag.position.set(spot.x + 1.25, y + 8.1, spot.z);
    flag.name = 'flag';
    mapGroup.add(flag);
    animatedFlags.push({ mesh: flag, base: flag.geometry.attributes.position.array.slice(), phase: spot.x });
  }
}

function setupRenderer(canvas, isMobile) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !isMobile, powerPreference: 'high-performance', stencil: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = !isMobile;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  return renderer;
}

function fitLens(camera) {
  camera.aspect = window.innerWidth / window.innerHeight;
  const vertical = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(H_FOV / 2)) / camera.aspect);
  camera.fov = THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(vertical), V_FOV_MIN, V_FOV_MAX);
  camera.updateProjectionMatrix();
}

function setupShadows(sun, isMobile) {
  if (isMobile) return;
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 10;
  sun.shadow.camera.far = 320;
  sun.shadow.camera.left = -SHADOW_EXTENT;
  sun.shadow.camera.right = SHADOW_EXTENT;
  sun.shadow.camera.top = SHADOW_EXTENT;
  sun.shadow.camera.bottom = -SHADOW_EXTENT;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.04;
}

export function mountMapSync(id, spawnOverride) {
  const mapDef = MAPS[id];
  if (!mapDef) throw new Error(`Unknown map: ${id}`);
  if (!state.scene) return mapDef;

  runtime.dialogueOpen = false;
  resetSoldiers();
  animatedFlags.length = 0;
  for (let i = state.scene.children.length - 1; i >= 0; i--) {
    const child = state.scene.children[i];
    if (typeof child.name === 'string' && child.name.startsWith('map-')) {
      state.scene.remove(child);
      disposeMapGroup(child);
    }
  }
  if (state.splatTexture) { state.splatTexture.dispose(); state.splatTexture = null; }
  if (state.terrainMaterial) { state.terrainMaterial.dispose(); state.terrainMaterial = null; }
  resetWorldKit();

  state.currentMapId = id;
  const mapGroup = new THREE.Group();
  mapGroup.name = `map-${id}`;
  const guns = mapDef.guns || [];
  mapGroup.userData.guns = guns;
  mapGroup.userData.colliders = colliders;
  state.scene.add(mapGroup);
  state.mapGroup = mapGroup;

  setActiveTerrainMap(id, guns, mapGroup);
  const splat = createSplat(id, guns);
  splatInfo.data = splat.data;
  splatInfo.size = splat.size;
  state.splatTexture = splat.texture;
  const terrainMaterial = createTerrainMaterial(splat.texture, id);
  state.terrainMaterial = terrainMaterial;

  state.tiles = createTerrainTiles(terrainMaterial, id, mapGroup) || [];
  for (const tile of state.tiles) if (tile.parent !== mapGroup) mapGroup.add(tile);
  if (guns.length > 0) {
    const berm = createGunPitBerms(terrainMaterial, guns);
    if (berm && berm.parent !== mapGroup) mapGroup.add(berm);
  }

  const skyline = buildMapSkyline(id);
  if (skyline) { skyline.name = `skyline-${id}`; mapGroup.add(skyline); }

  mapDef.build(mapGroup);
  addFlagsForMap(id, mapGroup);
  initNpcsForMap(id, mapGroup);
  initSoldiers(mapGroup, id);
  if (Array.isArray(regionShootables[id])) {
    for (const s of regionShootables[id]) if (!worldShootables.includes(s)) worldShootables.push(s);
  }

  rebuildEntitiesForMap(id);
  resetFireMissionMapState();
  applyMapAtmosphere(id);

  const spawn = spawnOverride ? { ...mapDef.spawn, ...spawnOverride } : mapDef.spawn;
  const sy = getTerrainHeight(spawn.x, spawn.z);
  if (typeof player.pos?.set === 'function') player.pos.set(spawn.x, sy, spawn.z);
  else if (player.pos) { player.pos.x = spawn.x; player.pos.y = sy; player.pos.z = spawn.z; }
  if (typeof player.vel?.set === 'function') player.vel.set(0, 0, 0);
  player.velY = 0;
  player.onGround = true;
  player.yaw = spawn.yaw ?? 0;
  player.pitch = 0;
  const eyeH = player.eyeHeight || 1.7;
  state.camera.position.set(spawn.x, sy + eyeH, spawn.z);
  state.camera.rotation.set(0, player.yaw, 0);
  state.camera.updateMatrixWorld(true);

  state.lastKey = '';
  updateCullVisibility(spawn.x, spawn.z);
  if (state.sky) state.sky.update(mapSkyWeights(id), state.camera, state.camera.position);
  if (worldInitialized) {
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('map:loaded', { detail: id }));
    emit(EVENTS.STATE_CHANGED, { mapId: id });
  }
  return mapDef;
}

export function createWorld(canvas, isMobile) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(V_FOV_MAX, window.innerWidth / window.innerHeight, 0.15, 1700);
  camera.rotation.order = 'YXZ';
  fitLens(camera);
  const renderer = setupRenderer(canvas, isMobile);
  state.scene = scene;
  state.camera = camera;
  state.renderer = renderer;
  disposeSky();
  state.sky = createSky(scene, renderer);
  setupShadows(state.sky.sun, isMobile);
  state.lastSkyTimeSec = null;
  worldInitialized = false;
  mountMapSync('shivta');
  updateWorldAnimations(0);
  worldInitialized = true;

  window.addEventListener('resize', () => {
    fitLens(camera);
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
  return { scene, camera, renderer };
}

function updateCullVisibility(x, z) {
  const key = `${Math.round(x / 4)}:${Math.round(z / 4)}`;
  if (key === state.lastKey) return;
  state.lastKey = key;
  for (const tile of state.tiles) {
    if (tile.userData?.tileRect) tile.visible = distanceToRect(x, z, tile.userData.tileRect) < TILE_VIEW_DISTANCE;
  }
  for (const entry of distanceCulled) entry.object.visible = Math.hypot(x - entry.x, z - entry.z) < entry.range;
}

function waveFlags(tSec) {
  for (const flag of animatedFlags) {
    if (!flag.mesh.parent?.visible) continue;
    const pos = flag.mesh.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const bx = flag.base[i * 3];
      pos.setZ(i, Math.sin(tSec * 4.2 + bx * 2.6 + flag.phase) * 0.22 * ((bx + 1.2) / 2.4));
    }
    pos.needsUpdate = true;
  }
}

export function updateWorldAnimations(tSec) {
  if (!state.camera) return;
  const dt = state.lastSkyTimeSec === null ? 0 : Math.min(1, Math.max(0, tSec - state.lastSkyTimeSec));
  state.lastSkyTimeSec = tSec;
  advanceGameClock(dt);
  const cullPos = runtime.titleActive ? state.camera.position : player.pos;
  const { x, z } = cullPos;
  updateCullVisibility(x, z);
  state.sky.update(mapSkyWeights(state.currentMapId), state.camera, cullPos);
  waveFlags(tSec);
  updateSoldiers(runtime.dialogueOpen ? 0 : dt, x, z);
  if (typeof window !== 'undefined' && window.__gameDebug) {
    window.__gameDebug.regionVisibility = {
      shivta: state.currentMapId === 'shivta',
      yoav: state.currentMapId === 'yoav',
      line: state.currentMapId === 'line',
      [state.currentMapId]: true
    };
    window.__gameDebug.renderCalls = state.renderer?.info?.render?.calls ?? 0;
  }
}

export function travelTo(regionId) {
  if (!MAPS[regionId]) return false;
  mountMapSync(regionId);
  return true;
}
