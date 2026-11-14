import * as THREE from "three";

function segmentHitsBuilding(a, b, maxDist) {
  for (const bld of window.__game?.entities?.buildings || []) {
    if (!bld.alive) continue;
    const halfW = bld.width / 2;
    const halfD = bld.depth / 2;
    const minX = bld.position.x - halfW;
    const maxX = bld.position.x + halfW;
    const minZ = bld.position.z - halfD;
    const maxZ = bld.position.z + halfD;
    const steps = Math.max(2, Math.ceil(maxDist / 2));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const x = a.x + (b.x - a.x) * t;
      const y = a.y + (b.y - a.y) * t;
      const z = a.z + (b.z - a.z) * t;
      if (y <= bld.height && x >= minX && x <= maxX && z >= minZ && z <= maxZ) return true;
    }
  }
  return false;
}

function sphereBlocksSegment(a, b, sphere, radius, maxDist) {
  const ab = new THREE.Vector3().subVectors(b, a);
  const ap = new THREE.Vector3().subVectors(sphere, a);
  const abLen2 = Math.max(0.0001, ab.lengthSq());
  const t = Math.max(0, Math.min(1, ap.dot(ab) / abLen2));
  const closest = new THREE.Vector3().copy(a).addScaledVector(ab, t);
  return closest.distanceTo(sphere) < radius && t * ab.length() < maxDist;
}

export function computeImpactPoint(from, dir, maxDist = 400) {
  const to = from.clone().addScaledVector(dir, maxDist);
  let best = null;
  for (const enemy of window.__game?.entities?.enemies || []) {
    if (!enemy.alive) continue;
    const center = enemy.position;
    if (sphereBlocksSegment(from, to, center, enemy.radius, maxDist)) {
      const dist = from.distanceTo(center);
      if (!best || dist < best.distance) {
        best = { point: center.clone(), distance: dist, enemy };
      }
    }
  }
  for (const drone of window.__game?.entities?.drones || []) {
    if (!drone.alive) continue;
    const center = drone.position;
    if (sphereBlocksSegment(from, to, center, drone.radius, maxDist)) {
      const dist = from.distanceTo(center);
      if (!best || dist < best.distance) {
        best = { point: center.clone(), distance: dist, drone };
      }
    }
  }
  for (const bld of window.__game?.entities?.buildings || []) {
    if (!bld.alive) continue;
    const halfW = bld.width / 2;
    const halfD = bld.depth / 2;
    const minX = bld.position.x - halfW;
    const maxX = bld.position.x + halfW;
    const minZ = bld.position.z - halfD;
    const maxZ = bld.position.z + halfD;
    const steps = Math.max(2, Math.ceil(maxDist / 1.5));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const x = from.x + dir.x * maxDist * t;
      const y = from.y + dir.y * maxDist * t;
      const z = from.z + dir.z * maxDist * t;
      if (y <= bld.height && x >= minX && x <= maxX && z >= minZ && z <= maxZ) {
        const point = new THREE.Vector3(x, y, z);
        const dist = from.distanceTo(point);
        if (!best || dist < best.distance) {
          best = { point, distance: dist };
        }
        break;
      }
    }
  }
  if (best) return best;
  const terrainY = window.__game?.world?.getTerrainHeightAt?.(to.x, to.z) ?? 0;
  if (to.y <= terrainY) {
    const point = to.clone();
    point.y = Math.max(terrainY, 0);
    return { point, distance: from.distanceTo(point) };
  }
  return null;
}

export function hasGroundImpact(dir) {
  return dir.y < -0.03;
}

export function getTerrainHitDistance(from, dir) {
  const terrainY = window.__game?.world?.getTerrainHeightAt?.(from.x, from.z) ?? 0;
  const startHeight = from.y - terrainY;
  if (dir.y >= -0.0001 || startHeight <= 0) return 0;
  return startHeight / -dir.y;
}

export function hasClearLineOfSight(from, to) {
  const dir = new THREE.Vector3().subVectors(to, from);
  const dist = dir.length();
  if (dist > 0) dir.normalize();
  const maxRay = Math.min(dist, 200);
  const impact = computeImpactPoint(from, dir, maxRay);
  if (impact && impact.distance < dist - (window.__game?.entities?.getPlayerRadius?.() ?? 0.8)) return false;
  return !segmentHitsBuilding(from, to, dist);
}
