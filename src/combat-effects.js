import * as THREE from 'three';
import { save, player, runtime } from './state.js';

const weaponBasePos = { x: 0.28, y: -0.24, z: -0.48 };
const particles = [];
let weaponGroup = null;
let rifleGroup = null;
let sightMesh = null;
let muzzleMesh = null;
let carriedSandbag = null;
let carriedShell = null;

export function getWeaponGroup() {
  return weaponGroup;
}

export function createWeaponModel() {
  weaponGroup = new THREE.Group();

  rifleGroup = new THREE.Group();
  rifleGroup.position.set(weaponBasePos.x, weaponBasePos.y, weaponBasePos.z);

  const gunMetal = new THREE.MeshStandardMaterial({ color: 0x24272b, metalness: 0.55, roughness: 0.45 });
  const darkGrip = new THREE.MeshStandardMaterial({ color: 0x2e332c, metalness: 0.2, roughness: 0.8 });

  const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.34), gunMetal);
  rifleGroup.add(receiver);

  const handguard = new THREE.Mesh(new THREE.BoxGeometry(0.054, 0.064, 0.22), darkGrip);
  handguard.position.set(0, 0.005, -0.24);
  rifleGroup.add(handguard);

  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.014, 0.34, 8), gunMetal);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.01, -0.44);
  rifleGroup.add(barrel);

  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.095, 0.18), darkGrip);
  stock.position.set(0, -0.01, 0.24);
  rifleGroup.add(stock);

  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.12, 0.056), gunMetal);
  mag.position.set(0, -0.08, -0.06);
  mag.rotation.x = 0.16;
  rifleGroup.add(mag);

  sightMesh = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.042, 0.085), gunMetal);
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

  carriedSandbag = new THREE.Mesh(
    new THREE.BoxGeometry(0.46, 0.22, 0.32),
    new THREE.MeshStandardMaterial({ color: 0xb59b6b, roughness: 0.95 })
  );
  carriedSandbag.position.set(0, -0.27, -0.5);
  carriedSandbag.visible = false;
  weaponGroup.add(carriedSandbag);

  carriedShell = new THREE.Group();
  const shellBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.075, 0.078, 0.42, 10),
    new THREE.MeshStandardMaterial({ color: 0x4c5838, roughness: 0.6, metalness: 0.3 })
  );
  shellBody.rotation.x = Math.PI / 2;
  const shellTip = new THREE.Mesh(
    new THREE.ConeGeometry(0.075, 0.14, 10),
    new THREE.MeshStandardMaterial({ color: 0xc9a84c, roughness: 0.4, metalness: 0.6 })
  );
  shellTip.rotation.x = -Math.PI / 2;
  shellTip.position.z = -0.28;
  carriedShell.add(shellBody, shellTip);
  carriedShell.position.set(0.08, -0.26, -0.52);
  carriedShell.visible = false;
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
  if (sightMesh) sightMesh.visible = Boolean(save.gear.sight);
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
