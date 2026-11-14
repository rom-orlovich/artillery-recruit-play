import * as THREE from 'three';
import { player } from './state.js';
import { REGIONS } from './world-layout.js';
import { resetWorldKit, colliders, worldShootables, regionShootables, distanceCulled, createBake } from './world-kit.js';
import { getTerrainHeight, createTerrainTiles, createBermMesh, smoothstep } from './world-terrain.js';
import { createSplat, createTerrainMaterial } from './world-ground.js';
import { createSky } from './world-sky.js';
import { buildShivta } from './world-shivta.js';
import { buildYoav } from './world-yoav.js';
import { buildLine } from './world-line.js';
import { addDoher, loadHeroDoher } from './world-vehicles.js';

export { colliders, worldShootables, getTerrainHeight };

const CONTENT_RECTS = {
  shivta: [-210, 210, -125, 100],
  yoav: [-178, -48, -222, -140],
  line: [-205, 205, -440, -212]
};
const REGION_VIEW_DISTANCE = { shivta: 30, yoav: 80, line: 120 };
const TILE_VIEW_DISTANCE = 380;
const SHADOW_EXTENT = 70;
const HERO_RANGE = 55;
const FLAG_SPOTS = [
  { region: 'shivta', x: -18, z: -25.5 }, { region: 'shivta', x: -14, z: -25.5 }, { region: 'shivta', x: -10, z: -25.5 },
  { region: 'yoav', x: -104, z: -182.5 }, { region: 'line', x: -6, z: -396 }
];

const animatedFlags = [];
const state = { scene: null, camera: null, sky: null, regions: {}, tiles: [], heroes: [], activeRegion: null, lastKey: '' };
export const splatInfo = { data: null, size: 0 };

function distanceToRect(x, z, [minX, maxX, minZ, maxZ]) {
  return Math.hypot(Math.max(minX - x, 0, x - maxX), Math.max(minZ - z, 0, z - maxZ));
}

export function getRegionAt(x, z) {
  if (z > -128) return 'shivta';
  if (distanceToRect(x, z, REGIONS.yoav.rect) === 0 && z > -215) return 'yoav';
  return 'line';
}

function regionWeights(x, z) {
  const shivta = smoothstep(-152, -112, z);
  const yoav = (1 - shivta) * (1 - smoothstep(0, 32, distanceToRect(x, z, REGIONS.yoav.rect)));
  return { shivta, yoav, line: Math.max(0, 1 - shivta - yoav) };
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

function addFlags() {
  const material = new THREE.MeshLambertMaterial({ map: createFlagTexture(), side: THREE.DoubleSide });
  for (const spot of FLAG_SPOTS) {
    const group = state.regions[spot.region];
    const y = getTerrainHeight(spot.x, spot.z);
    const bake = createBake();
    bake.mesh('paint', new THREE.CylinderGeometry(0.06, 0.09, 9, 8), spot.x, y + 4.5, spot.z, 0, 0xd5d8d2);
    group.add(bake.build('flagpole'));
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.5, 8, 2), material);
    flag.position.set(spot.x + 1.25, y + 8.1, spot.z);
    flag.name = 'flag';
    group.add(flag);
    animatedFlags.push({ mesh: flag, base: flag.geometry.attributes.position.array.slice(), phase: spot.x });
  }
}

function addHeroGuns(heroSpots) {
  state.heroes = heroSpots.map((spot) => {
    spot.group = state.regions[spot.z > -128 ? 'shivta' : 'line'];
    const bake = createBake();
    addDoher(bake, spot.x, spot.y, spot.z, spot.ry);
    const fallback = bake.build('hero-fallback');
    spot.group.add(fallback);
    return { spot, fallback, mesh: null };
  });
  loadHeroDoher(heroSpots, (meshes) => {
    meshes.forEach((mesh, i) => {
      state.heroes[i].mesh = mesh;
    });
    state.lastKey = '';
  });
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

export function createWorld(canvas, isMobile) {
  resetWorldKit();
  animatedFlags.length = 0;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.15, 1700);
  camera.rotation.order = 'YXZ';
  const renderer = setupRenderer(canvas, isMobile);
  state.scene = scene;
  state.camera = camera;
  state.sky = createSky(scene, renderer);
  setupShadows(state.sky.sun, isMobile);

  const splat = createSplat();
  splatInfo.data = splat.data;
  splatInfo.size = splat.size;
  const terrainMaterial = createTerrainMaterial(splat.texture);
  state.tiles = createTerrainTiles(terrainMaterial);
  for (const tile of state.tiles) scene.add(tile);

  const heroSpots = [];
  state.regions = {
    shivta: buildShivta(scene, heroSpots),
    yoav: buildYoav(scene),
    line: buildLine(scene, heroSpots)
  };
  state.regions.line.add(createBermMesh(terrainMaterial));
  addFlags();
  addHeroGuns(heroSpots);
  state.activeRegion = null;
  state.lastKey = '';
  updateWorldAnimations(0);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
  return { scene, camera, renderer };
}

function updateRegions(x, z) {
  const key = `${Math.round(x / 4)}:${Math.round(z / 4)}`;
  if (key === state.lastKey) return;
  state.lastKey = key;
  for (const [id, group] of Object.entries(state.regions)) {
    group.visible = distanceToRect(x, z, CONTENT_RECTS[id]) < REGION_VIEW_DISTANCE[id];
  }
  for (const tile of state.tiles) tile.visible = distanceToRect(x, z, tile.userData.tileRect) < TILE_VIEW_DISTANCE;
  for (const entry of distanceCulled) entry.object.visible = Math.hypot(x - entry.x, z - entry.z) < entry.range;
  for (const hero of state.heroes) {
    const near = Math.hypot(x - hero.spot.x, z - hero.spot.z) < HERO_RANGE;
    if (hero.mesh) hero.mesh.visible = near;
    hero.fallback.visible = !near || !hero.mesh;
  }
  const active = getRegionAt(x, z);
  if (active !== state.activeRegion) {
    state.activeRegion = active;
    worldShootables.length = 0;
    worldShootables.push(...regionShootables[active]);
  }
}

function waveFlags(tSec) {
  for (const flag of animatedFlags) {
    if (!flag.mesh.parent?.visible) continue;
    const pos = flag.mesh.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const bx = flag.base[i * 3];
      const t = (bx + 1.2) / 2.4;
      pos.setZ(i, Math.sin(tSec * 4.2 + bx * 2.6 + flag.phase) * 0.22 * t);
    }
    pos.needsUpdate = true;
  }
}

export function updateWorldAnimations(tSec) {
  if (!state.camera) return;
  const { x, z } = player.pos;
  updateRegions(x, z);
  state.sky.update(regionWeights(x, z), state.camera, player.pos);
  waveFlags(tSec);
}

export function travelTo(regionId) {
  const region = REGIONS[regionId];
  if (!region) return false;
  player.pos.x = region.travel.x;
  player.pos.z = region.travel.z;
  player.pos.y = getTerrainHeight(region.travel.x, region.travel.z);
  player.velY = 0;
  player.onGround = true;
  player.yaw = region.travel.yaw;
  player.pitch = 0;
  return true;
}
