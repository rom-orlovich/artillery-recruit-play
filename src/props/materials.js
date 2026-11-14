import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const QUILT_TEXTURE_SIZE = 256;
const QUILT_DIAMOND_PITCH = 64;
const QUILT_STITCH_WIDTH = 0.035;
const WOOD_TEXTURE_WIDTH = 256;
const WOOD_TEXTURE_HEIGHT = 64;
const RACK_TEXTURE_WIDTH = 16;
const RACK_TEXTURE_HEIGHT = 512;
const RACK_HOLE_COUNT = 30;
const MAT_TEXTURE_SIZE = 256;
const MAT_FLECK_COUNT = 2600;
const UP = new THREE.Vector3(0, 1, 0);

const materialCache = new Map();

export function createSeededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

function createCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function toTexture(canvas, repeatWrap = true) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  if (repeatWrap) texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

function createQuiltTexture() {
  const canvas = createCanvas(QUILT_TEXTURE_SIZE, QUILT_TEXTURE_SIZE);
  const context = canvas.getContext('2d');
  const image = context.createImageData(QUILT_TEXTURE_SIZE, QUILT_TEXTURE_SIZE);
  const random = createSeededRandom(11);
  for (let y = 0; y < QUILT_TEXTURE_SIZE; y++) {
    for (let x = 0; x < QUILT_TEXTURE_SIZE; x++) {
      const rising = ((x + y) / QUILT_DIAMOND_PITCH) % 1;
      const falling = ((x - y + QUILT_TEXTURE_SIZE) / QUILT_DIAMOND_PITCH) % 1;
      const edgeDistance = Math.min(rising, 1 - rising, falling, 1 - falling);
      const puff = Math.sqrt(Math.min(edgeDistance * 2.2, 1));
      const lightSide = 0.025 * (rising - 0.5) - 0.02 * (falling - 0.5);
      let shade = 0.9 + 0.1 * puff + lightSide + (random() - 0.5) * 0.02;
      if (edgeDistance < QUILT_STITCH_WIDTH) shade *= 0.9;
      const offset = (y * QUILT_TEXTURE_SIZE + x) * 4;
      image.data[offset] = Math.min(255, 250 * shade);
      image.data[offset + 1] = Math.min(255, 250 * shade);
      image.data[offset + 2] = Math.min(255, 246 * shade);
      image.data[offset + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
  return toTexture(canvas);
}

function createWoodTexture() {
  const canvas = createCanvas(WOOD_TEXTURE_WIDTH, WOOD_TEXTURE_HEIGHT);
  const context = canvas.getContext('2d');
  const random = createSeededRandom(23);
  context.fillStyle = '#d4bc93';
  context.fillRect(0, 0, WOOD_TEXTURE_WIDTH, WOOD_TEXTURE_HEIGHT);
  for (let line = 0; line < 46; line++) {
    const baseY = random() * WOOD_TEXTURE_HEIGHT;
    const waveSize = 1 + random() * 3;
    context.strokeStyle = `rgba(${110 + random() * 40}, ${84 + random() * 30}, 52, ${0.05 + random() * 0.14})`;
    context.lineWidth = 0.6 + random() * 1.6;
    context.beginPath();
    for (let x = 0; x <= WOOD_TEXTURE_WIDTH; x += 8) {
      context.lineTo(x, baseY + Math.sin(x * 0.03 + line) * waveSize);
    }
    context.stroke();
  }
  for (let knot = 0; knot < 3; knot++) {
    context.fillStyle = 'rgba(110, 82, 50, 0.35)';
    context.beginPath();
    context.ellipse(random() * WOOD_TEXTURE_WIDTH, random() * WOOD_TEXTURE_HEIGHT, 5, 2.5, 0, 0, Math.PI * 2);
    context.fill();
  }
  return toTexture(canvas);
}

function createRackHoleTexture() {
  const canvas = createCanvas(RACK_TEXTURE_WIDTH, RACK_TEXTURE_HEIGHT);
  const context = canvas.getContext('2d');
  context.fillStyle = '#1f2022';
  context.fillRect(0, 0, RACK_TEXTURE_WIDTH, RACK_TEXTURE_HEIGHT);
  const holeSpacing = (RACK_TEXTURE_HEIGHT * 0.84) / RACK_HOLE_COUNT;
  for (let hole = 0; hole < RACK_HOLE_COUNT; hole++) {
    const centerY = RACK_TEXTURE_HEIGHT * 0.06 + (hole + 0.5) * holeSpacing;
    context.fillStyle = '#7d7f82';
    context.beginPath();
    context.arc(RACK_TEXTURE_WIDTH / 2, centerY, 3.2, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#0c0c0d';
    context.beginPath();
    context.arc(RACK_TEXTURE_WIDTH / 2 + 0.8, centerY + 0.8, 2.4, 0, Math.PI * 2);
    context.fill();
  }
  return toTexture(canvas, false);
}

function createRubberMatTexture() {
  const canvas = createCanvas(MAT_TEXTURE_SIZE, MAT_TEXTURE_SIZE);
  const context = canvas.getContext('2d');
  const random = createSeededRandom(37);
  context.fillStyle = '#2a2a2b';
  context.fillRect(0, 0, MAT_TEXTURE_SIZE, MAT_TEXTURE_SIZE);
  for (let fleck = 0; fleck < MAT_FLECK_COUNT; fleck++) {
    const brightness = 70 + random() * 70;
    context.fillStyle = `rgb(${brightness}, ${brightness}, ${brightness})`;
    context.fillRect(random() * MAT_TEXTURE_SIZE, random() * MAT_TEXTURE_SIZE, 1.2, 1.2);
  }
  return toTexture(canvas);
}

function lambert(color, options = {}) {
  return new THREE.MeshLambertMaterial({ color, ...options });
}

function standard(color, roughness, metalness, options = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness, ...options });
}

const TEXTURE_ROOT = './assets/textures/';
const textureCache = new Map();

export function loadWorldTexture(name) {
  if (!textureCache.has(name)) {
    const texture = new THREE.TextureLoader().load(`${TEXTURE_ROOT}${name}_1k.jpg`);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.minFilter = THREE.LinearMipmapNearestFilter;
    textureCache.set(name, texture);
  }
  return textureCache.get(name);
}

function textured(color, textureName, uvScale) {
  const material = lambert(color, { map: loadWorldTexture(textureName) });
  material.userData.worldUV = uvScale;
  return material;
}

function createAlphaCanvasTexture(size, draw) {
  const canvas = createCanvas(size, size);
  draw(canvas.getContext('2d'), size, createSeededRandom(size));
  return toTexture(canvas);
}

function drawGrassTuft(context, size, random) {
  for (let blade = 0; blade < 46; blade++) {
    const baseX = size * (0.18 + random() * 0.64);
    const lean = (random() - 0.5) * size * 0.5;
    const height = size * (0.45 + random() * 0.55);
    const shade = 150 + random() * 90;
    context.strokeStyle = `rgb(${shade}, ${shade * 0.86}, ${shade * 0.52})`;
    context.lineWidth = 1.2 + random() * 1.8;
    context.beginPath();
    context.moveTo(baseX, size);
    context.quadraticCurveTo(baseX + lean * 0.3, size - height * 0.6, baseX + lean, size - height);
    context.stroke();
  }
}

function drawCamoNet(context, size, random) {
  const colors = ['#5d5b3e', '#6f6a47', '#4a4a33', '#7c7452'];
  for (let leaf = 0; leaf < 900; leaf++) {
    context.fillStyle = colors[Math.floor(random() * colors.length)];
    context.save();
    context.translate(random() * size, random() * size);
    context.rotate(random() * Math.PI);
    context.fillRect(-5, -2.5, 9 + random() * 7, 4 + random() * 4);
    context.restore();
  }
}

function drawPlaster(context, size, random) {
  context.fillStyle = '#f4f1ea';
  context.fillRect(0, 0, size, size);
  for (let i = 0; i < 2600; i++) {
    const v = 214 + random() * 40;
    context.fillStyle = `rgba(${v}, ${v - 3}, ${v - 10}, 0.45)`;
    context.fillRect(random() * size, random() * size, 1 + random() * 3, 1 + random() * 3);
  }
  for (let i = 0; i < 16; i++) {
    const gradient = context.createLinearGradient(0, 0, 0, size);
    gradient.addColorStop(0, 'rgba(120, 104, 80, 0.12)');
    gradient.addColorStop(1, 'rgba(120, 104, 80, 0)');
    context.fillStyle = gradient;
    context.fillRect(random() * size, 0, 2 + random() * 7, size * (0.25 + random() * 0.6));
  }
}

function plastered(color, uvScale) {
  const material = lambert(color, { map: createAlphaCanvasTexture(256, drawPlaster) });
  material.userData.worldUV = uvScale;
  return material;
}

function drawChainLink(context, size) {
  context.strokeStyle = 'rgba(190, 194, 196, 0.95)';
  context.lineWidth = 1.4;
  for (let offset = -size; offset < size * 2; offset += 10) {
    context.beginPath();
    context.moveTo(offset, 0);
    context.lineTo(offset + size, size);
    context.moveTo(offset, size);
    context.lineTo(offset + size, 0);
    context.stroke();
  }
}

function alphaLambert(draw, size, options = {}) {
  const material = lambert(0xffffff, { map: createAlphaCanvasTexture(size, draw), alphaTest: 0.45, side: THREE.DoubleSide, ...options });
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n\tnormal = normalize( vNormal );');
  };
  return material;
}

const MATERIAL_FACTORIES = {
  tentCanvas: () => lambert(0xffffff, { map: createQuiltTexture(), side: THREE.DoubleSide, emissive: 0x403e3a }),
  tentTrim: () => lambert(0xeae8e1, { side: THREE.DoubleSide, emissive: 0x282826 }),
  tentFloor: () => lambert(0x6f6350),
  cotFrame: () => lambert(0x35382b),
  sleepingBag: () => lambert(0x585b3c),
  whitePlastic: () => lambert(0xecebe5),
  cardboard: () => lambert(0x9a7b54),
  bulbGlow: () => new THREE.MeshBasicMaterial({ color: 0xffe2a8, toneMapped: false }),
  blackSteel: () => standard(0x1c1d1f, 0.5, 0.3),
  shellOlive: () => standard(0x63683d, 0.55, 0.05),
  shellYellow: () => standard(0xe3b822, 0.5, 0.05),
  copperBand: () => standard(0xc8804a, 0.4, 0.3),
  fuzeGray: () => standard(0xa6aaae, 0.42, 0.3),
  crateOlive: () => lambert(0x5a6534),
  crateHardware: () => standard(0x4a542e, 0.6, 0.2),
  palletWood: () => lambert(0xffffff, { map: createWoodTexture() }),
  rackSteel: () => standard(0xffffff, 0.5, 0.3, { map: createRackHoleTexture() }),
  rubber: () => lambert(0x161617),
  chrome: () => standard(0xdfe2e5, 0.25, 0.6),
  rubberMat: () => lambert(0xffffff, { map: createRubberMatTexture() }),
  tarpWhite: () => standard(0xe6e2d6, 0.65, 0, { flatShading: true }),
  tarpBlack: () => standard(0x2a2b2e, 0.42, 0, { flatShading: true, side: THREE.DoubleSide }),
  stucco: () => plastered(0xf3e9d6, 3),
  concrete: () => plastered(0xc4c2bc, 2.2),
  basaltWall: () => textured(0xb8b2ac, 'dark_rock_02', 2.4),
  oliveMetal: () => textured(0xc4bc8a, 'green_metal_rust', 2.6),
  asphaltSlab: () => textured(0x8b95ae, 'dense_sand', 2.5),
  earth: () => textured(0xb6a083, 'road_damaged', 3),
  paint: () => lambert(0xffffff, { vertexColors: true }),
  glass: () => standard(0x24323b, 0.18, 0.55),
  foliage: () => lambert(0xffffff, { vertexColors: true, flatShading: true }),
  rock: () => textured(0x8c8a88, 'dark_rock_02', 1),
  grassTuft: () => alphaLambert(drawGrassTuft, 128),
  camoNet: () => alphaLambert(drawCamoNet, 256),
  fenceMesh: () => alphaLambert(drawChainLink, 64, { alphaTest: 0.3 }),
};

export function getMaterial(name) {
  if (!materialCache.has(name)) {
    const material = MATERIAL_FACTORIES[name]();
    material.name = name;
    materialCache.set(name, material);
  }
  return materialCache.get(name);
}

export function placeGeometry(geometry, position = [0, 0, 0], rotation = [0, 0, 0], scale = [1, 1, 1]) {
  const transform = new THREE.Matrix4().compose(
    new THREE.Vector3(...position),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),
    new THREE.Vector3(...scale),
  );
  const placed = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  return placed.applyMatrix4(transform);
}

export function mergeBoxes(boxes) {
  return mergeGeometries(
    boxes.map(({ size, position, rotation }) => placeGeometry(new THREE.BoxGeometry(...size), position, rotation)),
  );
}

export function createSegmentGeometry(from, to, radius, sides = 4) {
  const direction = new THREE.Vector3().subVectors(to, from);
  const segment = new THREE.CylinderGeometry(radius, radius, direction.length(), sides, 1, true);
  segment.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, direction.clone().normalize()));
  const middle = new THREE.Vector3().addVectors(from, to).multiplyScalar(0.5);
  return segment.translate(middle.x, middle.y, middle.z);
}

export function createMeshBatch() {
  const geometriesByMaterial = new Map();

  function add(materialName, geometry, position, rotation, scale) {
    if (!geometriesByMaterial.has(materialName)) geometriesByMaterial.set(materialName, []);
    geometriesByMaterial.get(materialName).push(placeGeometry(geometry, position, rotation, scale));
  }

  function addBox(materialName, size, position, rotation) {
    add(materialName, new THREE.BoxGeometry(...size), position, rotation);
  }

  function toGroup(name) {
    const group = new THREE.Group();
    group.name = name;
    for (const [materialName, geometries] of geometriesByMaterial) {
      const mesh = new THREE.Mesh(mergeGeometries(geometries), getMaterial(materialName));
      mesh.name = `${name}-${materialName}`;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
    return group;
  }

  return { add, addBox, toGroup };
}
