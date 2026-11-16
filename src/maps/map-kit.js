import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { getTerrainHeight } from '../world.js';
import * as worldKit from '../world-kit.js';

const KIT_ROUGHNESS = 0.92;
const KIT_METALNESS = 0.04;
const DEFAULT_SCALE = 1;
const DEFAULT_ROT_Y = 0;
const RGB_STRIDE = 3;
const UINT16_MAX = 65535;
const UINT8_MAX = 255;
const UP_AXIS = new THREE.Vector3(0, 1, 0);
const KEEP_ATTRIBUTES = new Set(['position', 'normal', 'color']);

const kitPromiseCache = new Map();
let latestKitReadyPromise = Promise.resolve();

function loadKitScene(glbUrl) {
  if (kitPromiseCache.has(glbUrl)) {
    return kitPromiseCache.get(glbUrl);
  }
  const loader = new GLTFLoader();
  const loadPromise = new Promise((resolve) => {
    loader.load(
      glbUrl,
      (gltf) => resolve(gltf?.scene || null),
      undefined,
      () => resolve(null)
    );
  });
  kitPromiseCache.set(glbUrl, loadPromise);
  return loadPromise;
}

function ensureRgbColorAttribute(geometry) {
  const positionAttr = geometry.attributes.position;
  const vertexCount = positionAttr.count;
  const existingColor = geometry.attributes.color;
  const rgbValues = new Float32Array(vertexCount * RGB_STRIDE);
  if (!existingColor) {
    rgbValues.fill(1);
    geometry.setAttribute('color', new THREE.BufferAttribute(rgbValues, RGB_STRIDE));
    return;
  }
  if (existingColor.array instanceof Float32Array && existingColor.itemSize === RGB_STRIDE) {
    return;
  }
  let divisor = 1;
  if (existingColor.normalized) {
    if (existingColor.array instanceof Uint16Array) {
      divisor = UINT16_MAX;
    } else if (existingColor.array instanceof Uint8Array) {
      divisor = UINT8_MAX;
    }
  }
  const stride = existingColor.itemSize;
  const sourceArray = existingColor.array;
  for (let i = 0; i < vertexCount; i++) {
    const srcOffset = i * stride;
    const dstOffset = i * RGB_STRIDE;
    rgbValues[dstOffset] = sourceArray[srcOffset] / divisor;
    rgbValues[dstOffset + 1] = sourceArray[srcOffset + 1] / divisor;
    rgbValues[dstOffset + 2] = sourceArray[srcOffset + 2] / divisor;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(rgbValues, RGB_STRIDE));
}

function preparePieceGeometry(sourceNode, posX, posY, posZ, rotY, scaleFactor) {
  const clonedGeometry = sourceNode.geometry.clone();
  clonedGeometry.clearGroups();
  const attrNames = Object.keys(clonedGeometry.attributes);
  for (let i = 0; i < attrNames.length; i++) {
    const attrName = attrNames[i];
    if (!KEEP_ATTRIBUTES.has(attrName)) {
      clonedGeometry.deleteAttribute(attrName);
    }
  }
  const placementMatrix = new THREE.Matrix4();
  const positionVec = new THREE.Vector3(posX, posY, posZ);
  const rotationQuat = new THREE.Quaternion().setFromAxisAngle(UP_AXIS, rotY);
  const scaleVec = new THREE.Vector3(scaleFactor, scaleFactor, scaleFactor);
  placementMatrix.compose(positionVec, rotationQuat, scaleVec);
  placementMatrix.multiply(sourceNode.matrixWorld);
  clonedGeometry.applyMatrix4(placementMatrix);
  if (!clonedGeometry.attributes.normal) {
    clonedGeometry.computeVertexNormals();
  }
  ensureRgbColorAttribute(clonedGeometry);
  return clonedGeometry;
}

function normalizeGeometryIndexing(geometries) {
  if (geometries.length < 2) {
    return geometries;
  }
  const firstIndexed = Boolean(geometries[0].index);
  let hasMismatch = false;
  for (let i = 1; i < geometries.length; i++) {
    if (Boolean(geometries[i].index) !== firstIndexed) {
      hasMismatch = true;
      break;
    }
  }
  if (!hasMismatch) {
    return geometries;
  }
  const unifiedList = [];
  for (let i = 0; i < geometries.length; i++) {
    const currentGeo = geometries[i];
    if (currentGeo.index) {
      const nonIndexedGeo = currentGeo.toNonIndexed();
      currentGeo.dispose();
      unifiedList.push(nonIndexedGeo);
    } else {
      unifiedList.push(currentGeo);
    }
  }
  return unifiedList;
}

function stripKitColliders(list) {
  if (!Array.isArray(list)) {
    return;
  }
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i]?.kitPlacementId != null) {
      list.splice(i, 1);
    }
  }
}

function removeKitColliders(mapGroup) {
  stripKitColliders(mapGroup.userData?.colliders);
  stripKitColliders(worldKit.kit?.colliders);
}

function buildMergedKitMesh(mapGroup, mapId, gltfScene, placements) {
  gltfScene.updateMatrixWorld(true);
  const geometries = [];
  const counts = {};
  const points = [];
  for (let i = 0; i < placements.length; i++) {
    const placement = placements[i];
    const pieceName = placement.piece;
    const sourceNode = gltfScene.getObjectByName(pieceName);
    if (!sourceNode || !sourceNode.isMesh || !sourceNode.geometry) {
      continue;
    }
    const posX = placement.x;
    const posZ = placement.z;
    const posY = getTerrainHeight(posX, posZ);
    const rotY = placement.ry ?? DEFAULT_ROT_Y;
    const scaleFactor = placement.scale ?? DEFAULT_SCALE;
    const placementId = placement.id ?? `${pieceName}@${posX.toFixed(1)},${posZ.toFixed(1)}`;
    geometries.push(preparePieceGeometry(sourceNode, posX, posY, posZ, rotY, scaleFactor));
    counts[pieceName] = (counts[pieceName] || 0) + 1;
    points.push({ id: placementId, piece: pieceName, x: posX, y: posY, z: posZ, ry: rotY, scale: scaleFactor });
  }
  mapGroup.userData.kitPlacements = counts;
  mapGroup.userData.kitPlacementPoints = points;
  const normalizedGeometries = normalizeGeometryIndexing(geometries);
  if (normalizedGeometries.length === 0) {
    return false;
  }
  const mergedGeometry = mergeGeometries(normalizedGeometries, false);
  for (let i = 0; i < normalizedGeometries.length; i++) {
    normalizedGeometries[i].dispose();
  }
  if (!mergedGeometry) {
    return false;
  }
  if ((mergedGeometry.attributes?.position?.count ?? 0) <= 0) {
    mergedGeometry.dispose();
    return false;
  }
  mergedGeometry.computeBoundingSphere();
  const kitMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: KIT_ROUGHNESS,
    metalness: KIT_METALNESS
  });
  const kitMesh = new THREE.Mesh(mergedGeometry, kitMaterial);
  kitMesh.castShadow = true;
  kitMesh.receiveShadow = true;
  kitMesh.name = `${mapId}-kit`;
  mapGroup.add(kitMesh);
  return true;
}

export function placeMapKit(mapGroup, mapId, placements) {
  mapGroup.userData.kitPlacements = {};
  mapGroup.userData.kitPlacementPoints = [];
  const glbUrl = `./assets/models/${mapId}_kit.glb`;
  const readyPromise = loadKitScene(glbUrl).then((gltfScene) => {
    if (!mapGroup.parent) {
      return;
    }
    if (!gltfScene || !buildMergedKitMesh(mapGroup, mapId, gltfScene, placements || [])) {
      removeKitColliders(mapGroup);
    }
  });
  latestKitReadyPromise = readyPromise;
  return readyPromise;
}

export function whenMapKitReady() {
  return latestKitReadyPromise;
}
