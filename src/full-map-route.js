import { ROADS } from './world-layout.js';
import { MAP_EXTENT } from './map-image.js';

const ROAD_SNAP_DIST = 58;
const BRIDGE_DIST = 24;
const MAX_ROUTE_POINTS = 64;
const MAX_GRAPH_NODES = 256;

let roadGraph = null;
let cachedKey = '';
let cachedRoute = null;

function projectToSegment(px, pz, ax, az, bx, bz) {
  const dx = bx - ax;
  const dz = bz - az;
  const lenSq = dx * dx + dz * dz;
  if (lenSq <= 1e-6) return { t: 0, x: ax, z: az, d: Math.hypot(px - ax, pz - az) };
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / lenSq));
  const x = ax + dx * t;
  const z = az + dz * t;
  return { t, x, z, d: Math.hypot(px - x, pz - z) };
}

function buildRoadGraph() {
  if (roadGraph) return roadGraph;
  const nodes = [];
  const segs = [];
  const addNode = (x, z, roadIdx) => {
    const id = nodes.length;
    nodes.push({ id, x, z, roadIdx, adj: [] });
    return id;
  };
  const addEdge = (u, v) => {
    if (u === v) return;
    const w = Math.hypot(nodes[u].x - nodes[v].x, nodes[u].z - nodes[v].z);
    nodes[u].adj.push([v, w]);
    nodes[v].adj.push([u, w]);
  };
  const roadNodes = ROADS.map((road, rIdx) => road.points.map(([x, z]) => addNode(x, z, rIdx)));
  const segSplits = [];
  ROADS.forEach((_, rIdx) => {
    const ids = roadNodes[rIdx];
    for (let i = 0; i < ids.length - 1; i++) {
      segSplits.push({ rIdx, u: ids[i], v: ids[i + 1], splits: [] });
    }
  });
  const origCount = nodes.length;
  const bridges = [];
  for (let vi = 0; vi < origCount; vi++) {
    const v = nodes[vi];
    let best = null;
    for (const seg of segSplits) {
      if (seg.rIdx === v.roadIdx) continue;
      const a = nodes[seg.u];
      const b = nodes[seg.v];
      const pr = projectToSegment(v.x, v.z, a.x, a.z, b.x, b.z);
      if (pr.d <= BRIDGE_DIST && (!best || pr.d < best.pr.d)) best = { seg, pr };
    }
    if (best) {
      if (best.pr.t <= 0.04) addEdge(v.id, best.seg.u);
      else if (best.pr.t >= 0.96) addEdge(v.id, best.seg.v);
      else {
        const sid = addNode(best.pr.x, best.pr.z, best.seg.rIdx);
        best.seg.splits.push({ t: best.pr.t, id: sid });
        bridges.push([v.id, sid]);
      }
    }
  }
  for (const seg of segSplits) {
    seg.splits.sort((a, b) => a.t - b.t);
    const chain = [seg.u, ...seg.splits.map((s) => s.id), seg.v];
    for (let i = 0; i < chain.length - 1; i++) {
      addEdge(chain[i], chain[i + 1]);
      segs.push([chain[i], chain[i + 1]]);
    }
  }
  for (const [u, v] of bridges) addEdge(u, v);

  const comp = new Int32Array(nodes.length).fill(-1);
  let cid = 0;
  for (let i = 0; i < nodes.length; i++) {
    if (comp[i] !== -1) continue;
    const q = [i];
    comp[i] = cid;
    for (let qi = 0; qi < q.length; qi++) {
      for (const [nb] of nodes[q[qi]].adj) {
        if (comp[nb] === -1) {
          comp[nb] = cid;
          q.push(nb);
        }
      }
    }
    cid += 1;
  }
  roadGraph = { nodes, segs, comp, compCount: cid };
  return roadGraph;
}

function capRoutePoints(pts) {
  if (pts.length <= MAX_ROUTE_POINTS) return pts;
  const out = [pts[0]];
  const step = (pts.length - 1) / (MAX_ROUTE_POINTS - 1);
  for (let i = 1; i < MAX_ROUTE_POINTS - 1; i++) {
    out.push(pts[Math.round(i * step)]);
  }
  out.push(pts[pts.length - 1]);
  return out;
}

function shortestRoadPath(from, to) {
  const straight = Math.hypot(to.x - from.x, to.z - from.z);
  if (straight < 24) return [from, to];
  const g = buildRoadGraph();
  if (g.nodes.length > MAX_GRAPH_NODES) return [from, to];
  const nearA = new Array(g.compCount).fill(null);
  const nearB = new Array(g.compCount).fill(null);
  for (let sIdx = 0; sIdx < g.segs.length; sIdx++) {
    const [u, v] = g.segs[sIdx];
    const nu = g.nodes[u];
    const nv = g.nodes[v];
    const c = g.comp[u];
    const pa = projectToSegment(from.x, from.z, nu.x, nu.z, nv.x, nv.z);
    if (pa.d <= ROAD_SNAP_DIST && (!nearA[c] || pa.d < nearA[c].d)) nearA[c] = { u, v, sIdx, ...pa };
    const pb = projectToSegment(to.x, to.z, nu.x, nu.z, nv.x, nv.z);
    if (pb.d <= ROAD_SNAP_DIST && (!nearB[c] || pb.d < nearB[c].d)) nearB[c] = { u, v, sIdx, ...pb };
  }
  let bestPair = null;
  for (let c = 0; c < g.compCount; c++) {
    if (!nearA[c] || !nearB[c]) continue;
    const score = nearA[c].d + nearB[c].d;
    if (!bestPair || score < bestPair.score) bestPair = { a: nearA[c], b: nearB[c], score };
  }
  if (!bestPair || bestPair.score >= straight * 0.95) return [from, to];

  const { a, b } = bestPair;
  if (a.sIdx === b.sIdx) {
    const roadSeg = Math.hypot(b.x - a.x, b.z - a.z);
    if (a.d + roadSeg + b.d <= straight * 2.4) return [from, { x: a.x, z: a.z }, { x: b.x, z: b.z }, to];
    return [from, to];
  }

  const n = g.nodes.length;
  const START = n;
  const END = n + 1;
  const dist = new Float64Array(n + 2).fill(Infinity);
  const prev = new Int32Array(n + 2).fill(-1);
  const used = new Uint8Array(n + 2);
  dist[START] = 0;

  const startEdges = [
    [a.u, Math.hypot(a.x - g.nodes[a.u].x, a.z - g.nodes[a.u].z)],
    [a.v, Math.hypot(a.x - g.nodes[a.v].x, a.z - g.nodes[a.v].z)]
  ];
  const endEdges = [
    [b.u, Math.hypot(b.x - g.nodes[b.u].x, b.z - g.nodes[b.u].z)],
    [b.v, Math.hypot(b.x - g.nodes[b.v].x, b.z - g.nodes[b.v].z)]
  ];

  for (let step = 0; step < n + 2; step++) {
    let cur = -1;
    let bestD = Infinity;
    for (let i = 0; i < n + 2; i++) {
      if (!used[i] && dist[i] < bestD) {
        bestD = dist[i];
        cur = i;
      }
    }
    if (cur === -1 || cur === END) break;
    used[cur] = 1;
    const adj = cur === START ? startEdges : (cur < n ? g.nodes[cur].adj : []);
    for (const [nb, w] of adj) {
      if (dist[cur] + w < dist[nb]) {
        dist[nb] = dist[cur] + w;
        prev[nb] = cur;
      }
    }
    for (const [eNode, ew] of endEdges) {
      if (cur === eNode && dist[cur] + ew < dist[END]) {
        dist[END] = dist[cur] + ew;
        prev[END] = cur;
      }
    }
  }

  if (!Number.isFinite(dist[END]) || a.d + dist[END] + b.d > straight * 2.6) return [from, to];
  const chain = [];
  let hops = 0;
  for (let cur = prev[END]; cur !== -1 && cur !== START && hops < n + 2; cur = prev[cur]) {
    chain.push({ x: g.nodes[cur].x, z: g.nodes[cur].z });
    hops += 1;
  }
  chain.reverse();
  const raw = [from, { x: a.x, z: a.z }, ...chain, { x: b.x, z: b.z }, to];
  const deduped = raw.filter((pt, idx) => idx === 0 || Math.hypot(pt.x - raw[idx - 1].x, pt.z - raw[idx - 1].z) > 0.5);
  return capRoutePoints(deduped.length >= 2 ? deduped : [from, to]);
}

export function resetRouteCache() {
  cachedKey = '';
  cachedRoute = null;
}

export function getRouteForObjective(from, target) {
  if (!target) {
    resetRouteCache();
    return null;
  }
  const key = `${target.x.toFixed(2)},${target.z.toFixed(2)}`;
  if (cachedRoute && cachedKey === key) return cachedRoute;
  cachedKey = key;
  cachedRoute = shortestRoadPath({ x: from.x, z: from.z }, target);
  return cachedRoute;
}

export function computeFitRect(playerPos, target, route) {
  const pts = [playerPos];
  if (target) pts.push(target);
  if (route) for (const pt of route) pts.push(pt);
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const pt of pts) {
    if (pt.x < minX) minX = pt.x;
    if (pt.x > maxX) maxX = pt.x;
    if (pt.z < minZ) minZ = pt.z;
    if (pt.z > maxZ) maxZ = pt.z;
  }
  const pad = 40;
  minX -= pad;
  maxX += pad;
  minZ -= pad;
  maxZ += pad;
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;
  const halfW = Math.max((maxX - minX) / 2, 65);
  const halfH = Math.max((maxZ - minZ) / 2, 65);
  return {
    minX: Math.min(minX + pad - 12, Math.max(MAP_EXTENT.minX - 8, cx - halfW)),
    maxX: Math.max(maxX - pad + 12, Math.min(MAP_EXTENT.maxX + 8, cx + halfW)),
    minZ: Math.min(minZ + pad - 12, Math.max(MAP_EXTENT.minZ - 8, cz - halfH)),
    maxZ: Math.max(maxZ - pad + 12, Math.min(MAP_EXTENT.maxZ + 8, cz + halfH))
  };
}

export function drawRoute(ctx, route, toScreen, dpr) {
  if (!route || route.length < 2) return;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.setLineDash([8 * dpr, 6 * dpr]);
  const trace = () => {
    ctx.beginPath();
    route.forEach((pt, idx) => {
      const [sx, sy] = toScreen(pt.x, pt.z);
      if (idx === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    });
  };
  trace();
  ctx.strokeStyle = 'rgba(16, 12, 4, 0.82)';
  ctx.lineWidth = 5 * dpr;
  ctx.stroke();
  trace();
  ctx.strokeStyle = '#ffe05c';
  ctx.lineWidth = 2.6 * dpr;
  ctx.stroke();
  ctx.restore();
}
