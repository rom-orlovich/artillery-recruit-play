import * as THREE from 'three';
import { TERRAIN_EXTENT, ROADS, GUNS, FOOTPRINTS, FEATURES, DESERT_EDGE_Z, GUN_BODY_OFFSET } from './world-layout.js';
import { createSeededRandom, loadWorldTexture } from './props/materials.js';

const SPLAT_SIZE = 1024;
const ROCK_PATCH_COUNT = 70;
const SHOULDER_EXTRA = 2.4;

const extentX = TERRAIN_EXTENT.maxX - TERRAIN_EXTENT.minX;
const extentZ = TERRAIN_EXTENT.maxZ - TERRAIN_EXTENT.minZ;

function worldToSplat(x, z) {
  return [((x - TERRAIN_EXTENT.minX) / extentX) * SPLAT_SIZE, ((z - TERRAIN_EXTENT.minZ) / extentZ) * SPLAT_SIZE];
}

const metersToPx = (m) => (m / extentX) * SPLAT_SIZE;

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

function strokePolyline(ctx, points, widthMeters, style) {
  ctx.strokeStyle = style;
  ctx.lineWidth = metersToPx(widthMeters);
  ctx.beginPath();
  points.forEach(([x, z], i) => {
    const [px, py] = worldToSplat(x, z);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.stroke();
}

function softBlob(ctx, x, z, radiusMeters, strength) {
  const [px, py] = worldToSplat(x, z);
  const r = metersToPx(radiusMeters);
  const gradient = ctx.createRadialGradient(px, py, 0, px, py, r);
  gradient.addColorStop(0, `rgba(255,255,255,${strength})`);
  gradient.addColorStop(0.55, `rgba(255,255,255,${strength * 0.75})`);
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(px, py, r, 0, Math.PI * 2);
  ctx.fill();
}

function fillRect(ctx, cx, cz, w, d, style) {
  const [x0, y0] = worldToSplat(cx - w / 2, cz - d / 2);
  ctx.fillStyle = style;
  ctx.fillRect(x0, y0, metersToPx(w), metersToPx(d));
}

function paintRuts(ctx, from, to, style) {
  const dx = to[0] - from[0];
  const dz = to[1] - from[1];
  const len = Math.hypot(dx, dz) || 1;
  const nx = -dz / len;
  const nz = dx / len;
  for (const side of [-1.4, 1.4]) {
    strokePolyline(ctx, [[from[0] + nx * side, from[1] + nz * side], [to[0] + nx * side, to[1] + nz * side]], 0.7, style);
  }
}

function paintChannels() {
  const asphalt = channelCanvas();
  const dirt = channelCanvas();
  const rock = channelCanvas();
  const gravel = channelCanvas();
  for (const road of ROADS) {
    if (road.kind === 'asphalt') {
      strokePolyline(gravel.ctx, road.points, road.width + SHOULDER_EXTRA, 'rgba(255,255,255,0.85)');
      strokePolyline(asphalt.ctx, road.points, road.width, '#fff');
    } else {
      strokePolyline(dirt.ctx, road.points, road.width + 1.6, 'rgba(255,255,255,0.55)');
      strokePolyline(dirt.ctx, road.points, road.width, 'rgba(255,255,255,0.95)');
    }
  }
  for (const gun of GUNS) {
    const [x, z] = gun.rear;
    softBlob(dirt.ctx, x, z + GUN_BODY_OFFSET, 13, 0.95);
    paintRuts(dirt.ctx, [x, z + 2], [x + 3, z + 26], 'rgba(255,255,255,0.7)');
  }
  for (const fp of FOOTPRINTS) {
    if (fp.kind === 'gravel') fillRect(gravel.ctx, fp.x, fp.z, fp.w, fp.d, '#fff');
    if (fp.region === 'line' && fp.kind !== 'pad') softBlob(dirt.ctx, fp.x, fp.z, Math.max(fp.w, fp.d) * 0.9 + 3, 0.6);
    if (fp.region !== 'line' && fp.kind === 'building') fillRect(gravel.ctx, fp.x, fp.z, fp.w + 4, fp.d + 4, 'rgba(255,255,255,0.55)');
  }
  softBlob(dirt.ctx, 4, -240, 34, 0.7);
  softBlob(dirt.ctx, -56, -262, 12, 0.9);
  softBlob(dirt.ctx, -22, -277, 11, 0.9);
  softBlob(dirt.ctx, 58, -286, 12, 0.9);
  softBlob(dirt.ctx, -54, -236, 6, 0.7);
  softBlob(dirt.ctx, 68, 0, 26, 0.55);
  softBlob(dirt.ctx, 0, -64, 30, 0.35);
  fillRect(gravel.ctx, -110, -179, 112, 66, 'rgba(255,255,255,0.45)');
  fillRect(gravel.ctx, 0, 0, 70, 70, 'rgba(255,255,255,0.3)');
  fillRect(gravel.ctx, 0, -392, 48, 40, 'rgba(255,255,255,0.6)');
  const random = createSeededRandom(404);
  for (let i = 0; i < ROCK_PATCH_COUNT; i++) {
    const x = TERRAIN_EXTENT.minX + random() * extentX;
    const z = TERRAIN_EXTENT.minZ + random() * (DESERT_EDGE_Z.end - TERRAIN_EXTENT.minZ);
    softBlob(rock.ctx, x, z, 4 + random() * 10, 0.55 + random() * 0.4);
  }
  for (const hill of FEATURES.hills) softBlob(rock.ctx, hill.x, hill.z, hill.radius * 0.7, hill.z < DESERT_EDGE_Z.end ? 0.75 : 0.35);
  for (const plateau of FEATURES.plateaus) softBlob(rock.ctx, plateau.x, plateau.z, plateau.radius + plateau.falloff, 0.6);
  for (const wadi of FEATURES.wadis) strokePolyline(gravel.ctx, wadi.points, wadi.halfWidth * 1.6, 'rgba(255,255,255,0.8)');
  softBlob(rock.ctx, 0, -392, 30, 0.4);
  return { asphalt, dirt, rock, gravel };
}

export function createSplat() {
  const channels = paintChannels();
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
  texture.needsUpdate = true;
  return { texture, data, size: SPLAT_SIZE };
}

const TERRAIN_UNIFORMS_GLSL = `
const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);
const vec3 GOLAN_GRASS_TINT = vec3(2.6, 2.5, 4.0);
const vec3 GOLAN_STRAW_TINT = vec3(0.86, 0.74, 0.52);
const float GOLAN_DESATURATION = 0.25;
const vec3 GOLAN_DIRT_TINT = vec3(3.4, 3.9, 3.65);
const vec3 GOLAN_GRAVEL_TINT = vec3(3.4, 2.6, 1.8);
const float GOLAN_ROCK_GAIN = 3.8;
const float ASPHALT_GAIN = 0.75;
const float ASPHALT_LIFT = 0.06;
uniform sampler2D tSplat;
uniform sampler2D tSand;
uniform sampler2D tGrass;
uniform sampler2D tStraw;
uniform sampler2D tDirt;
uniform sampler2D tRock;
uniform vec4 splatRect;
uniform vec2 desertEdge;
varying vec3 vTerrainPos;
varying vec3 vTerrainNormal;
`;

const TERRAIN_COLOR_GLSL = `
vec2 wp = vTerrainPos.xz;
vec4 sp = texture2D(tSplat, (wp - splatRect.xy) / splatRect.zw);
float patchN = 0.5 + 0.25 * sin(wp.x * 0.061 + sin(wp.y * 0.047) * 2.3) + 0.25 * sin(wp.y * 0.053 + sin(wp.x * 0.029) * 1.9);
float macro = 0.5 + 0.5 * sin(wp.x * 0.013 + 1.7 + sin(wp.y * 0.009) * 2.0) * sin(wp.y * 0.011 - 0.6);
vec3 sand = texture2D(tSand, wp * 0.15).rgb * mix(0.88, 1.08, macro);
vec3 grass = texture2D(tGrass, wp * 0.19).rgb * GOLAN_GRASS_TINT;
vec3 straw = texture2D(tStraw, wp * 0.17).rgb * GOLAN_STRAW_TINT;
vec3 golan = mix(grass, straw, smoothstep(0.3, 0.7, patchN)) * mix(0.8, 1.1, macro);
golan = mix(golan, vec3(dot(golan, LUMA)), GOLAN_DESATURATION);
vec3 dirt = texture2D(tDirt, wp * 0.2).rgb;
vec3 rockTex = texture2D(tRock, wp * 0.11).rgb;
float desert = smoothstep(desertEdge.y, desertEdge.x, wp.y);
float slope = 1.0 - clamp(vTerrainNormal.y, 0.0, 1.0);
vec3 groundCol = mix(golan, sand, desert);
groundCol = mix(groundCol, mix(dirt * GOLAN_DIRT_TINT, sand * vec3(0.84, 0.77, 0.66), desert), clamp(sp.g + smoothstep(0.12, 0.3, slope) * 0.6, 0.0, 1.0));
vec3 gravelCol = mix(vec3(dot(dirt, LUMA)) * GOLAN_GRAVEL_TINT, sand * vec3(0.95, 0.85, 0.7), desert);
groundCol = mix(groundCol, gravelCol, sp.a * 0.85);
float rockW = clamp(sp.b * 0.9 + smoothstep(0.22, 0.45, slope) * 0.7, 0.0, 1.0);
groundCol = mix(groundCol, mix(rockTex * GOLAN_ROCK_GAIN, rockTex * vec3(1.9, 1.75, 1.45), desert), rockW);
float elev = smoothstep(2.5, 13.0, vTerrainPos.y) * (1.0 - desert);
groundCol = mix(groundCol, mix(rockTex * GOLAN_ROCK_GAIN, golan * 0.85, 0.55), elev * 0.7);
vec3 asphaltCol = vec3(dot(rockTex, vec3(0.33))) * ASPHALT_GAIN + ASPHALT_LIFT;
groundCol = mix(groundCol, asphaltCol, sp.r);
diffuseColor.rgb *= groundCol;
`;

export function createTerrainMaterial(splatTexture) {
  const material = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const uniforms = {
    tSplat: { value: splatTexture },
    tSand: { value: loadWorldTexture('dense_sand') },
    tGrass: { value: loadWorldTexture('sparse_grass') },
    tStraw: { value: loadWorldTexture('withered_grass') },
    tDirt: { value: loadWorldTexture('road_damaged') },
    tRock: { value: loadWorldTexture('dark_rock_02') },
    splatRect: { value: new THREE.Vector4(TERRAIN_EXTENT.minX, TERRAIN_EXTENT.minZ, extentX, extentZ) },
    desertEdge: { value: new THREE.Vector2(DESERT_EDGE_Z.start, DESERT_EDGE_Z.end) }
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
  material.customProgramCacheKey = () => 'terrain-splat-v3';
  return material;
}
