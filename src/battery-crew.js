import { getNpcs } from './npc.js';
import { getCurrentMapId } from './world.js';
import { MAP_NPC_ROSTERS } from './npc-rosters.js';

const BASE_NPC_SPEED = 2.7;
const TRUST_BASELINE = 50;
const TRUST_SPEED_SPAN = 35;
const TRUST_SPEED_BONUS = 0.8;
const HIGH_TRUST_THRESHOLD = 60;
const MID_TRUST_THRESHOLD = 40;
const NIGHT_COT_ASSIST_RATE = 14;
const TRUST_SUPPORT_DELTA = 10;
const STOVE_TRUST_BONUS = 3;
const GENERATOR_REPAIR_RADIUS_M = 3;

const GREETING_HIGH = 'בוקר טוב המפקד! הצוות מוכן ודרוך.';
const GREETING_MID = 'כן המפקד, תן פקודה.';
const GREETING_LOW = 'מה עכשיו?';

const npcPrevStamina = new Map();

export function resetCrewStaminaTracker() {
  npcPrevStamina.clear();
}

export function getNpcOrderSpeed(npc) {
  const trust = npc?.trust ?? TRUST_BASELINE;
  const bonus = Math.max(0, (trust - TRUST_BASELINE) / TRUST_SPEED_SPAN) * TRUST_SPEED_BONUS;
  return BASE_NPC_SPEED + bonus;
}

export function applyTrustDelta(npc, delta = TRUST_SUPPORT_DELTA) {
  if (!npc) return TRUST_BASELINE;
  npc.trust = Math.max(0, Math.min(100, (npc.trust ?? TRUST_BASELINE) + delta));
  return npc.trust;
}

export function getTrustGreetingPrefix(npc) {
  const trust = npc?.trust ?? TRUST_BASELINE;
  if (trust >= HIGH_TRUST_THRESHOLD) return GREETING_HIGH;
  if (trust >= MID_TRUST_THRESHOLD) return GREETING_MID;
  return GREETING_LOW;
}

export function boostEnlistedTrustFromMeal() {
  const npcs = getNpcs();
  if (!npcs) return;
  for (let i = 0; i < npcs.length; i += 1) {
    if (npcs[i] && !npcs[i].isOfficer) {
      npcs[i].trust = Math.min(100, (npcs[i].trust ?? TRUST_BASELINE) + STOVE_TRUST_BONUS);
    }
  }
}

export function scanCrewState(dt, activeCrisis, onGeneratorFix) {
  let hasSentry = false;
  let repaired = false;
  const npcs = getNpcs();
  if (!npcs) return false;
  const genPos = activeCrisis === 'event_generator_out' ? MAP_NPC_ROSTERS[getCurrentMapId()]?.generatorPos : null;
  const repairRadiusSq = GENERATOR_REPAIR_RADIUS_M * GENERATOR_REPAIR_RADIUS_M;
  for (let i = 0; i < npcs.length; i += 1) {
    const n = npcs[i];
    if (!n) continue;
    if (n.task === 'guard') hasSentry = true;
    if (n.task === 'sleep_cot' && (n.stamina ?? 100) < 100) {
      const prev = npcPrevStamina.get(n.id);
      if (typeof prev === 'number' && n.stamina > prev) {
        n.stamina = Math.min(100, n.stamina + NIGHT_COT_ASSIST_RATE * dt);
      }
      npcPrevStamina.set(n.id, n.stamina);
    } else {
      npcPrevStamina.set(n.id, n.stamina ?? 100);
    }
    if (!repaired && genPos && n.pos && n.task === 'goto' && onGeneratorFix) {
      const dx = n.pos.x - genPos.x;
      const dz = n.pos.z - genPos.z;
      if (dx * dx + dz * dz <= repairRadiusSq) {
        repaired = true;
        onGeneratorFix();
      }
    }
  }
  return hasSentry;
}
