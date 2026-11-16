import * as THREE from 'three';
import { MAP_BIOMES } from './maps/map-biomes.js';
import * as layout from './world-layout.js';
import { createSeededRandom, loadWorldTexture } from './props/materials.js';
import { getActiveTerrainMap } from './world-terrain.js';

const SPLAT_SIZE = 256;
const ROCK_PATCH_COUNT = 36;
const SHOULDER_EXTRA = 2.4;
const LEGACY_ROAD_MAPS = new Set(['shivta', 'yoav', 'line']);

let lastSplatMapId = null;

function resolveGroundMapId(mapId, splatTexture) {
  if (typeof mapId === 'string' && MAP_BIOMES[mapId]) return mapId;
  const texMapId = splatTexture?.userData?.mapId;
  if (typeof texMapId === 'string' && MAP_BIOMES[texMapId]) return texMapId;
  const active = getActiveTerrainMap();
  if (MAP_BIOMES[active]) return active;
  if (lastSplatMapId && MAP_BIOMES[lastSplatMapId]) return lastSplatMapId;
  return 'shivta';
}

function makeProjector(bounds) {
  const [minX, maxX, minZ, maxZ] = bounds;
  const extentX = Math.max(1, maxX - minX);
  const extentZ = Math.max(1, maxZ - minZ);
  return {
    toPx: (x, z) => [((x - minX) / extentX) * SPLAT_SIZE, ((z - minZ) / extentZ) * SPLAT_SIZE],
    m2px: (m) => (m / extentX) * SPLAT_SIZE
  };
}

function channelCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = SPLAT_SIZE;
  canvas.height = SPLAT_SIZE;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, SPLAT_SIZE, SPLAT_SIZE);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  return { canvas, ctx };
}

function strokePolyline(ctx, proj, points, widthMeters, style) {
  ctx.strokeStyle = style;
  ctx.lineWidth = Math.max(1, proj.m2px(widthMeters));
  ctx.beginPath();
  points.forEach(([x, z], i) => {
    const [px, py] = proj.toPx(x, z);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.stroke();
}

function softBlob(ctx, proj, x, z, radiusMeters, strength) {
  const [px, py] = proj.toPx(x, z);
  const r = Math.max(1, proj.m2px(radiusMeters));
  const gradient = ctx.createRadialGradient(px, py, 0, px, py, r);
  gradient.addColorStop(0, `rgba(255,255,255,${strength})`);
  gradient.addColorStop(0.55, `rgba(255,255,255,${strength * 0.75})`);
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(px, py, r, 0, Math.PI * 2);
  ctx.fill();
}

function fillRect(ctx, proj, cx, cz, w, d, style) {
  const [x0, y0] = proj.toPx(cx - w / 2, cz - d / 2);
  ctx.fillStyle = style;
  ctx.fillRect(x0, y0, proj.m2px(w), proj.m2px(d));
}

function paintRuts(ctx, proj, from, to, style) {
  const dx = to[0] - from[0];
  const dz = to[1] - from[1];
  const len = Math.hypot(dx, dz) || 1;
  const nx = -dz / len;
  const nz = dx / len;
  for (const side of [-1.4, 1.4]) {
    strokePolyline(ctx, proj, [[from[0] + nx * side, from[1] + nz * side], [to[0] + nx * side, to[1] + nz * side]], 0.7, style);
  }
}

function inBounds(bounds, x, z, pad = 20) {
  return x >= bounds[0] - pad && x <= bounds[1] + pad && z >= bounds[2] - pad && z <= bounds[3] + pad;
}

function paintBiomeExtras(mapId, proj, ch) {
  if (mapId === 'zaura') {
    strokePolyline(ch.gravel.ctx, proj, [[-95, 48], [85, 48]], 7.5, 'rgba(255,255,255,0.85)');
    strokePolyline(ch.asphalt.ctx, proj, [[-95, 48], [85, 48]], 5, '#fff');
    strokePolyline(ch.dirt.ctx, proj, [[-68, -4], [64, -4]], 4.5, 'rgba(255,255,255,0.9)');
    softBlob(ch.rock.ctx, proj, 65, -70, 26, 0.7);
  } else if (mapId === 'beit_hillel') {
    strokePolyline(ch.asphalt.ctx, proj, [[-95, 76], [-45, 62]], 5, '#fff');
    strokePolyline(ch.gravel.ctx, proj, [[-68, 0], [66, 0]], 5, 'rgba(255,255,255,0.9)');
    fillRect(ch.gravel.ctx, proj, -8, 22, 46, 20, 'rgba(255,255,255,0.75)');
    softBlob(ch.rock.ctx, proj, -96, 0, 18, 0.6);
  }
}

function paintChannels(mapId, bounds, guns) {
  const proj = makeProjector(bounds);
  const ch = { asphalt: channelCanvas(), dirt: channelCanvas(), rock: channelCanvas(), gravel: channelCanvas() };
  if (LEGACY_ROAD_MAPS.has(mapId)) {
    for (const road of layout.ROADS || []) {
      if (!road.points?.some(([x, z]) => inBounds(bounds, x, z, 30))) continue;
      if (road.kind === 'asphalt') {
        strokePolyline(ch.gravel.ctx, proj, road.points, road.width + SHOULDER_EXTRA, 'rgba(255,255,255,0.85)');
        strokePolyline(ch.asphalt.ctx, proj, road.points, road.width, '#fff');
      } else {
        strokePolyline(ch.dirt.ctx, proj, road.points, road.width + 1.6, 'rgba(255,255,255,0.6)');
        strokePolyline(ch.dirt.ctx, proj, road.points, road.width, 'rgba(255,255,255,0.95)');
      }
    }
  }
  for (const gun of guns) {
    const gx = gun.x ?? gun.pos?.[0] ?? gun.rear?.[0] ?? 0;
    const gz = gun.z ?? gun.pos?.[1] ?? gun.rear?.[1] ?? 0;
    const yaw = gun.yaw ?? 0;
    const fx = -Math.sin(yaw);
    const fz = -Math.cos(yaw);
    softBlob(ch.dirt.ctx, proj, gx, gz, 9.5, 0.92);
    softBlob(ch.gravel.ctx, proj, gx - fx * 9, gz - fz * 9, 4.5, 0.75);
    paintRuts(ch.dirt.ctx, proj, [gx - fx * 2, gz - fz * 2], [gx - fx * 18, gz - fz * 18], 'rgba(255,255,255,0.75)');
  }
  for (const fp of layout.FOOTPRINTS || []) {
    if (fp.region && fp.region !== mapId) continue;
    if (!inBounds(bounds, fp.x, fp.z, 10)) continue;
    if (fp.kind === 'gravel') fillRect(ch.gravel.ctx, proj, fp.x, fp.z, fp.w, fp.d, '#fff');
    else if (fp.kind === 'building') fillRect(ch.gravel.ctx, proj, fp.x, fp.z, fp.w + 4, fp.d + 4, 'rgba(255,255,255,0.55)');
    else softBlob(ch.dirt.ctx, proj, fp.x, fp.z, Math.max(fp.w, fp.d) * 0.7 + 2, 0.55);
  }
  paintBiomeExtras(mapId, proj, ch);
  const random = createSeededRandom(404 + mapId.length * 37);
  const w = bounds[1] - bounds[0];
  const d = bounds[3] - bounds[2];
  for (let i = 0; i < ROCK_PATCH_COUNT; i++) {
    const rx = bounds[0] + random() * w;
    const rz = bounds[2] + random() * d;
    if (Math.hypot(rx, rz - 38) < 22) continue;
    if (Math.hypot(rx + 54, rz + 240) < 22) continue;
    softBlob(ch.rock.ctx, proj, rx, rz, 4 + random() * 9, 0.45 + random() * 0.35);
  }
  return ch;
}

export function createSplat(mapId, guns = []) {
  let rawMapId = mapId;
  let rawGuns = guns;
  if (Array.isArray(mapId)) {
    rawGuns = mapId;
    rawMapId = undefined;
  }
  const resolvedId = resolveGroundMapId(rawMapId);
  lastSplatMapId = resolvedId;
  const gunList = Array.isArray(rawGuns) && rawGuns.length ? rawGuns : (layout.MAP_DEFS?.[resolvedId]?.guns || []);
  const biome = MAP_BIOMES[resolvedId] || MAP_BIOMES.shivta;
  const bounds = biome.bounds;
  const channels = paintChannels(resolvedId, bounds, gunList);
  const read = (c) => c.ctx.getImageData(0, 0, SPLAT_SIZE, SPLAT_SIZE).data;
  const r = read(channels.asphalt);
  const g = read(channels.dirt);
  const b = read(channels.rock);
  const a = read(channels.gravel);
  const data = new Uint8Array(SPLAT_SIZE * SPLAT_SIZE * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = r[i];
    data[i + 1] = g[i];
    data[i + 2] = b[i];
    data[i + 3] = a[i];
  }
  const texture = new THREE.DataTexture(data, SPLAT_SIZE, SPLAT_SIZE, THREE.RGBAFormat);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.userData.mapId = resolvedId;
  texture.needsUpdate = true;
  return { texture, data, size: SPLAT_SIZE, bounds };
}

const TERRAIN_UNIFORMS_GLSL = `
const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);
uniform sampler2D tSplat;
uniform sampler2D tSand;
uniform sampler2D tGrass;
uniform sampler2D tStraw;
uniform sampler2D tDirt;
uniform sampler2D tRock;
uniform vec4 splatRect;
uniform vec3 uDry;
uniform vec3 uGrass;
uniform vec3 uDirt;
uniform vec3 uRock;
uniform vec3 uRoad;
uniform vec3 uConcrete;
varying vec3 vTerrainPos;
varying vec3 vTerrainNormal;
`;

const TERRAIN_COLOR_GLSL = `
vec2 wp = vTerrainPos.xz;
vec4 sp = texture2D(tSplat, (wp - splatRect.xy) / splatRect.zw);
float patchN = 0.5 + 0.25 * sin(wp.x * 0.061 + sin(wp.y * 0.047) * 2.3) + 0.25 * sin(wp.y * 0.053 + sin(wp.x * 0.029) * 1.9);
float macro = 0.5 + 0.5 * sin(wp.x * 0.013 + 1.7 + sin(wp.y * 0.009) * 2.0) * sin(wp.y * 0.011 - 0.6);
float dStraw = clamp(0.76 + 0.45 * dot(texture2D(tStraw, wp * 0.17).rgb, LUMA), 0.76, 1.22);
float dGrass = clamp(0.76 + 0.70 * dot(texture2D(tGrass, wp * 0.19).rgb, LUMA), 0.76, 1.22);
float dDirt = clamp(0.74 + 0.85 * dot(texture2D(tDirt, wp * 0.20).rgb, LUMA), 0.74, 1.22);
float dRock = clamp(0.72 + 0.90 * dot(texture2D(tRock, wp * 0.11).rgb, LUMA), 0.72, 1.22);
float dSand = clamp(0.78 + 0.40 * dot(texture2D(tSand, wp * 0.15).rgb, LUMA), 0.78, 1.22);
vec3 baseCol = mix(uGrass * dGrass, uDry * dStraw * dSand, smoothstep(0.25, 0.75, patchN)) * mix(0.88, 1.12, macro);
float slope = 1.0 - clamp(vTerrainNormal.y, 0.0, 1.0);
float dirtW = clamp(sp.g + smoothstep(0.14, 0.34, slope) * 0.65, 0.0, 1.0);
vec3 groundCol = mix(baseCol, uDirt * dDirt, dirtW);
vec3 gravelCol = mix(uConcrete, uDirt, 0.35) * dDirt;
groundCol = mix(groundCol, gravelCol, sp.a * 0.85);
float rockW = clamp(sp.b * 0.85 + smoothstep(0.28, 0.5, slope) * 0.75, 0.0, 1.0);
groundCol = mix(groundCol, uRock * dRock, rockW);
groundCol = mix(groundCol, uRoad * dDirt, sp.r);
diffuseColor.rgb *= groundCol;
`;

export function createTerrainMaterial(splatTexture, mapId) {
  const tex = splatTexture?.isTexture ? splatTexture : (splatTexture?.texture || splatTexture);
  const resolvedId = resolveGroundMapId(mapId, tex);
  const biome = MAP_BIOMES[resolvedId] || MAP_BIOMES.shivta;
  const [minX, maxX, minZ, maxZ] = biome.bounds;
  const p = biome.palette;
  const material = new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true });
  const uniforms = {
    tSplat: { value: tex },
    tSand: { value: loadWorldTexture('dense_sand') },
    tGrass: { value: loadWorldTexture('sparse_grass') },
    tStraw: { value: loadWorldTexture('withered_grass') },
    tDirt: { value: loadWorldTexture('road_damaged') },
    tRock: { value: loadWorldTexture('dark_rock_02') },
    splatRect: { value: new THREE.Vector4(minX, minZ, maxX - minX, maxZ - minZ) },
    uDry: { value: new THREE.Color(p.dry) },
    uGrass: { value: new THREE.Color(p.grass) },
    uDirt: { value: new THREE.Color(p.dirt) },
    uRock: { value: new THREE.Color(p.rock) },
    uRoad: { value: new THREE.Color(p.road) },
    uConcrete: { value: new THREE.Color(p.concrete) }
  };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vTerrainPos;\nvarying vec3 vTerrainNormal;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTerrainPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvTerrainNormal = normalize(mat3(modelMatrix) * objectNormal);');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${TERRAIN_UNIFORMS_GLSL}`)
      .replace('#include <map_fragment>', TERRAIN_COLOR_GLSL);
  };
  material.customProgramCacheKey = () => `terrain-splat-v4-${resolvedId}`;
  return material;
}
