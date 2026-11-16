import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { composeMatrix } from './world-kit.js';

const SOLDIER_URL = './assets/models/soldier.glb';
export const POSE_CLIPS = { stand: 'idle', arms: 'work', sit: 'sit' };
const UNIFORM_COLOR = 0x5d6342;
const SKIN_COLOR = 0xc79c78;
const HELMET_COLOR = 0x4c5237;
const BOOT_COLOR = 0x2b2a26;
const WHITE = new THREE.Color(1, 1, 1);
const FAR_MAX_BOXES = 30;
const tmpVec = new THREE.Vector3();
const tmpBox = new THREE.Box3();
const tmpColor = new THREE.Color();
let soldierAssetsPromise = null;

function toFloat3Attr(attr) {
  if (attr.array instanceof Float32Array && attr.itemSize === 3) return attr;
  const out = new Float32Array(attr.count * 3);
  for (let i = 0; i < attr.count; i++) {
    out[i * 3] = attr.getX(i);
    out[i * 3 + 1] = attr.getY(i);
    out[i * 3 + 2] = attr.getZ(i);
  }
  return new THREE.BufferAttribute(out, 3);
}

function fillColorRange(colors, srcColor, start, end, c) {
  for (let i = start; i < end; i++) {
    colors[i * 3] = c.r * (srcColor ? srcColor.getX(i) : 1);
    colors[i * 3 + 1] = c.g * (srcColor ? srcColor.getY(i) : 1);
    colors[i * 3 + 2] = c.b * (srcColor ? srcColor.getZ(i) : 1);
  }
}

function bakeColors(g, material) {
  const srcColor = g.attributes.color;
  const count = g.attributes.position.count;
  const colors = new Float32Array(count * 3);
  if (Array.isArray(material) && g.groups.length) {
    for (const grp of g.groups) {
      const m = material[grp.materialIndex];
      fillColorRange(colors, srcColor, grp.start, Math.min(count, grp.start + grp.count), m?.color || WHITE);
    }
  } else {
    const m = Array.isArray(material) ? material[0] : material;
    fillColorRange(colors, srcColor, 0, count, m?.color || WHITE);
  }
  for (const attr of Object.keys(g.attributes)) if (attr !== 'position' && attr !== 'normal') g.deleteAttribute(attr);
  g.morphAttributes = {};
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

function pushColoredPart(parts, g, matrix, color) {
  g.applyMatrix4(matrix);
  if (!g.attributes.normal) g.computeVertexNormals();
  g.setAttribute('position', toFloat3Attr(g.attributes.position));
  g.setAttribute('normal', toFloat3Attr(g.attributes.normal));
  bakeColors(g, { color });
  parts.push(g);
}

function addBoxPart(parts, source, x, y, z, rx, hex) {
  const g = source.index ? source.toNonIndexed() : source.clone();
  source.dispose();
  pushColoredPart(parts, g, composeMatrix(x, y, z, rx, 0, 0), tmpColor.setHex(hex));
}

export function buildBoxSoldierGeometry(pose) {
  const crouch = pose === 'sit' ? 0.45 : 0;
  const parts = [];
  const addBox = (w, h, d, x, y, z, hex, rx = 0) => addBoxPart(parts, new THREE.BoxGeometry(w, h, d), x, y, z, rx, hex);
  for (const side of [-1, 1]) {
    addBox(0.17, 0.82 - crouch, 0.2, side * 0.11, (0.82 - crouch) / 2, pose === 'sit' ? 0.25 : 0, UNIFORM_COLOR);
    addBox(0.18, 0.12, 0.28, side * 0.11, 0.06, pose === 'sit' ? 0.3 : 0.04, BOOT_COLOR);
    addBox(0.13, 0.58, 0.14, side * 0.3, 1.18 - crouch, pose === 'arms' ? -0.18 : 0, UNIFORM_COLOR, pose === 'arms' ? 0.9 : 0.05);
  }
  addBox(0.46, 0.62, 0.28, 0, 1.18 - crouch, 0, UNIFORM_COLOR);
  addBox(0.5, 0.3, 0.32, 0, 1.3 - crouch, -0.02, 0x4a5236);
  addBoxPart(parts, new THREE.SphereGeometry(0.12, 8, 6), 0, 1.62 - crouch, 0, 0, SKIN_COLOR);
  addBoxPart(parts, new THREE.SphereGeometry(0.155, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), 0, 1.66 - crouch, 0, 0, HELMET_COLOR);
  const merged = mergeGeometries(parts, false);
  for (const p of parts) p.dispose();
  if (merged) merged.computeBoundingSphere();
  return merged;
}

function findClip(clips, name) {
  return clips.find((c) => c.name.toLowerCase() === name) || clips.find((c) => c.name.toLowerCase().includes(name)) || clips[0];
}

function poseSkinnedPositions(mesh) {
  const count = mesh.geometry.attributes.position.count;
  const out = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    mesh.getVertexPosition(i, tmpVec);
    tmpVec.applyMatrix4(mesh.matrixWorld);
    out[i * 3] = tmpVec.x;
    out[i * 3 + 1] = tmpVec.y;
    out[i * 3 + 2] = tmpVec.z;
  }
  return out;
}

function boundsFromPositions(arr) {
  tmpBox.makeEmpty();
  for (let i = 0; i < arr.length; i += 3) tmpBox.expandByPoint(tmpVec.set(arr[i], arr[i + 1], arr[i + 2]));
  return tmpBox;
}

function syncPose(template, soldierMesh, resetPose = false) {
  if (resetPose && soldierMesh?.skeleton) soldierMesh.skeleton.pose();
  template.updateMatrixWorld(true);
  if (soldierMesh?.skeleton) soldierMesh.skeleton.update();
}

function pushBoxCandidate(candidates, matrix, box, r, g, b, n, fixedVol = 0) {
  if (n < 3 || box.isEmpty()) return;
  const e = matrix.elements;
  const sx = Math.hypot(e[0], e[1], e[2]) || 1;
  const sy = Math.hypot(e[4], e[5], e[6]) || 1;
  const sz = Math.hypot(e[8], e[9], e[10]) || 1;
  const size = box.getSize(new THREE.Vector3());
  size.set(Math.max(size.x, 0.03 / sx), Math.max(size.y, 0.03 / sy), Math.max(size.z, 0.03 / sz));
  candidates.push({
    matrix, center: box.getCenter(new THREE.Vector3()), size,
    color: new THREE.Color(r / n, g / n, b / n),
    volume: fixedVol || size.x * sx * size.y * sy * size.z * sz
  });
}

function collectSkinnedFarBoxes(posAttr, colorAttr, skinIndex, skinWeight, child, candidates) {
  const bones = child.skeleton?.bones;
  if (!bones?.length || !skinIndex || !skinWeight) return;
  const boneMap = new Map(bones.map((b, i) => [b, i]));
  const count = posAttr.count;
  const vertBone = new Int16Array(count);
  const vertCounts = new Int32Array(bones.length);
  const worldBoxes = bones.map(() => new THREE.Box3());
  for (let i = 0; i < count; i++) {
    let bIdx = skinIndex.getX(i), maxW = skinWeight.getX(i);
    if (skinWeight.getY(i) > maxW) { maxW = skinWeight.getY(i); bIdx = skinIndex.getY(i); }
    if (skinWeight.getZ(i) > maxW) { maxW = skinWeight.getZ(i); bIdx = skinIndex.getZ(i); }
    if (skinWeight.getW(i) > maxW) bIdx = skinIndex.getW(i);
    vertBone[i] = bIdx;
    if (bIdx >= 0 && bIdx < bones.length) {
      vertCounts[bIdx]++;
      worldBoxes[bIdx].expandByPoint(tmpVec.set(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i)));
    }
  }
  const isTiny = bones.map((_, b) => worldBoxes[b].isEmpty() || vertCounts[b] < 6 || (worldBoxes[b].getSize(tmpVec), Math.max(tmpVec.x, tmpVec.y, tmpVec.z) < 0.11));
  const remap = bones.map((_, b) => {
    let cur = b;
    while (isTiny[cur] && bones[cur].parent && boneMap.has(bones[cur].parent)) {
      const p = boneMap.get(bones[cur].parent);
      if (p === cur) break;
      cur = p;
    }
    return cur;
  });
  const invMats = bones.map((b) => b.matrixWorld.clone().invert());
  const localBoxes = new Map();
  for (let i = 0; i < count; i++) {
    const rawB = vertBone[i];
    if (rawB < 0 || rawB >= bones.length) continue;
    const b = remap[rawB];
    let entry = localBoxes.get(b);
    if (!entry) localBoxes.set(b, entry = { box: new THREE.Box3(), r: 0, g: 0, bl: 0, n: 0 });
    tmpVec.set(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i)).applyMatrix4(invMats[b]);
    entry.box.expandByPoint(tmpVec);
    entry.r += colorAttr.getX(i); entry.g += colorAttr.getY(i); entry.bl += colorAttr.getZ(i); entry.n++;
  }
  for (const [b, e] of localBoxes.entries()) pushBoxCandidate(candidates, bones[b].matrixWorld, e.box, e.r, e.g, e.bl, e.n);
}

function bakePosedGeometry(template, mixer, soldierMesh, clip, pose) {
  if (soldierMesh?.skeleton) soldierMesh.skeleton.pose();
  mixer.stopAllAction();
  if (clip) { const action = mixer.clipAction(clip); action.reset(); action.play(); mixer.setTime(0); }
  syncPose(template, soldierMesh);
  const parts = [], candidates = [], farParts = [];
  template.traverse((child) => {
    if (!child.isMesh) return;
    let g = child.geometry.clone();
    if (child.isSkinnedMesh) {
      g.setAttribute('position', new THREE.BufferAttribute(poseSkinnedPositions(child), 3));
      g.computeVertexNormals();
      if (g.index) { const nonIdx = g.toNonIndexed(); g.dispose(); g = nonIdx; }
      const { skinIndex, skinWeight } = g.attributes;
      bakeColors(g, child.material);
      collectSkinnedFarBoxes(g.attributes.position, g.attributes.color, skinIndex, skinWeight, child, candidates);
    } else {
      if (g.index) { const nonIdx = g.toNonIndexed(); g.dispose(); g = nonIdx; }
      g.applyMatrix4(child.matrixWorld);
      if (!g.attributes.normal) g.computeVertexNormals();
      bakeColors(g, child.material);
      child.geometry.computeBoundingBox();
      const cAttr = g.attributes.color;
      let r = 0, gr = 0, bl = 0;
      for (let i = 0; i < cAttr.count; i++) { r += cAttr.getX(i); gr += cAttr.getY(i); bl += cAttr.getZ(i); }
      if (child.geometry.boundingBox) pushBoxCandidate(candidates, child.matrixWorld, child.geometry.boundingBox, r, gr, bl, cAttr.count, Infinity);
    }
    parts.push(g);
  });
  candidates.sort((a, b) => b.volume - a.volume);
  if (candidates.length > FAR_MAX_BOXES) candidates.length = FAR_MAX_BOXES;
  for (const c of candidates) {
    const bg = new THREE.BoxGeometry(c.size.x, c.size.y, c.size.z);
    bg.translate(c.center.x, c.center.y, c.center.z);
    const nonIdx = bg.toNonIndexed();
    bg.dispose();
    pushColoredPart(farParts, nonIdx, c.matrix, c.color);
  }
  const near = parts.length ? mergeGeometries(parts, false) : null;
  for (const p of parts) p.dispose();
  if (near) { near.computeBoundingSphere(); near.userData.shared = true; }
  const far = farParts.length ? mergeGeometries(farParts, false) : buildBoxSoldierGeometry(pose);
  for (const p of farParts) p.dispose();
  if (far) { far.computeBoundingSphere(); far.userData.shared = true; }
  return { near, far };
}

function buildSoldierAssets(gltf) {
  const root = gltf.scene;
  let soldierMesh = null, m16Mesh = root.getObjectByName('M16');
  root.traverse((c) => {
    if (!soldierMesh && c.isSkinnedMesh) soldierMesh = c;
    if (!m16Mesh && c.isMesh && !c.isSkinnedMesh) m16Mesh = c;
    if (c.isMesh && c.geometry) c.geometry.userData.shared = true;
  });
  const modelBox = new THREE.Group();
  modelBox.add(root);
  const template = new THREE.Group();
  template.add(modelBox);
  const mixer = new THREE.AnimationMixer(template);
  const clips = {};
  for (const [pose, clipName] of Object.entries(POSE_CLIPS)) clips[pose] = findClip(gltf.animations, clipName);
  syncPose(template, soldierMesh, true);
  let yawOffset = Math.PI;
  if (soldierMesh && m16Mesh) {
    const center = boundsFromPositions(poseSkinnedPositions(soldierMesh)).getCenter(new THREE.Vector3());
    if (m16Mesh.parent?.isBone) {
      m16Mesh.parent.getWorldPosition(tmpVec);
      if (Math.abs(tmpVec.x - center.x) > 0.05) yawOffset = tmpVec.x < center.x ? Math.PI : 0;
    } else {
      yawOffset = new THREE.Box3().setFromObject(m16Mesh).getCenter(new THREE.Vector3()).z >= center.z ? Math.PI : 0;
    }
  }
  if (clips.stand) { const a = mixer.clipAction(clips.stand); a.reset(); a.play(); mixer.setTime(0); }
  syncPose(template, soldierMesh);
  let scale = 1, minY = 0;
  if (soldierMesh) {
    const b = boundsFromPositions(poseSkinnedPositions(soldierMesh));
    const h = b.max.y - b.min.y;
    if (h > 2.2 || h < 1.3) scale = 1.8 / (h || 1.8);
    minY = b.min.y * scale;
  }
  modelBox.scale.setScalar(scale);
  modelBox.rotation.y = yawOffset;
  modelBox.position.set(0, -minY, 0);
  const poseGeometries = {}, farPoseGeometries = {};
  for (const pose of Object.keys(POSE_CLIPS)) {
    const baked = bakePosedGeometry(template, mixer, soldierMesh, clips[pose], pose);
    poseGeometries[pose] = baked.near;
    farPoseGeometries[pose] = baked.far;
  }
  mixer.stopAllAction();
  mixer.uncacheRoot(template);
  if (soldierMesh?.skeleton) soldierMesh.skeleton.pose();
  return { template, clips, poseGeometries, farPoseGeometries };
}

export function loadSoldierAssets() {
  if (!soldierAssetsPromise) {
    soldierAssetsPromise = new Promise((resolve) => {
      new GLTFLoader().load(SOLDIER_URL, (gltf) => resolve(buildSoldierAssets(gltf)), undefined, () => resolve(null));
    });
  }
  return soldierAssetsPromise;
}
