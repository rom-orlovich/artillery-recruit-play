import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const DOHER_URL = './assets/models/doher.glb';
const DOHER_HULL_LENGTH = 6.2;
const DOHER_TOTAL_LENGTH = 9.1;
const WHITE = new THREE.Color(1, 1, 1);

export const doherMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.1 });
let doherTemplatePromise = null;

function findPart(root, name) {
  const exact = root.getObjectByName(name);
  if (exact) return exact;
  let match = null;
  const target = name.toLowerCase();
  root.traverse((c) => { if (!match && c.name && c.name.toLowerCase().startsWith(target)) match = c; });
  return match;
}

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

export function collectPivotGeometry(pivot, exclude) {
  pivot.updateMatrixWorld(true);
  const invPivot = new THREE.Matrix4().copy(pivot.matrixWorld).invert();
  const relMatrix = new THREE.Matrix4();
  const geometries = [];
  const visit = (node) => {
    if (node !== pivot && exclude.has(node)) return;
    if (node.isMesh) {
      const mat = Array.isArray(node.material) ? node.material[0] : node.material;
      const matColor = mat && mat.color ? mat.color : WHITE;
      const g = node.geometry.index ? node.geometry.toNonIndexed() : node.geometry.clone();
      const srcColor = g.attributes.color;
      g.setAttribute('position', toFloat3Attr(g.attributes.position));
      if (g.attributes.normal) g.setAttribute('normal', toFloat3Attr(g.attributes.normal));
      g.applyMatrix4(relMatrix.multiplyMatrices(invPivot, node.matrixWorld));
      if (!g.attributes.normal) g.computeVertexNormals();
      const count = g.attributes.position.count;
      const colors = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        colors[i * 3] = matColor.r * (srcColor ? srcColor.getX(i) : 1);
        colors[i * 3 + 1] = matColor.g * (srcColor ? srcColor.getY(i) : 1);
        colors[i * 3 + 2] = matColor.b * (srcColor ? srcColor.getZ(i) : 1);
      }
      for (const attr of Object.keys(g.attributes)) if (attr !== 'position' && attr !== 'normal') g.deleteAttribute(attr);
      g.morphAttributes = {};
      g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      geometries.push(g);
    }
    for (const child of node.children) visit(child);
  };
  visit(pivot);
  for (const child of [...pivot.children]) {
    if (!exclude.has(child)) {
      pivot.remove(child);
      child.traverse((c) => { if (c.isMesh) c.geometry.dispose(); });
    }
  }
  if (!geometries.length) return null;
  const merged = mergeGeometries(geometries, false);
  for (const g of geometries) g.dispose();
  if (merged) merged.computeBoundingSphere();
  return merged;
}

function buildDoherTemplate(gltf) {
  const root = gltf.scene;
  root.updateMatrixWorld(true);
  const turretSrc = findPart(root, 'turret');
  const barrelSrc = findPart(root, 'barrel');
  const hullSrc = findPart(root, 'hull');
  const tracksSrc = findPart(root, 'tracks');
  const chassisBox = new THREE.Box3();
  if (hullSrc) chassisBox.expandByObject(hullSrc);
  if (tracksSrc) chassisBox.expandByObject(tracksSrc);
  if (chassisBox.isEmpty()) chassisBox.setFromObject(root);
  const fullBox = new THREE.Box3().setFromObject(root);
  const chassisSize = chassisBox.getSize(new THREE.Vector3());
  const fullSize = fullBox.getSize(new THREE.Vector3());
  const chassisCenter = chassisBox.getCenter(new THREE.Vector3());
  const barrelCenter = barrelSrc ? new THREE.Box3().setFromObject(barrelSrc).getCenter(new THREE.Vector3()) : fullBox.getCenter(new THREE.Vector3());
  const alongZ = chassisSize.z >= chassisSize.x;
  const hullLength = alongZ ? chassisSize.z : chassisSize.x;
  const totalLength = alongZ ? fullSize.z : fullSize.x;
  const scale = hullLength > 0 ? DOHER_HULL_LENGTH / hullLength : DOHER_TOTAL_LENGTH / (totalLength || 1);
  const yawOffset = alongZ ? (barrelCenter.z > chassisCenter.z ? Math.PI : 0) : (barrelCenter.x > chassisCenter.x ? Math.PI / 2 : -Math.PI / 2);
  const templateRoot = new THREE.Group();
  templateRoot.name = 'doher-model';
  const modelRoot = new THREE.Group();
  modelRoot.add(root);
  modelRoot.rotation.y = yawOffset;
  modelRoot.scale.setScalar(scale);
  templateRoot.add(modelRoot);
  templateRoot.updateMatrixWorld(true);
  const scaledChassis = new THREE.Box3();
  if (hullSrc) scaledChassis.expandByObject(hullSrc);
  if (tracksSrc) scaledChassis.expandByObject(tracksSrc);
  if (scaledChassis.isEmpty()) scaledChassis.setFromObject(modelRoot);
  const scaledFull = new THREE.Box3().setFromObject(modelRoot);
  const center = scaledChassis.getCenter(new THREE.Vector3());
  modelRoot.position.set(-center.x, -scaledFull.min.y, -center.z);
  templateRoot.updateMatrixWorld(true);
  const turretPivot = new THREE.Group();
  turretPivot.name = 'doher-turret';
  const barrelPivot = new THREE.Group();
  barrelPivot.name = 'doher-barrel';
  if (turretSrc) {
    const turretPos = new THREE.Vector3();
    turretSrc.getWorldPosition(turretPos);
    turretPivot.position.copy(turretPos);
    templateRoot.add(turretPivot);
    if (barrelSrc) {
      const barrelPos = new THREE.Vector3();
      barrelSrc.getWorldPosition(barrelPos);
      barrelPivot.position.copy(barrelPos).sub(turretPos);
      turretPivot.add(barrelPivot);
      templateRoot.updateMatrixWorld(true);
      barrelPivot.attach(barrelSrc);
    }
    templateRoot.updateMatrixWorld(true);
    turretPivot.attach(turretSrc);
  } else if (barrelSrc) {
    const barrelPos = new THREE.Vector3();
    barrelSrc.getWorldPosition(barrelPos);
    barrelPivot.position.copy(barrelPos);
    templateRoot.add(barrelPivot);
    templateRoot.updateMatrixWorld(true);
    barrelPivot.attach(barrelSrc);
  }
  const addMerged = (pivot, exclude, name, castShadow) => {
    const geometry = collectPivotGeometry(pivot, exclude);
    if (!geometry) return;
    const mesh = new THREE.Mesh(geometry, doherMaterial);
    mesh.name = name;
    mesh.castShadow = castShadow;
    mesh.receiveShadow = true;
    pivot.add(mesh);
  };
  if (barrelSrc) addMerged(barrelPivot, new Set(), 'doher-barrel-mesh', false);
  if (turretSrc) addMerged(turretPivot, new Set([barrelPivot]), 'doher-turret-mesh', false);
  addMerged(templateRoot, new Set([turretPivot, barrelPivot]), 'doher-hull-mesh', true);
  return templateRoot;
}

export function loadDoherTemplate() {
  if (!doherTemplatePromise) {
    doherTemplatePromise = new Promise((resolve) => {
      new GLTFLoader().load(DOHER_URL, (gltf) => resolve(buildDoherTemplate(gltf)), undefined, () => resolve(null));
    });
  }
  return doherTemplatePromise;
}
