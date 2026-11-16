import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { getMaterial } from './props/materials.js';
import { getTerrainHeight } from './world-terrain.js';

const ATLAS_WIDTH = 2048;
const ATLAS_HEIGHT = 2048;
const SLOT_WIDTH = 512;
const SLOT_HEIGHT = 128;
const SLOTS_PER_ROW = ATLAS_WIDTH / SLOT_WIDTH;
const PROXY_MATERIAL = new THREE.MeshBasicMaterial({ visible: false });
const PROXY_GEOMETRY = new THREE.BoxGeometry(1, 1, 1);
const PAINTABLE_TYPES = new Set(['MeshLambertMaterial', 'MeshStandardMaterial']);
PROXY_MATERIAL.userData.shared = true;
PROXY_GEOMETRY.userData.shared = true;

export const colliders = [];
export const worldShootables = [];
export const regionShootables = { shivta: [], yoav: [], line: [], zaura: [], beit_hillel: [], tzeelim: [] };
export const distanceCulled = [];

const atlasCanvas = document.createElement('canvas');
atlasCanvas.width = ATLAS_WIDTH;
atlasCanvas.height = ATLAS_HEIGHT;
const atlasContext = atlasCanvas.getContext('2d');
const atlasTexture = new THREE.CanvasTexture(atlasCanvas);
atlasTexture.colorSpace = THREE.SRGBColorSpace;
atlasTexture.anisotropy = 4;
atlasTexture.userData.shared = true;
const atlasMaterial = new THREE.MeshLambertMaterial({ map: atlasTexture });
atlasMaterial.userData.shared = true;
let nextSlot = 0;

function resolveMaterial(material) {
  if (typeof material !== 'string') return material;
  const resolved = getMaterial(material);
  if (resolved) resolved.userData.shared = true;
  return resolved;
}

function disposeMaterial(mat) {
  if (!mat || mat.userData?.shared) return;
  for (const val of Object.values(mat)) {
    if (val?.isTexture && !val.userData?.shared) val.dispose();
  }
  if (mat.uniforms) {
    for (const u of Object.values(mat.uniforms)) {
      if (u?.value?.isTexture && !u.value.userData?.shared) u.value.dispose();
    }
  }
  mat.dispose();
}

export function disposeMapGroup(group) {
  if (!group) return;
  group.traverse((obj) => {
    if (obj.geometry && !obj.geometry.userData?.shared) obj.geometry.dispose();
    if (Array.isArray(obj.material)) obj.material.forEach(disposeMaterial);
    else disposeMaterial(obj.material);
  });
  group.removeFromParent();
}

export function resetWorldKit() {
  colliders.length = 0;
  worldShootables.length = 0;
  for (const list of Object.values(regionShootables)) list.length = 0;
  distanceCulled.length = 0;
  nextSlot = 0;
  atlasContext.clearRect(0, 0, ATLAS_WIDTH, ATLAS_HEIGHT);
  atlasTexture.needsUpdate = true;
}

export const ground = (x, z) => getTerrainHeight(x, z);

export function addCollider(region, cx, cz, w, d, h = 3) {
  colliders.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2, region });
  const proxy = new THREE.Mesh(PROXY_GEOMETRY, PROXY_MATERIAL);
  proxy.scale.set(w, h, d);
  proxy.position.set(cx, ground(cx, cz) + h / 2, cz);
  proxy.updateMatrixWorld(true);
  proxy.name = 'shoot-proxy';
  (regionShootables[region] ??= []).push(proxy);
}

export function addSegmentCollider(region, from, to, thickness, h) {
  const cx = (from[0] + to[0]) / 2;
  const cz = (from[1] + to[1]) / 2;
  addCollider(region, cx, cz, Math.abs(to[0] - from[0]) + thickness, Math.abs(to[1] - from[1]) + thickness, h);
}

function applyWorldUV(geometry, scale) {
  const pos = geometry.attributes.position;
  const nor = geometry.attributes.normal;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const ax = Math.abs(nor.getX(i));
    const ay = Math.abs(nor.getY(i));
    const az = Math.abs(nor.getZ(i));
    const [u, v] = ay >= ax && ay >= az ? [pos.getX(i), pos.getZ(i)] : ax >= az ? [pos.getZ(i), pos.getY(i)] : [pos.getX(i), pos.getY(i)];
    uv[i * 2] = u / scale;
    uv[i * 2 + 1] = v / scale;
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

function normalizeGeometry(source, matrix, material, color) {
  const geometry = source.index ? source.toNonIndexed() : source.clone();
  for (const name of Object.keys(geometry.attributes)) {
    if (!['position', 'normal', 'uv'].includes(name)) geometry.deleteAttribute(name);
  }
  geometry.morphAttributes = {};
  if (!geometry.attributes.normal) geometry.computeVertexNormals();
  geometry.applyMatrix4(matrix);
  if (material.userData.worldUV) applyWorldUV(geometry, material.userData.worldUV);
  if (!geometry.attributes.uv) geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(geometry.attributes.position.count * 2), 2));
  if (material.vertexColors) {
    const tint = new THREE.Color(color ?? 0xffffff);
    const colors = new Float32Array(geometry.attributes.position.count * 3);
    for (let i = 0; i < colors.length; i += 3) {
      colors[i] = tint.r;
      colors[i + 1] = tint.g;
      colors[i + 2] = tint.b;
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  }
  return geometry;
}

const tmpMatrix = new THREE.Matrix4();
const tmpEuler = new THREE.Euler();
const tmpQuat = new THREE.Quaternion();
const tmpPos = new THREE.Vector3();
const tmpScale = new THREE.Vector3();

export function composeMatrix(x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  return new THREE.Matrix4().compose(tmpPos.set(x, y, z), tmpQuat.setFromEuler(tmpEuler.set(rx, ry, rz)), tmpScale.set(sx, sy, sz));
}

function paintColor(material) {
  if (!PAINTABLE_TYPES.has(material.type) || material.map || material.alphaTest || material.transparent || material.vertexColors) return null;
  if (material.side !== THREE.FrontSide) return null;
  return material.color.clone().add(material.emissive || new THREE.Color(0));
}

export function createBake() {
  const byMaterial = new Map();
  const paint = resolveMaterial('paint');
  const push = (material, geometry) => {
    if (!byMaterial.has(material)) byMaterial.set(material, []);
    byMaterial.get(material).push(geometry);
  };
  const bake = {
    add(material, geometry, matrix, color) {
      const resolved = resolveMaterial(material);
      const painted = paintColor(resolved);
      const target = painted ? paint : resolved;
      push(target, normalizeGeometry(geometry, matrix, target, painted || color));
    },
    mesh(material, geometry, x, y, z, ry = 0, color, rx = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
      bake.add(material, geometry, composeMatrix(x, y, z, rx, ry, rz, sx, sy, sz), color);
    },
    box(material, w, h, d, x, y, z, ry = 0, color, rx = 0, rz = 0) {
      bake.add(material, new THREE.BoxGeometry(w, h, d), composeMatrix(x, y, z, rx, ry, rz), color);
    },
    object(object3d, x, y, z, ry = 0, scale = 1) {
      object3d.updateMatrixWorld(true);
      const placement = composeMatrix(x, y, z, 0, ry, 0, scale, scale, scale);
      object3d.traverse((child) => {
        if (!child.isMesh || child.isInstancedMesh) return;
        const material = Array.isArray(child.material) ? child.material[0] : child.material;
        bake.add(material, child.geometry, tmpMatrix.multiplyMatrices(placement, child.matrixWorld));
      });
    },
    build(name, castShadow = true) {
      const group = new THREE.Group();
      group.name = name;
      for (const [material, geometries] of byMaterial) {
        const merged = mergeGeometries(geometries);
        if (!merged) continue;
        merged.computeBoundingSphere();
        const mesh = new THREE.Mesh(merged, material);
        mesh.name = `${name}-${material.type}`;
        mesh.castShadow = castShadow && !material.alphaTest;
        mesh.receiveShadow = true;
        group.add(mesh);
      }
      return group;
    }
  };
  return bake;
}

function drawSignSlot(slotX, slotY, text, style) {
  const ctx = atlasContext;
  ctx.save();
  ctx.translate(slotX, slotY);
  if (style.painted) {
    ctx.fillStyle = '#5b4330';
    ctx.fillRect(0, 0, SLOT_WIDTH, SLOT_HEIGHT);
    for (let plank = 0; plank < 3; plank++) {
      ctx.fillStyle = plank % 2 ? 'rgba(40,28,18,0.35)' : 'rgba(120,90,60,0.25)';
      ctx.fillRect(0, plank * 43, SLOT_WIDTH, 2 + plank);
    }
    ctx.fillStyle = 'rgba(235,230,215,0.5)';
    ctx.fillRect(18, 30, 10, 70);
    ctx.fillRect(30, 60, 6, 40);
  } else {
    ctx.fillStyle = style.bg || '#233321';
    ctx.fillRect(0, 0, SLOT_WIDTH, SLOT_HEIGHT);
    ctx.strokeStyle = style.border || '#d8dcc4';
    ctx.lineWidth = 6;
    ctx.strokeRect(5, 5, SLOT_WIDTH - 10, SLOT_HEIGHT - 10);
  }
  ctx.direction = 'rtl';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const lines = text.split('\n');
  const colors = style.colors || [style.fg || '#f5f2d8'];
  lines.forEach((line, i) => {
    const size = style.painted ? 50 : lines.length > 1 ? 40 : 46;
    ctx.font = style.painted ? `bold ${size}px "Comic Sans MS", Tahoma, Arial` : `bold ${size}px Tahoma, Arial, sans-serif`;
    ctx.fillStyle = colors[i % colors.length];
    ctx.fillText(line, SLOT_WIDTH / 2, SLOT_HEIGHT / 2 + (i - (lines.length - 1) / 2) * (size + 4), SLOT_WIDTH - 30);
  });
  ctx.restore();
}

export function addSign(bake, text, x, y, z, ry, w, h, style = {}) {
  const slot = nextSlot++;
  const slotX = (slot % SLOTS_PER_ROW) * SLOT_WIDTH;
  const slotY = Math.floor(slot / SLOTS_PER_ROW) * SLOT_HEIGHT;
  drawSignSlot(slotX, slotY, text, style);
  atlasTexture.needsUpdate = true;
  const u0 = slotX / ATLAS_WIDTH;
  const u1 = (slotX + SLOT_WIDTH) / ATLAS_WIDTH;
  const v1 = 1 - slotY / ATLAS_HEIGHT;
  const v0 = 1 - (slotY + SLOT_HEIGHT) / ATLAS_HEIGHT;
  const plane = new THREE.PlaneGeometry(w, h);
  const uv = plane.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) ? u1 : u0, uv.getY(i) ? v1 : v0);
  const offset = style.thickness ?? 0.03;
  for (const side of [0, Math.PI]) {
    bake.add(atlasMaterial, plane, composeMatrix(x + Math.sin(ry + side) * offset, y, z + Math.cos(ry + side) * offset, 0, ry + side, 0));
  }
}

export function createInstanced(geometry, material, transforms, colors) {
  const mesh = new THREE.InstancedMesh(geometry, resolveMaterial(material), transforms.length);
  const color = new THREE.Color();
  transforms.forEach((matrix, i) => {
    mesh.setMatrixAt(i, matrix);
    if (colors) mesh.setColorAt(i, color.set(colors[i]));
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingSphere();
  mesh.receiveShadow = true;
  return mesh;
}

export function cullBeyond(object, x, z, range) {
  distanceCulled.push({ object, x, z, range });
  return object;
}

export function createInstancedChunks(geometry, material, transforms, colors, chunkSize, range) {
  const buckets = new Map();
  transforms.forEach((matrix, i) => {
    const key = `${Math.floor(matrix.elements[12] / chunkSize)}:${Math.floor(matrix.elements[14] / chunkSize)}`;
    if (!buckets.has(key)) buckets.set(key, { transforms: [], colors: [] });
    buckets.get(key).transforms.push(matrix);
    buckets.get(key).colors.push(colors[i]);
  });
  const group = new THREE.Group();
  for (const [key, bucket] of buckets) {
    const [cx, cz] = key.split(':').map((v) => (Number(v) + 0.5) * chunkSize);
    group.add(cullBeyond(createInstanced(geometry, material, bucket.transforms, bucket.colors), cx, cz, range + chunkSize * 0.71));
  }
  return group;
}

export function addFenceRun(bake, region, from, to) {
  const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
  const ry = Math.atan2(to[0] - from[0], to[1] - from[1]) + Math.PI / 2;
  const panels = Math.max(1, Math.round(length / 3));
  for (let i = 0; i <= panels; i++) {
    const x = from[0] + ((to[0] - from[0]) * i) / panels;
    const z = from[1] + ((to[1] - from[1]) * i) / panels;
    bake.mesh('paint', new THREE.CylinderGeometry(0.04, 0.05, 2.6, 5), x, ground(x, z) + 1.3, z, 0, 0x8b8f91);
    if (i < panels) {
      const nx = from[0] + ((to[0] - from[0]) * (i + 0.5)) / panels;
      const nz = from[1] + ((to[1] - from[1]) * (i + 0.5)) / panels;
      bake.mesh('fenceMesh', new THREE.PlaneGeometry(length / panels, 2.3), nx, ground(nx, nz) + 1.2, nz, ry);
    }
  }
  addSegmentCollider(region, from, to, 0.5, 2.6);
}
