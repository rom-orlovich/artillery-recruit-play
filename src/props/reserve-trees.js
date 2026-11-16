import * as THREE from 'three';
import { createInstanced, addBoxCollider, mergeGeoList, makeRng } from './reserve-props.js';

export function addCypressRows(mapGroup, getHeight, rows, seed, isBlocked) {
  const rng = makeRng(seed);
  const trunkGeo = new THREE.CylinderGeometry(0.14, 0.24, 2.2, 5);
  trunkGeo.translate(0, 1.1, 0);
  const c1 = new THREE.ConeGeometry(1.15, 4.6, 6);
  c1.translate(0, 3.6, 0);
  const c2 = new THREE.ConeGeometry(0.88, 3.8, 6);
  c2.translate(0, 5.8, 0);
  const c3 = new THREE.ConeGeometry(0.48, 2.6, 6);
  c3.translate(0, 7.6, 0);
  const crownGeo = mergeGeoList([c1, c2, c3]);
  c1.dispose();
  c2.dispose();
  c3.dispose();
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c4738, roughness: 0.95 });
  const crownMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
  const transforms = [];
  const colors = [];
  const pal = [0x2a442d, 0x314d33, 0x253b27];
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    const n = row.count || 8;
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0.5 : i / (n - 1);
      const x = row.x1 + (row.x2 - row.x1) * t + (rng() - 0.5) * 0.9;
      const z = row.z1 + (row.z2 - row.z1) * t + (rng() - 0.5) * 0.9;
      if (isBlocked && isBlocked(x, z)) continue;
      const y = getHeight(x, z);
      const s = 0.82 + rng() * 0.42;
      transforms.push({ x, y: y - 0.15, z, ry: rng() * 6.28, sx: s * (0.9 + rng() * 0.2), sy: s, sz: s * (0.9 + rng() * 0.2) });
      colors.push(pal[Math.floor(rng() * pal.length)]);
      addBoxCollider(mapGroup, x, z, 0.45, 0.45, y - 0.5, y + 6.0);
    }
  }
  createInstanced(mapGroup, trunkGeo, trunkMat, transforms);
  createInstanced(mapGroup, crownGeo, crownMat, transforms, colors);
}

export function addEucalyptusWindbreak(mapGroup, getHeight, lines, seed, isBlocked) {
  const rng = makeRng(seed);
  const t0 = new THREE.CylinderGeometry(0.24, 0.38, 6.2, 6);
  t0.translate(0, 3.1, 0);
  const t1 = new THREE.CylinderGeometry(0.11, 0.19, 3.4, 5);
  t1.rotateZ(0.42);
  t1.translate(-0.7, 6.1, 0.2);
  const t2 = new THREE.CylinderGeometry(0.1, 0.18, 3.2, 5);
  t2.rotateZ(-0.38);
  t2.translate(0.75, 6.0, -0.2);
  const trunkGeo = mergeGeoList([t0, t1, t2]);
  t0.dispose();
  t1.dispose();
  t2.dispose();
  const s1 = new THREE.IcosahedronGeometry(2.3, 0);
  s1.scale(1.15, 0.85, 1.05);
  s1.translate(0, 8.1, 0);
  const s2 = new THREE.IcosahedronGeometry(1.75, 0);
  s2.translate(-1.35, 7.2, 0.45);
  const s3 = new THREE.IcosahedronGeometry(1.65, 0);
  s3.translate(1.3, 7.1, -0.45);
  const crownGeo = mergeGeoList([s1, s2, s3]);
  s1.dispose();
  s2.dispose();
  s3.dispose();
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0xb6b0a3, roughness: 0.9 });
  const crownMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.88 });
  const transforms = [];
  const colors = [];
  const pal = [0x3f6b4e, 0x4b7758, 0x567d58];
  for (let l = 0; l < lines.length; l++) {
    const line = lines[l];
    const n = line.count || 10;
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0.5 : i / (n - 1);
      const x = line.x1 + (line.x2 - line.x1) * t + (rng() - 0.5) * 1.4;
      const z = line.z1 + (line.z2 - line.z1) * t + (rng() - 0.5) * 1.4;
      if (isBlocked && isBlocked(x, z)) continue;
      const y = getHeight(x, z);
      const s = 0.88 + rng() * 0.45;
      transforms.push({ x, y: y - 0.2, z, ry: rng() * 6.28, sx: s, sy: s * (0.95 + rng() * 0.2), sz: s });
      colors.push(pal[Math.floor(rng() * pal.length)]);
      addBoxCollider(mapGroup, x, z, 0.5, 0.5, y - 0.5, y + 8.0);
    }
  }
  createInstanced(mapGroup, trunkGeo, trunkMat, transforms);
  createInstanced(mapGroup, crownGeo, crownMat, transforms, colors);
}

export function addOliveGrove(mapGroup, bake, getHeight, spec, seed, isBlocked) {
  const rng = makeRng(seed);
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0xc9c2ae, roughness: 0.96 });
  if (spec.terraces && bake) {
    const wallBox = new THREE.BoxGeometry(1, 1, 1);
    for (let i = 0; i < spec.terraces.length; i++) {
      const tw = spec.terraces[i];
      const dx = tw.x2 - tw.x1;
      const dz = tw.z2 - tw.z1;
      const len = Math.hypot(dx, dz);
      const mx = (tw.x1 + tw.x2) * 0.5;
      const mz = (tw.z1 + tw.z2) * 0.5;
      const my = Math.min(getHeight(tw.x1, tw.z1), getHeight(mx, mz), getHeight(tw.x2, tw.z2)) - 0.2;
      const yaw = Math.atan2(dx, dz);
      bake.add(wallBox, stoneMat, mx, my + 0.55, mz, 0, yaw, 0, 0.85, 1.35, len);
      const ac = Math.abs(Math.cos(yaw));
      const as = Math.abs(Math.sin(yaw));
      addBoxCollider(mapGroup, mx, mz, 0.45 * ac + (len * 0.5) * as, 0.45 * as + (len * 0.5) * ac, my, my + 1.3);
    }
    wallBox.dispose();
  }
  const t0 = new THREE.CylinderGeometry(0.22, 0.34, 2.1, 6);
  t0.translate(0, 1.05, 0);
  const t1 = new THREE.CylinderGeometry(0.11, 0.16, 1.6, 5);
  t1.rotateZ(0.62);
  t1.translate(-0.55, 2.25, 0.1);
  const t2 = new THREE.CylinderGeometry(0.1, 0.16, 1.5, 5);
  t2.rotateZ(-0.58);
  t2.translate(0.55, 2.2, -0.1);
  const trunkGeo = mergeGeoList([t0, t1, t2]);
  t0.dispose();
  t1.dispose();
  t2.dispose();
  const c1 = new THREE.IcosahedronGeometry(1.75, 0);
  c1.scale(1.25, 0.72, 1.15);
  c1.translate(0, 3.1, 0);
  const c2 = new THREE.IcosahedronGeometry(1.3, 0);
  c2.scale(1.1, 0.7, 1.0);
  c2.translate(-1.05, 2.75, 0.35);
  const c3 = new THREE.IcosahedronGeometry(1.25, 0);
  c3.scale(1.1, 0.7, 1.0);
  c3.translate(1.0, 2.8, -0.35);
  const crownGeo = mergeGeoList([c1, c2, c3]);
  c1.dispose();
  c2.dispose();
  c3.dispose();
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b5846, roughness: 0.95 });
  const crownMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
  const transforms = [];
  const colors = [];
  const pal = spec.palette || [0x6e7f5a, 0x7b8b66, 0x5d6e4c];
  for (let z = spec.minZ; z <= spec.maxZ; z += spec.stepZ || 8) {
    for (let x = spec.minX; x <= spec.maxX; x += spec.stepX || 8) {
      const px = x + (rng() - 0.5) * 2.2;
      const pz = z + (rng() - 0.5) * 2.2;
      if (isBlocked && isBlocked(px, pz)) continue;
      const py = getHeight(px, pz);
      const s = 0.78 + rng() * 0.42;
      transforms.push({ x: px, y: py - 0.15, z: pz, ry: rng() * 6.28, sx: s, sy: s, sz: s });
      colors.push(pal[Math.floor(rng() * pal.length)]);
      addBoxCollider(mapGroup, px, pz, 0.42, 0.42, py - 0.5, py + 3.5);
    }
  }
  createInstanced(mapGroup, trunkGeo, trunkMat, transforms);
  createInstanced(mapGroup, crownGeo, crownMat, transforms, colors);
}

export function addPineOakForest(mapGroup, getHeight, zones, seed, isBlocked) {
  const rng = makeRng(seed);
  const trunkGeo = new THREE.CylinderGeometry(0.18, 0.3, 4.2, 6);
  trunkGeo.translate(0, 2.1, 0);
  const p1 = new THREE.ConeGeometry(2.1, 3.2, 7);
  p1.translate(0, 4.4, 0);
  const p2 = new THREE.ConeGeometry(1.6, 2.8, 7);
  p2.translate(0, 6.0, 0);
  const crownGeo = mergeGeoList([p1, p2]);
  p1.dispose();
  p2.dispose();
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x664d3e, roughness: 0.95 });
  const crownMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92 });
  const transforms = [];
  const colors = [];
  for (let zi = 0; zi < zones.length; zi++) {
    const zSpec = zones[zi];
    for (let i = 0; i < zSpec.count * 3 && transforms.length < zSpec.limit; i++) {
      const x = zSpec.minX + rng() * (zSpec.maxX - zSpec.minX);
      const z = zSpec.minZ + rng() * (zSpec.maxZ - zSpec.minZ);
      if (isBlocked && isBlocked(x, z)) continue;
      const y = getHeight(x, z);
      const s = 0.8 + rng() * 0.55;
      transforms.push({ x, y: y - 0.2, z, ry: rng() * 6.28, sx: s, sy: s, sz: s });
      const charred = zSpec.charZone && zSpec.charZone(x, z) && rng() < 0.65;
      colors.push(charred ? 0x2a2826 : zSpec.palette[Math.floor(rng() * zSpec.palette.length)]);
      addBoxCollider(mapGroup, x, z, 0.45, 0.45, y - 0.5, y + 6.0);
    }
  }
  createInstanced(mapGroup, trunkGeo, trunkMat, transforms);
  createInstanced(mapGroup, crownGeo, crownMat, transforms, colors);
}

export function addGrassTufts(mapGroup, getHeight, count, bounds, palette, seed, isBlocked) {
  const rng = makeRng(seed);
  const q1 = new THREE.PlaneGeometry(0.65, 0.48);
  q1.translate(0, 0.24, 0);
  const q2 = new THREE.PlaneGeometry(0.65, 0.48);
  q2.rotateY(Math.PI * 0.5);
  q2.translate(0, 0.24, 0);
  const geo = mergeGeoList([q1, q2]);
  q1.dispose();
  q2.dispose();
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, side: THREE.DoubleSide });
  const transforms = [];
  const colors = [];
  const [minX, maxX, minZ, maxZ] = bounds;
  for (let i = 0; i < count * 2 && transforms.length < count; i++) {
    const x = minX + rng() * (maxX - minX);
    const z = minZ + rng() * (maxZ - minZ);
    if (isBlocked && isBlocked(x, z)) continue;
    const s = 0.7 + rng() * 0.9;
    transforms.push({ x, y: getHeight(x, z) - 0.04, z, ry: rng() * 3.14, sx: s, sy: s * (0.7 + rng() * 0.6), sz: s });
    colors.push(palette[Math.floor(rng() * palette.length)]);
  }
  const inst = createInstanced(mapGroup, geo, mat, transforms, colors);
  if (inst) inst.castShadow = false;
}
