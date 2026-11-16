import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { save, player, runtime } from './state.js';
import { createCarriedSandbag, createCarriedShell } from './carry-props.js';

const weaponBasePos = { x: 0.28, y: -0.24, z: -0.48 };
const M16_EYE = { x: 0.2, y: -0.13, z: -0.36 };
const M16_MUZZLE = new THREE.Vector3(0, 0.018, -0.822);
const M16_RAIL_TOP_Y = 0.045;
const M16_RAIL_Z = -0.3;
const SIGHT_HEIGHT = 0.042;
const M16_URL = new URL('../assets/models/m16.glb', import.meta.url).href;
const RELOAD_DURATION = 1.2;
const RELOAD_DROP = 0.12;
const PROC_MAG_BASE_Y = -0.08;
const particles = [];

let weaponGroup = null;
let rifleGroup = null;
let proceduralGroup = null;
let sightMesh = null;
let muzzleMesh = null;
let procMag = null;
let carriedSandbag = null;
let carriedShell = null;
let glbPromise = null;
let glbMag = null;
let glbMagBaseY = 0;
let glbSightParts = [];
let reloadTime = -1;

function toStandardMaterial(mat) {
  if (!mat) return new THREE.MeshStandardMaterial({ roughness: 0.65 });
  return new THREE.MeshStandardMaterial({
    color: mat.color ? mat.color.clone() : new THREE.Color(0xffffff),
    vertexColors: Boolean(mat.vertexColors),
    map: mat.map || null,
    normalMap: mat.normalMap || null,
    roughnessMap: mat.roughnessMap || null,
    metalnessMap: mat.metalnessMap || null,
    aoMap: mat.aoMap || null,
    emissive: mat.emissive ? mat.emissive.clone() : new THREE.Color(0x000000),
    emissiveMap: mat.emissiveMap || null,
    emissiveIntensity: mat.emissiveIntensity ?? 1,
    metalness: mat.metalness ?? 0.2,
    roughness: Math.max(0.5, mat.roughness ?? 0.65),
    transparent: Boolean(mat.transparent),
    opacity: mat.opacity ?? 1,
    side: mat.side ?? THREE.FrontSide
  });
}

function setupM16Scene(sourceScene, targetRifleGroup) {
  if (!targetRifleGroup || targetRifleGroup !== rifleGroup) return;
  const glbRoot = sourceScene.clone(true);
  const glbPivot = new THREE.Group();
  glbPivot.add(glbRoot);

  glbSightParts = [];
  glbRoot.traverse((obj) => {
    const lower = (obj.name || '').toLowerCase();
    if (lower.includes('sight') || lower.includes('dot')) {
      glbSightParts.push(obj);
    }
    if (obj.isMesh) {
      obj.frustumCulled = false;
      obj.castShadow = false;
      obj.receiveShadow = false;
      obj.material = Array.isArray(obj.material)
        ? obj.material.map(toStandardMaterial)
        : toStandardMaterial(obj.material);
    }
  });

  glbMag = glbRoot.getObjectByName('magazine') || null;
  glbMagBaseY = glbMag ? glbMag.position.y : 0;
  if (procMag) procMag.position.y = PROC_MAG_BASE_Y;

  glbRoot.rotation.x = Math.PI / 2;
  glbPivot.position.set(M16_EYE.x - weaponBasePos.x, M16_EYE.y - weaponBasePos.y, M16_EYE.z - weaponBasePos.z);
  glbPivot.updateMatrixWorld(true);
  const muzzleTip = M16_MUZZLE.clone().add(glbPivot.position);

  if (muzzleMesh) muzzleMesh.position.copy(muzzleTip);
  if (proceduralGroup) proceduralGroup.visible = false;
  const showSight = Boolean(save.gear.sight);
  for (const part of glbSightParts) part.visible = showSight;
  if (sightMesh) {
    glbPivot.add(sightMesh);
    sightMesh.position.set(0, M16_RAIL_TOP_Y + SIGHT_HEIGHT * 0.5, M16_RAIL_Z);
    sightMesh.visible = showSight;
  }
  targetRifleGroup.add(glbPivot);
}

function loadM16Once(targetRifleGroup) {
  if (!glbPromise) {
    const loader = new GLTFLoader();
    glbPromise = new Promise((resolve, reject) => {
      loader.load(M16_URL, (gltf) => resolve(gltf.scene), undefined, reject);
    });
  }
  glbPromise.then((scene) => setupM16Scene(scene, targetRifleGroup)).catch(() => {});
}

export function getWeaponGroup() {
  return weaponGroup;
}

export function isReloading() {
  return reloadTime >= 0 || Boolean(runtime.reloading);
}

export function startReloadAnimation() {
  if (reloadTime >= 0) return;
  reloadTime = 0;
  runtime.reloading = true;
}

export function createWeaponModel() {
  reloadTime = -1;
  runtime.reloading = false;
  weaponGroup = new THREE.Group();
  rifleGroup = new THREE.Group();
  rifleGroup.position.set(weaponBasePos.x, weaponBasePos.y, weaponBasePos.z);

  proceduralGroup = new THREE.Group();
  const gunMetal = new THREE.MeshStandardMaterial({ color: 0x24272b, metalness: 0.55, roughness: 0.45 });
  const darkGrip = new THREE.MeshStandardMaterial({ color: 0x2e332c, metalness: 0.2, roughness: 0.8 });

  const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.34), gunMetal);
  proceduralGroup.add(receiver);

  const handguard = new THREE.Mesh(new THREE.BoxGeometry(0.054, 0.064, 0.22), darkGrip);
  handguard.position.set(0, 0.005, -0.24);
  proceduralGroup.add(handguard);

  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.014, 0.34, 8), gunMetal);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.01, -0.44);
  proceduralGroup.add(barrel);

  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.095, 0.18), darkGrip);
  stock.position.set(0, -0.01, 0.24);
  proceduralGroup.add(stock);

  procMag = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.12, 0.056), gunMetal);
  procMag.position.set(0, PROC_MAG_BASE_Y, -0.06);
  procMag.rotation.x = 0.16;
  proceduralGroup.add(procMag);

  rifleGroup.add(proceduralGroup);

  sightMesh = new THREE.Mesh(new THREE.BoxGeometry(0.038, SIGHT_HEIGHT, 0.085), gunMetal);
  sightMesh.position.set(0, 0.06, -0.02);
  sightMesh.visible = Boolean(save.gear.sight);
  rifleGroup.add(sightMesh);

  muzzleMesh = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.055, 0),
    new THREE.MeshBasicMaterial({ color: 0xffd15c, transparent: true, opacity: 0.92 })
  );
  muzzleMesh.position.set(0, 0.012, -0.63);
  muzzleMesh.visible = false;
  rifleGroup.add(muzzleMesh);

  weaponGroup.add(rifleGroup);
  glbMag = null;
  glbSightParts = [];
  loadM16Once(rifleGroup);

  carriedSandbag = createCarriedSandbag();
  weaponGroup.add(carriedSandbag);
  carriedShell = createCarriedShell();
  weaponGroup.add(carriedShell);

  return weaponGroup;
}

export function spawnParticles(scene, pos, color = 0xffb347, count = 12) {
  if (!scene || !pos) return;
  const geo = new THREE.BoxGeometry(0.09, 0.09, 0.09);
  const mat = new THREE.MeshBasicMaterial({ color });
  for (let i = 0; i < count; i++) {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(pos.x, pos.y, pos.z);
    const speed = 2.4 + Math.random() * 4.5;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI * 0.7;
    const vel = new THREE.Vector3(
      Math.cos(theta) * Math.sin(phi) * speed,
      Math.cos(phi) * speed + 1.5,
      Math.sin(theta) * Math.sin(phi) * speed
    );
    scene.add(mesh);
    particles.push({ mesh, vel, life: 0.45 + Math.random() * 0.25, maxLife: 0.7 });
  }
}

export function updateWeaponVisuals(dt) {
  if (!weaponGroup) return;
  const carrying = player.carryingType;
  if (rifleGroup) {
    rifleGroup.visible = !carrying;
    const swayX = Math.cos(runtime.bobTime * 0.5) * 0.008;
    const swayY = Math.abs(Math.sin(runtime.bobTime)) * 0.01;
    rifleGroup.position.set(
      weaponBasePos.x + swayX,
      weaponBasePos.y - swayY,
      weaponBasePos.z + runtime.recoil * 0.16
    );
    rifleGroup.rotation.x = runtime.recoil * 0.42;
  }
  if (reloadTime >= 0) {
    reloadTime += dt;
    let drop = 0;
    if (reloadTime >= RELOAD_DURATION) {
      reloadTime = -1;
      runtime.reloading = false;
    } else {
      drop = Math.sin((reloadTime / RELOAD_DURATION) * Math.PI) * RELOAD_DROP;
    }
    if (glbMag) glbMag.position.y = glbMagBaseY - drop;
    else if (procMag) procMag.position.y = PROC_MAG_BASE_Y - drop;
  }
  const showSight = Boolean(save.gear.sight);
  if (sightMesh) sightMesh.visible = showSight;
  for (const part of glbSightParts) part.visible = showSight;
  if (muzzleMesh) {
    muzzleMesh.visible = runtime.muzzleTimer > 0;
    if (muzzleMesh.visible) muzzleMesh.rotation.z += dt * 35;
  }
  if (carriedSandbag) carriedSandbag.visible = carrying === 'sandbag';
  if (carriedShell) carriedShell.visible = carrying === 'shell';
}

export function updateParticles(dt, scene) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      scene?.remove(p.mesh);
      particles.splice(i, 1);
      continue;
    }
    p.vel.y -= 10 * dt;
    p.mesh.position.addScaledVector(p.vel, dt);
    const s = Math.max(0.1, p.life / p.maxLife);
    p.mesh.scale.setScalar(s);
  }
}
