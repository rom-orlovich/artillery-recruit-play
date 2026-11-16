import * as THREE from 'three';
import * as kit from '../world-kit.js';

export function makeRng(seed) {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function mergeGeoList(list) {
  let total = 0;
  const clones = [];
  for (let i = 0; i < list.length; i++) {
    const src = list[i];
    const g = src.index ? src.toNonIndexed() : src.clone();
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!g.attributes.uv) {
      g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    }
    total += g.attributes.position.count;
    clones.push(g);
  }
  const pos = new Float32Array(total * 3);
  const norm = new Float32Array(total * 3);
  const uv = new Float32Array(total * 2);
  let off = 0;
  for (let i = 0; i < clones.length; i++) {
    const g = clones[i];
    const c = g.attributes.position.count;
    pos.set(g.attributes.position.array, off * 3);
    norm.set(g.attributes.normal.array, off * 3);
    uv.set(g.attributes.uv.array, off * 2);
    off += c;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(norm, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.computeBoundingSphere();
  return out;
}

export function addBoxCollider(mapGroup, cx, cz, hw, hd, minY = -20, maxY = 12) {
  const box = {
    x: cx, z: cz, hw, hd, w: hw * 2, d: hd * 2, y: minY, h: maxY - minY,
    minX: cx - hw, maxX: cx + hw, minZ: cz - hd, maxZ: cz + hd, minY, maxY,
    min: { x: cx - hw, y: minY, z: cz - hd }, max: { x: cx + hw, y: maxY, z: cz + hd }
  };
  if (Array.isArray(kit.colliders)) kit.colliders.push(box);
  if (!Array.isArray(mapGroup.userData.colliders)) {
    mapGroup.userData.colliders = Array.isArray(kit.colliders) ? kit.colliders : [];
  }
  if (mapGroup.userData.colliders !== kit.colliders) mapGroup.userData.colliders.push(box);
}

export function createBake(mapGroup) {
  const buckets = new Map();
  const temp = [];
  const euler = new THREE.Euler();
  const quat = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  const mat4 = new THREE.Matrix4();
  return {
    add(geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
      const g = geo.index ? geo.toNonIndexed() : geo.clone();
      euler.set(rx, ry, rz);
      quat.setFromEuler(euler);
      pos.set(x, y, z);
      scl.set(sx, sy, sz);
      mat4.compose(pos, quat, scl);
      g.applyMatrix4(mat4);
      let list = buckets.get(mat);
      if (!list) { list = []; buckets.set(mat, list); }
      list.push(g);
      temp.push(g);
    },
    flush() {
      const meshes = [];
      for (const [mat, list] of buckets.entries()) {
        const merged = mergeGeoList(list);
        const mesh = new THREE.Mesh(merged, mat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mapGroup.add(mesh);
        if (Array.isArray(kit.worldShootables)) kit.worldShootables.push(mesh);
        meshes.push(mesh);
      }
      for (let i = 0; i < temp.length; i++) temp[i].dispose();
      temp.length = 0;
      buckets.clear();
      return meshes;
    }
  };
}

export function createInstanced(mapGroup, geo, mat, transforms, colors) {
  if (!transforms.length) return null;
  const inst = new THREE.InstancedMesh(geo, mat, transforms.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  const c = new THREE.Color();
  for (let i = 0; i < transforms.length; i++) {
    const t = transforms[i];
    if (t.isMatrix4) {
      inst.setMatrixAt(i, t);
    } else {
      e.set(t.rx || 0, t.ry || 0, t.rz || 0);
      q.setFromEuler(e);
      p.set(t.x || 0, t.y || 0, t.z || 0);
      s.set(t.sx ?? 1, t.sy ?? 1, t.sz ?? 1);
      m.compose(p, q, s);
      inst.setMatrixAt(i, m);
    }
    if (colors && colors[i]) {
      c.set(colors[i]);
      inst.setColorAt(i, c);
    }
  }
  inst.instanceMatrix.needsUpdate = true;
  if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  inst.computeBoundingSphere();
  inst.castShadow = true;
  inst.receiveShadow = true;
  mapGroup.add(inst);
  return inst;
}

export function createReserveMats() {
  const mk = (color, roughness = 0.88, metalness = 0.05, side = THREE.FrontSide) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness, side });
  return {
    idfOlive: mk(0x63674c, 0.78, 0.16),
    trackDark: mk(0x2d2f2b, 0.9, 0.25),
    gunMetal: mk(0x45483d, 0.55, 0.45),
    concrete: mk(0x9b988e, 0.94, 0.02),
    concreteDark: mk(0x747169, 0.95, 0.03),
    rust: mk(0x6e432e, 0.9, 0.35),
    wood: mk(0x8e6b43, 0.92, 0.02),
    canvas: mk(0x7a7657, 0.92, 0.02, THREE.DoubleSide),
    camoNet: mk(0x5b6542, 0.95, 0.02, THREE.DoubleSide),
    containerWhite: mk(0xd8d7cf, 0.72, 0.22),
    containerRed: mk(0x8e3a2d, 0.74, 0.25),
    orange: mk(0xd96820, 0.65, 0.25),
    sandbag: mk(0xa89674, 0.95, 0.01),
    tentBlue: mk(0x5b96b8, 0.85, 0.04),
    tentOrange: mk(0xc96c2a, 0.85, 0.04),
    basaltSoil: mk(0x5c4b3c, 0.96, 0.01),
    claySoil: mk(0x91633f, 0.96, 0.01),
    terraSoil: mk(0x884124, 0.96, 0.01)
  };
}

function addLocalPart(bake, geo, mat, gx, gy, gz, yaw, lx, ly, lz, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  const cy = Math.cos(yaw);
  const syaw = Math.sin(yaw);
  const wx = gx + lx * cy + lz * syaw;
  const wz = gz - lx * syaw + lz * cy;
  bake.add(geo, mat, wx, gy + ly, wz, rx, yaw + ry, rz, sx, sy, sz);
}

export function placeDohers(mapGroup, bake, guns, getHeight, mats) {
  const box = new THREE.BoxGeometry(1, 1, 1);
  const cyl = new THREE.CylinderGeometry(1, 1, 1, 8);
  for (let i = 0; i < guns.length; i++) {
    const g = guns[i];
    const gx = g.x ?? g.pos?.[0] ?? 0;
    const gz = g.z ?? g.pos?.[1] ?? 0;
    const yaw = g.yaw ?? 0;
    const gy = getHeight(gx, gz);
    addLocalPart(bake, box, mats.trackDark, gx, gy, gz, yaw, -1.35, 0.52, 0, 0, 0, 0, 0.6, 1.04, 6.1);
    addLocalPart(bake, box, mats.trackDark, gx, gy, gz, yaw, 1.35, 0.52, 0, 0, 0, 0, 0.6, 1.04, 6.1);
    addLocalPart(bake, box, mats.idfOlive, gx, gy, gz, yaw, 0, 1.05, 0.1, 0, 0, 0, 2.45, 0.98, 5.8);
    addLocalPart(bake, box, mats.idfOlive, gx, gy, gz, yaw, 0, 1.32, -1.85, 0, 0, 0, 2.3, 0.52, 1.7);
    addLocalPart(bake, box, mats.idfOlive, gx, gy, gz, yaw, 0, 2.02, 0.85, 0, 0, 0, 2.7, 1.15, 3.2);
    addLocalPart(bake, box, mats.idfOlive, gx, gy, gz, yaw, 0, 2.12, 2.6, 0, 0, 0, 2.35, 0.82, 0.8);
    addLocalPart(bake, cyl, mats.idfOlive, gx, gy, gz, yaw, 0.72, 2.75, 0.5, 0, 0, 0, 0.4, 0.36, 0.4);
    addLocalPart(bake, box, mats.gunMetal, gx, gy, gz, yaw, -0.85, 2.45, 1.8, 0, 0, 0, 0.55, 0.55, 0.9);
    const elev = -Math.PI / 2 + 0.22;
    addLocalPart(bake, cyl, mats.gunMetal, gx, gy, gz, yaw, 0, 2.72, -3.25, elev, 0, 0, 0.14, 5.5, 0.14);
    addLocalPart(bake, cyl, mats.gunMetal, gx, gy, gz, yaw, 0, 2.76, -3.45, elev, 0, 0, 0.21, 0.85, 0.21);
    addLocalPart(bake, box, mats.gunMetal, gx, gy, gz, yaw, 0, 3.31, -5.85, 0.22, 0, 0, 0.38, 0.32, 0.46);
    const ac = Math.abs(Math.cos(yaw));
    const as = Math.abs(Math.sin(yaw));
    addBoxCollider(mapGroup, gx, gz, 1.85 * ac + 3.2 * as, 1.85 * as + 3.2 * ac, gy - 0.5, gy + 3.4);
  }
  box.dispose();
  cyl.dispose();
}

export function addBasaltBoulders(mapGroup, getHeight, seed, count, bounds, palette, isBlocked) {
  const rng = makeRng(seed);
  const geo = new THREE.DodecahedronGeometry(0.68, 0);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const j = 0.78 + 0.36 * Math.sin(i * 12.7 + seed);
    p.setXYZ(i, p.getX(i) * j, p.getY(i) * (0.62 + 0.28 * Math.cos(i * 5.3)), p.getZ(i) * j);
  }
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.94, metalness: 0.04 });
  const transforms = [];
  const colors = [];
  const [minX, maxX, minZ, maxZ] = bounds;
  for (let i = 0; i < count * 3 && transforms.length < count; i++) {
    const x = minX + rng() * (maxX - minX);
    const z = minZ + rng() * (maxZ - minZ);
    if (isBlocked && isBlocked(x, z)) continue;
    const s = 0.32 + rng() * 1.15;
    transforms.push({ x, y: getHeight(x, z) + s * 0.22, z, rx: rng() * 0.4, ry: rng() * 6.28, rz: rng() * 0.4, sx: s * (0.9 + rng() * 0.4), sy: s * (0.55 + rng() * 0.35), sz: s * (0.9 + rng() * 0.4) });
    colors.push(palette[Math.floor(rng() * palette.length)]);
  }
  createInstanced(mapGroup, geo, mat, transforms, colors);
}

export function addSyrianBunkerRuin(bake, mapGroup, getHeight, x, z, yaw, mats) {
  const y = getHeight(x, z);
  const box = new THREE.BoxGeometry(1, 1, 1);
  const cyl = new THREE.CylinderGeometry(0.04, 0.04, 1.4, 5);
  addLocalPart(bake, box, mats.concreteDark, x, y, z, yaw, 0, 0.1, 0, 0, 0, 0, 8.2, 0.45, 7.2);
  addLocalPart(bake, box, mats.concrete, x, y, z, yaw, 0, 1.3, 3.1, 0, 0, 0, 7.8, 2.3, 0.65);
  addLocalPart(bake, box, mats.concrete, x, y, z, yaw, -3.6, 1.3, 0, 0, 0, 0, 0.65, 2.3, 6.2);
  addLocalPart(bake, box, mats.concrete, x, y, z, yaw, 3.6, 1.1, 0.6, 0, 0, 0.08, 0.65, 1.9, 5.0);
  addLocalPart(bake, box, mats.concrete, x, y, z, yaw, 0, 0.72, -3.1, 0, 0, 0, 7.8, 1.15, 0.7);
  addLocalPart(bake, box, mats.concreteDark, x, y, z, yaw, -0.6, 2.1, -3.1, 0, 0, 0, 6.4, 0.5, 0.72);
  addLocalPart(bake, box, mats.concreteDark, x, y, z, yaw, -0.2, 2.35, 0.2, 0.16, 0, -0.14, 8.0, 0.42, 6.8);
  addLocalPart(bake, box, mats.concreteDark, x, y, z, yaw, 2.6, 0.42, -2.5, 0.2, 0.5, 0.3, 1.4, 0.65, 1.2);
  addLocalPart(bake, box, mats.concrete, x, y, z, yaw, -4.4, 0.35, -1.8, -0.1, 0.8, 0.2, 1.3, 0.55, 1.1);
  for (let i = -1; i <= 2; i++) addLocalPart(bake, cyl, mats.rust, x, y, z, yaw, i * 1.1, 2.55, -2.9, 0.9, 0.2 * i, 0.2, 1, 1, 1);
  box.dispose();
  cyl.dispose();
  addBoxCollider(mapGroup, x, z, 4.3, 3.8, y - 0.5, y + 3.0);
}

export function addTWalls(mapGroup, getHeight, placements, mats) {
  const base = new THREE.BoxGeometry(2.4, 0.42, 1.5);
  base.translate(0, 0.21, 0);
  const stem = new THREE.BoxGeometry(2.4, 2.55, 0.44);
  stem.translate(0, 1.68, 0);
  const geo = mergeGeoList([base, stem]);
  base.dispose();
  stem.dispose();
  const transforms = placements.map((p) => ({ x: p.x, y: getHeight(p.x, p.z) - 0.08, z: p.z, ry: p.yaw || 0 }));
  createInstanced(mapGroup, geo, mats.concrete, transforms);
  for (let i = 0; i < placements.length; i++) {
    const p = placements[i];
    const ac = Math.abs(Math.cos(p.yaw || 0));
    const as = Math.abs(Math.sin(p.yaw || 0));
    addBoxCollider(mapGroup, p.x, p.z, 1.2 * ac + 0.75 * as, 1.2 * as + 0.75 * ac, -10, getHeight(p.x, p.z) + 3.2);
  }
}

export function addEarthenRampart(bake, mapGroup, getHeight, x1, z1, x2, z2, height, width, mat) {
  const dx = x2 - x1;
  const dz = z2 - z1;
  const len = Math.hypot(dx, dz);
  if (len < 0.5) return;
  const mx = (x1 + x2) * 0.5;
  const mz = (z1 + z2) * 0.5;
  const y = Math.min(getHeight(x1, z1), getHeight(mx, mz), getHeight(x2, z2)) - 0.45;
  const yaw = Math.atan2(dx, dz);
  const hw = width * 0.5;
  const tw = width * 0.24;
  const hl = len * 0.5;
  const tl = Math.max(0.2, hl - width * 0.25);
  const h = height + 0.45;
  const v = [
    [-hw, 0, -hl], [hw, 0, -hl], [hw, 0, hl], [-hw, 0, hl],
    [-tw, h, -tl], [tw, h, -tl], [tw, h, tl], [-tw, h, tl]
  ];
  const tris = [
    4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7
  ];
  const arr = new Float32Array(tris.length * 3);
  for (let i = 0; i < tris.length; i++) {
    const pt = v[tris[i]];
    arr[i * 3] = pt[0]; arr[i * 3 + 1] = pt[1]; arr[i * 3 + 2] = pt[2];
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  geo.computeVertexNormals();
  bake.add(geo, mat, mx, y, mz, 0, yaw, 0);
  geo.dispose();
  const ac = Math.abs(Math.cos(yaw));
  const as = Math.abs(Math.sin(yaw));
  addBoxCollider(mapGroup, mx, mz, hw * ac + hl * as, hw * as + hl * ac, y, y + h);
}

export function addAmmoPallets(bake, getHeight, x, z, yaw, mats) {
  const y = getHeight(x, z);
  const box = new THREE.BoxGeometry(1, 1, 1);
  const cyl = new THREE.CylinderGeometry(0.11, 0.11, 0.92, 6);
  addLocalPart(bake, box, mats.wood, x, y, z, yaw, -1.1, 0.08, 0, 0, 0, 0, 1.35, 0.16, 1.25);
  addLocalPart(bake, box, mats.wood, x, y, z, yaw, 1.1, 0.08, 0, 0, 0, 0, 1.35, 0.16, 1.25);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 4; c++) {
      addLocalPart(bake, cyl, mats.idfOlive, x, y, z, yaw, -1.45 + c * 0.24, 0.62, -0.3 + r * 0.28);
      addLocalPart(bake, cyl, mats.trackDark, x, y, z, yaw, 0.75 + c * 0.24, 0.56, -0.25 + r * 0.26, Math.PI / 2, 0, 0, 1.25, 0.95, 1.25);
    }
  }
  addLocalPart(bake, box, mats.wood, x, y, z, yaw, -1.1, 0.42, 0.48, 0, 0, 0, 1.1, 0.52, 0.35);
  box.dispose();
  cyl.dispose();
}

export function addAmmoDump(bake, mapGroup, getHeight, x, z, yaw, mats) {
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  addAmmoPallets(bake, getHeight, x - 2.1 * cy, z + 2.1 * sy, yaw, mats);
  addAmmoPallets(bake, getHeight, x + 2.1 * cy, z - 2.1 * sy, yaw, mats);
  addCamoCanopy(bake, getHeight, x, z, 8.2, 5.4, 3.2, yaw, mats);
  const y = getHeight(x, z);
  const box = new THREE.BoxGeometry(1, 1, 1);
  addLocalPart(bake, box, mats.sandbag, x, y, z, yaw, 0, 0.45, -2.9, 0, 0, 0, 8.2, 0.9, 0.75);
  addLocalPart(bake, box, mats.sandbag, x, y, z, yaw, -4.3, 0.45, 0, 0, 0, 0, 0.75, 0.9, 5.6);
  addLocalPart(bake, box, mats.sandbag, x, y, z, yaw, 4.3, 0.45, 0, 0, 0, 0, 0.75, 0.9, 5.6);
  box.dispose();
  addBoxCollider(mapGroup, x, z, 4.4, 3.1, y - 0.5, y + 3.0);
}

export function addCamoCanopy(bake, getHeight, x, z, w, d, h, yaw, mats) {
  const y = getHeight(x, z);
  const cyl = new THREE.CylinderGeometry(0.05, 0.05, h, 5);
  const plane = new THREE.PlaneGeometry(w, d, 3, 3);
  plane.rotateX(-Math.PI / 2);
  const pp = plane.attributes.position;
  for (let i = 0; i < pp.count; i++) {
    const px = pp.getX(i);
    const pz = pp.getZ(i);
    const edge = Math.max(Math.abs(px) / (w * 0.5), Math.abs(pz) / (d * 0.5));
    pp.setY(i, (edge - 1) * 0.32);
  }
  plane.computeVertexNormals();
  addLocalPart(bake, plane, mats.camoNet, x, y, z, yaw, 0, h, 0);
  const hw = w * 0.46;
  const hd = d * 0.46;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) addLocalPart(bake, cyl, mats.gunMetal, x, y, z, yaw, sx * hw, h * 0.5, sz * hd);
  }
  cyl.dispose();
  plane.dispose();
}

export function addFdcStation(bake, mapGroup, getHeight, x, z, yaw, mode, mats) {
  const y = getHeight(x, z);
  const box = new THREE.BoxGeometry(1, 1, 1);
  const cyl = new THREE.CylinderGeometry(0.03, 0.03, 4.2, 5);
  if (mode === 'container') {
    addLocalPart(bake, box, mats.concrete, x, y, z, yaw, 0, 0.1, 0, 0, 0, 0, 6.6, 0.25, 3.0);
    addLocalPart(bake, box, mats.containerWhite, x, y, z, yaw, 0, 1.5, 0, 0, 0, 0, 6.1, 2.55, 2.45);
    addLocalPart(bake, box, mats.gunMetal, x, y, z, yaw, 3.25, 1.9, 0, 0, 0, 0, 0.45, 0.7, 0.75);
    addLocalPart(bake, cyl, mats.gunMetal, x, y, z, yaw, -2.5, 4.2, -0.9);
    addLocalPart(bake, cyl, mats.gunMetal, x, y, z, yaw, -2.5, 4.2, 0.9);
    addBoxCollider(mapGroup, x, z, 3.3, 1.5, y - 0.5, y + 3.0);
  } else {
    addLocalPart(bake, box, mats.wood, x, y, z, yaw, 0, 0.08, 0, 0, 0, 0, 6.4, 0.18, 4.4);
    addLocalPart(bake, box, mats.canvas, x, y, z, yaw, 0, 1.15, 0, 0, 0, 0, 6.0, 2.1, 4.0);
    addLocalPart(bake, box, mats.canvas, x, y, z, yaw, 0, 2.45, -0.95, 0.42, 0, 0, 6.2, 0.12, 2.25);
    addLocalPart(bake, box, mats.canvas, x, y, z, yaw, 0, 2.45, 0.95, -0.42, 0, 0, 6.2, 0.12, 2.25);
    addLocalPart(bake, cyl, mats.gunMetal, x, y, z, yaw, 3.2, 4.1, 1.8);
    addBoxCollider(mapGroup, x, z, 3.2, 2.2, y - 0.5, y + 3.0);
  }
  box.dispose();
  cyl.dispose();
}

export function addCampCluster(bake, mapGroup, getHeight, x, z, yaw, mats) {
  const y = getHeight(x, z);
  const box = new THREE.BoxGeometry(1, 1, 1);
  const cyl = new THREE.CylinderGeometry(0.45, 0.5, 1.2, 6);
  const dome = new THREE.SphereGeometry(1.15, 7, 5, 0, Math.PI * 2, 0, Math.PI * 0.55);
  addLocalPart(bake, dome, mats.tentBlue, x, y, z, yaw, -2.2, 0, -1.6, 0, 0, 0, 1.1, 0.95, 1.15);
  addLocalPart(bake, dome, mats.tentOrange, x, y, z, yaw, 0.4, 0, -1.8, 0, 0.6, 0, 1.1, 0.95, 1.15);
  addLocalPart(bake, dome, mats.tentBlue, x, y, z, yaw, 2.8, 0, -1.4, 0, -0.4, 0, 1.05, 0.9, 1.1);
  addLocalPart(bake, box, mats.wood, x, y, z, yaw, 0, 0.65, 1.8, 0, 0, 0, 2.2, 0.14, 1.1);
  addLocalPart(bake, box, mats.wood, x, y, z, yaw, -0.8, 0.3, 1.8, 0, 0, 0, 0.14, 0.6, 0.9);
  addLocalPart(bake, box, mats.wood, x, y, z, yaw, 0.8, 0.3, 1.8, 0, 0, 0, 0.14, 0.6, 0.9);
  addLocalPart(bake, box, mats.orange, x, y, z, yaw, 4.6, 0.68, 1.5, 0, 0, 0, 1.8, 1.15, 1.05);
  addLocalPart(bake, box, mats.idfOlive, x, y, z, yaw, -4.4, 0.45, 1.6, 0, 0, 0, 1.4, 0.9, 1.0);
  addLocalPart(bake, cyl, mats.containerWhite, x, y, z, yaw, 4.6, 0.6, -1.6);
  box.dispose();
  cyl.dispose();
  dome.dispose();
  addBoxCollider(mapGroup, x, z, 5.2, 3.0, y - 0.5, y + 2.2);
}

export function addPerimeterSign(mapGroup, getHeight, x, z, yaw, textHe, mats) {
  const y = getHeight(x, z);
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#3c4033';
  ctx.fillRect(0, 0, 256, 128);
  ctx.strokeStyle = '#d4c89a';
  ctx.lineWidth = 6;
  ctx.strokeRect(8, 8, 240, 112);
  ctx.fillStyle = '#f2ead0';
  ctx.font = 'bold 28px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const lines = String(textHe).split('\n');
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], 128, lines.length === 1 ? 64 : 44 + i * 40);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const signMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 });
  const board = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.1, 0.12), signMat);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.9, 6), mats.wood);
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = yaw;
  post.position.y = 0.95;
  board.position.y = 1.65;
  g.add(post, board);
  mapGroup.add(g);
  addBoxCollider(mapGroup, x, z, 1.1, 0.4, y - 0.5, y + 2.4);
}
