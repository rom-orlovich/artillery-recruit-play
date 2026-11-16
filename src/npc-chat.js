import { blockedAt, lineClear, snapGround, steerStep } from './npc-path.js';
import { syncSoldierTransform } from './world-soldiers.js';
import { faceNpcToward } from './npc-routines.js';

const CHAT_CHECK_SEC = 4;
const CHAT_PAIR_RANGE_M = 14;
const CHAT_MEET_RADIUS_M = 1.2;
const CHAT_DURATION_SEC = 9;
const CHAT_COOLDOWN_SEC = 25;
const CHAT_APPROACH_TIMEOUT_SEC = 10;
const CHAT_WALK_SPEED = 2.2;
const MAX_CHAT_PAIRS = 8;

const CHAT_LINES = [
  ['מתי יוצאים הביתה?', 'אם הכל שקט, אולי בחמישי.'],
  ['מי בשמירה הלילה?', 'אני בעמדה המזרחית משתיים עד ארבע.'],
  ['שמעת מה אומר המ״פ?', 'רק שיהיה לנו שבוע עמוס.'],
  ['נשאר קפה בחדר האוכל?', 'כן, יש תרמוס חם ליד המטבח.'],
  ['בדקת את הקשר הבוקר?', 'עובד חלק, הסוללה מלאה.'],
  ['חם היום, אה?', 'ממש, טוב שיש צל ליד הסככה.'],
  ['מי תורן מטבח היום?', 'נראה לי שדני ויוסי קיבלו את זה.'],
  ['האוכל היום היה לא רע.', 'השניצלים היו דווקא בסדר.'],
  ['השגרה כאן מתחילה לרוץ.', 'כן, כל אחד כבר יודע את המקום שלו.'],
  ['הג׳יפ של האספקה כבר הגיע?', 'צריך להגיע לקראת הצהריים.'],
  ['הכנת כבר את הציוד לסיור?', 'הכל מסודר ומוכן ליד האוהל.'],
  ['רוצה הפסקה קצרה אחרי המשמרת?', 'בכיף, נשב לשתות מים קרים.']
];

const pairs = [];
for (let i = 0; i < MAX_CHAT_PAIRS; i++) {
  pairs.push({
    active: false,
    phase: 0,
    timer: 0,
    a: null,
    b: null,
    midX: 0,
    midZ: 0,
    lineIdx: 0
  });
}

const activeNpcSet = new Set();
const cooldownUntil = new Map();
let chatClock = 0;
let checkTimer = 0;
let nextLineIdx = 0;

function syncNpcMoved(n) {
  snapGround(n.pos);
  n.object.position.set(n.pos.x, n.pos.y, n.pos.z);
  n.object.rotation.y = n.ry;
  syncSoldierTransform(n.spawnIndex, n.pos.x, n.pos.y, n.pos.z, n.ry, n.pose);
}

function endPair(p, withCooldown) {
  const a = p.a;
  const b = p.b;
  if (a) {
    a.chatWith = null;
    a.chatLine = '';
    a.pauseTimer = 0;
    activeNpcSet.delete(a);
    if (withCooldown) cooldownUntil.set(a.id, chatClock + CHAT_COOLDOWN_SEC);
  }
  if (b) {
    b.chatWith = null;
    b.chatLine = '';
    b.pauseTimer = 0;
    activeNpcSet.delete(b);
    if (withCooldown) cooldownUntil.set(b.id, chatClock + CHAT_COOLDOWN_SEC);
  }
  p.active = false;
  p.phase = 0;
  p.timer = 0;
  p.a = null;
  p.b = null;
}

function isEligibleForChat(n) {
  if (!n || !n.pos || n.isOfficer || n.crewOf != null || n.task) return false;
  if (activeNpcSet.has(n) || n.chatWith !== null) return false;
  const cd = cooldownUntil.get(n.id);
  if (cd !== undefined && chatClock < cd) return false;
  return true;
}

function trySpawnPair(npcs) {
  let slot = null;
  for (let i = 0; i < MAX_CHAT_PAIRS; i++) {
    if (!pairs[i].active) {
      slot = pairs[i];
      break;
    }
  }
  if (!slot) return;

  const maxSq = CHAT_PAIR_RANGE_M * CHAT_PAIR_RANGE_M;
  let bestA = null;
  let bestB = null;
  let bestMidX = 0;
  let bestMidZ = 0;
  let bestDistSq = maxSq;
  let bestClear = false;

  for (let i = 0; i < npcs.length; i++) {
    const a = npcs[i];
    if (!isEligibleForChat(a)) continue;
    for (let j = i + 1; j < npcs.length; j++) {
      const b = npcs[j];
      if (!isEligibleForChat(b)) continue;
      const dx = a.pos.x - b.pos.x;
      const dz = a.pos.z - b.pos.z;
      const d2 = dx * dx + dz * dz;
      if (d2 > maxSq) continue;
      const mx = (a.pos.x + b.pos.x) * 0.5;
      const mz = (a.pos.z + b.pos.z) * 0.5;
      if (blockedAt(mx, mz)) continue;
      const clear = lineClear(a.pos.x, a.pos.z, b.pos.x, b.pos.z);
      if ((clear && !bestClear) || (clear === bestClear && d2 < bestDistSq)) {
        bestA = a;
        bestB = b;
        bestMidX = mx;
        bestMidZ = mz;
        bestDistSq = d2;
        bestClear = clear;
      }
    }
  }

  if (!bestA || !bestB) return;
  slot.active = true;
  slot.phase = 0;
  slot.timer = CHAT_APPROACH_TIMEOUT_SEC;
  slot.a = bestA;
  slot.b = bestB;
  slot.midX = bestMidX;
  slot.midZ = bestMidZ;
  slot.lineIdx = nextLineIdx;
  nextLineIdx = (nextLineIdx + 1) % CHAT_LINES.length;
  activeNpcSet.add(bestA);
  activeNpcSet.add(bestB);
  bestA.chatWith = null;
  bestA.chatLine = '';
  bestB.chatWith = null;
  bestB.chatLine = '';
}

function stepApproachingMember(n, partner, midX, midZ, dt) {
  const dist = Math.hypot(n.pos.x - midX, n.pos.z - midZ);
  if (dist > CHAT_MEET_RADIUS_M) {
    steerStep(n, midX, midZ, dt, CHAT_WALK_SPEED);
    n.pose = 'walk';
    syncNpcMoved(n);
    return Math.hypot(n.pos.x - midX, n.pos.z - midZ) <= CHAT_MEET_RADIUS_M;
  }
  if (n.pose !== 'stand') {
    n.pose = 'stand';
    faceNpcToward(n, partner.pos.x, partner.pos.z);
  }
  return true;
}

export function isNpcInChat(npc) {
  return activeNpcSet.has(npc);
}

export function resetNpcChat() {
  for (let i = 0; i < MAX_CHAT_PAIRS; i++) {
    endPair(pairs[i], false);
  }
  activeNpcSet.clear();
  cooldownUntil.clear();
  chatClock = 0;
  checkTimer = 0;
}

export function updateNpcChat(dt, npcs, isNight) {
  if (!npcs || dt <= 0) return;
  chatClock += dt;

  if (isNight) {
    for (let i = 0; i < MAX_CHAT_PAIRS; i++) {
      if (pairs[i].active) endPair(pairs[i], false);
    }
    checkTimer = 0;
    return;
  }

  checkTimer += dt;
  if (checkTimer >= CHAT_CHECK_SEC) {
    checkTimer -= CHAT_CHECK_SEC;
    trySpawnPair(npcs);
  }

  for (let i = 0; i < MAX_CHAT_PAIRS; i++) {
    const p = pairs[i];
    if (!p.active) continue;
    const a = p.a;
    const b = p.b;
    if (!a || !b || !a.pos || !b.pos || a.task || b.task) {
      endPair(p, false);
      continue;
    }

    p.timer -= dt;
    if (p.phase === 0) {
      if (p.timer <= 0) {
        endPair(p, false);
        continue;
      }
      const readyA = stepApproachingMember(a, b, p.midX, p.midZ, dt);
      const readyB = stepApproachingMember(b, a, p.midX, p.midZ, dt);
      if (readyA && readyB) {
        p.phase = 1;
        p.timer = CHAT_DURATION_SEC;
        a.pose = 'stand';
        b.pose = 'stand';
        faceNpcToward(a, b.pos.x, b.pos.z);
        faceNpcToward(b, a.pos.x, a.pos.z);
        const lines = CHAT_LINES[p.lineIdx];
        a.chatWith = b.id;
        a.chatLine = lines[0];
        b.chatWith = a.id;
        b.chatLine = lines[1];
      }
      continue;
    }

    a.pose = 'stand';
    b.pose = 'stand';
    if (p.timer <= 0) {
      endPair(p, true);
    }
  }
}
