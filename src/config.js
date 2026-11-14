export const SAVE_KEY = 'artillery_corps_save_v2';

export const DEFAULT_SAVE = {
  version: 2,
  enlisted: false,
  profile: {
    name: 'יואב',
    roleId: 'doher',
    battalion: 'גדוד 409 "בזלת"'
  },
  rankId: 'turai',
  day: 1,
  money: 120,
  score: 0,
  gear: {
    helmet: false,
    vest: false,
    shluker: false,
    sight: false
  },
  ceremonies: {
    turquoiseBeret: false,
    fighterPin: false
  },
  completed: {
    base: false,
    range: false,
    doher_salvo: false,
    roem_rapid: false,
    rokhash_recon: false,
    mafik_radar: false,
    patrol: false
  }
};

export const EVENTS = Object.freeze({
  STATE_CHANGED: 'state:changed',
  ENLIST_COMPLETED: 'enlist:completed',
  ROLE_CHANGED: 'role:changed',
  MISSION_UPDATED: 'mission:updated',
  MISSION_COMPLETED: 'mission:completed',
  RANK_PROMOTED: 'rank:promoted',
  CEREMONY_UNLOCKED: 'ceremony:unlocked',
  GEAR_PURCHASED: 'gear:purchased',
  PLAYER_DAMAGED: 'player:damaged',
  PLAYER_DIED: 'player:died',
  PLAYER_RESPAWNED: 'player:respawned',
  WEAPON_FIRED: 'weapon:fired',
  ABILITY_USED: 'ability:used',
  RANGE_HIT: 'range:hit',
  DRONE_DESTROYED: 'drone:destroyed',
  TOAST: 'ui:toast'
});

export const WORLD_BOUNDS = {
  minX: -205,
  maxX: 205,
  minZ: -426,
  maxZ: 95
};

export const LANDMARKS = {
  spawn: { x: 0, z: 18 },
  barracksA: { x: -17.5, z: 12 },
  clinic: { x: -15, z: 12 },
  shop: { x: 17.2, z: -14 },
  rangeConsole: { x: 49.5, z: 0 },
  shivtaGate: { x: 0, z: -40 },
  shivtaMess: { x: -4, z: -18 },
  shivtaPark: { x: 19, z: 18 },
  yoavGate: { x: -64, z: -178 },
  yoavMess: { x: -92, z: -193 },
  yoavBarracks: { x: -114, z: -163 },
  yamachDepot: { x: -146, z: -190 },
  yoavMemorial: { x: -76, z: -164 },
  lineSign: { x: -54, z: -238 },
  doherPos: { x: -6, z: -290 },
  shellPile: { x: -9.2, z: -291 },
  ammoDump: { x: -22, z: -281 },
  roemPos: { x: 58, z: -282 },
  mafikPos: { x: -56, z: -261 },
  uavLaunch: { x: -100, z: -330 },
  outpostCenter: { x: 0, z: -392 },
  batteryTents: { x: 0, z: -239 },
  dinnerTent: { x: 9, z: -239 },
  commanderTent: { x: 20, z: -238 },
  fieldGym: { x: -10, z: -236.5 },
  batteryKitchen: { x: 26, z: -232 },
  dutyBoard: { x: -5, z: -229 }
};

export const RANKS = [
  { id: 'turai', name: 'טוראי', minScore: 0, bonus: 0 },
  { id: 'rabat', name: 'רב"ט', minScore: 400, bonus: 100 },
  { id: 'samal', name: 'סמל', minScore: 900, bonus: 150 },
  { id: 'samar', name: 'סמ"ר', minScore: 1500, bonus: 250 }
];

export const ROLES = {
  doher: {
    id: 'doher',
    name: 'לוחם צוות תומ"ת "דוהר" (M109)',
    arrayName: 'המערך הקני',
    battalion: 'גדוד 409 "בזלת"',
    unlocked: true,
    unlockReqText: '',
    description: 'הפעלת תותח מתנייע 155 מ"מ, טעינת פגזים וירי סוללתי מדויק.',
    passiveText: 'מהירות +20% בעת נשיאת שקי חול או פגזי 155 מ"מ.',
    abilityName: 'הפגזת סוללה',
    abilityCooldown: 18,
    abilityDuration: 0,
    specialMissionId: 'doher_salvo',
    modifiers: {
      carrySpeedMult: 1.2,
      fireCooldownMult: 1,
      recoilMult: 1,
      weaponRange: 140,
      droneDamageReduction: 0
    }
  },
  roem: {
    id: 'roem',
    name: 'לוחם תומ"ת "רועם" (SIGMA 155)',
    arrayName: 'המערך האוטומטי והרקטי',
    battalion: 'גדוד 518 "סופה"',
    unlocked: true,
    unlockReqText: '',
    description: 'מערכת ארטילריה גלגלית אוטומטית עם קצב אש גבוה ובקרת אש ממוחשבת.',
    passiveText: 'קצב ירי +25% והפחתת רתע ב-30%.',
    abilityName: 'מטח מהיר',
    abilityCooldown: 16,
    abilityDuration: 6,
    specialMissionId: 'roem_rapid',
    modifiers: {
      carrySpeedMult: 1,
      fireCooldownMult: 0.75,
      recoilMult: 0.7,
      weaponRange: 140,
      droneDamageReduction: 0
    }
  },
  rokhash: {
    id: 'rokhash',
    name: 'מפעיל כטמ"ם "רוכב שמיים"',
    arrayName: 'מערך הכטמ"ם (רוכ"ש)',
    battalion: 'פלגת רוכ"ש "שחף"',
    unlocked: true,
    unlockReqText: '',
    description: 'הפעלת כלי טיס טקטיים לתצפית, איכון מטרות וסגירת מעגלי אש.',
    passiveText: 'טווח פגיעה אפקטיבי 210 מ׳ ו-+25% ניקוד על השמדת רחפנים.',
    abilityName: 'סריקת סקיילרק',
    abilityCooldown: 15,
    abilityDuration: 8,
    specialMissionId: 'rokhash_recon',
    modifiers: {
      carrySpeedMult: 1,
      fireCooldownMult: 1,
      recoilMult: 1,
      weaponRange: 210,
      droneDamageReduction: 0
    }
  },
  mafik: {
    id: 'mafik',
    name: 'לוחם מפי"ק ואיכון מכ"ם "ר"ז"',
    arrayName: 'מערך הפעלת האש והאיכון',
    battalion: 'גדוד איכון 619 "נץ המדבר"',
    unlocked: true,
    unlockReqText: '',
    description: 'ניהול מרכז הפיקוד הקדמי, פריסת מכ"ם איכון והגנה מול איומים אוויריים.',
    passiveText: 'הפחתת נזק מרחפנים ב-15% והתראת כיוון במיני-מפה.',
    abilityName: 'שיבוש אלקטרוני',
    abilityCooldown: 16,
    abilityDuration: 6,
    specialMissionId: 'mafik_radar',
    modifiers: {
      carrySpeedMult: 1,
      fireCooldownMult: 1,
      recoilMult: 1,
      weaponRange: 140,
      droneDamageReduction: 0.15
    }
  },
  moran: {
    id: 'moran',
    name: 'לוחם ביחידות המיוחדות ("מורן" / "מיתר")',
    arrayName: 'היחידות המיוחדות',
    battalion: 'יחידת מיתר',
    unlocked: false,
    unlockReqText: 'דרושה דרגת סמל (900 נק׳) + פרופיל 82+',
    description: 'יחידות מסווגות המתמחות בהסוואה עמוקה, תצפית ארוכת טווח וחימוש מדויק.',
    passiveText: '',
    abilityName: '',
    abilityCooldown: 0,
    abilityDuration: 0,
    specialMissionId: '',
    modifiers: { carrySpeedMult: 1, fireCooldownMult: 1, recoilMult: 1, weaponRange: 140, droneDamageReduction: 0 }
  },
  zik: {
    id: 'zik',
    name: 'מפעיל מערך "דוהר שמיים" / "זיק"',
    arrayName: 'מערך הכטמ"ם החטיבתי',
    battalion: 'טייסת סיוע אש',
    unlocked: false,
    unlockReqText: 'דרושה דרגת סמ"ר (1,500 נק׳)',
    description: 'הפעלת כטמ"מים טקטיים ואסטרטגיים בדרג החטיבה לסגירת מעגלי אש מהירה.',
    passiveText: '',
    abilityName: '',
    abilityCooldown: 0,
    abilityDuration: 0,
    specialMissionId: '',
    modifiers: { carrySpeedMult: 1, fireCooldownMult: 1, recoilMult: 1, weaponRange: 140, droneDamageReduction: 0 }
  },
  kachaz: {
    id: 'kachaz',
    name: 'קורס מפקדי צוות (מפק"ץ) וקציני אש (בה"ד 1)',
    arrayName: 'פיקוד וקצונה',
    battalion: 'בית הספר לפיקוד חת"ם',
    unlocked: false,
    unlockReqText: 'השלמת כל משימות הסוללה',
    description: 'פיקוד על צוותי תומ"ת ופלגות אש או שירות כקצין שיתוף אש (קש"א) עם כוחות מתמרנים.',
    passiveText: '',
    abilityName: '',
    abilityCooldown: 0,
    abilityDuration: 0,
    specialMissionId: '',
    modifiers: { carrySpeedMult: 1, fireCooldownMult: 1, recoilMult: 1, weaponRange: 140, droneDamageReduction: 0 }
  }
};

export const SHOP_ITEMS = [
  {
    id: 'helmet',
    icon: '🪖',
    name: 'קסדה קרבית טקטית',
    price: 120,
    description: 'מפחיתה 25% מנזק פגיעות רחפני אויב.'
  },
  {
    id: 'vest',
    icon: '🦺',
    name: 'אפוד קרמי (מנשא לוחות)',
    price: 220,
    description: 'מפחית 40% מנזק פגיעות רחפני אויב.'
  },
  {
    id: 'shluker',
    icon: '🎒',
    name: 'שלוקר מים וברכיות טקטיות',
    price: 140,
    description: 'מגדיל בריאות מקסימלית ל-125 ומוסיף +15% מהירות תנועה.'
  },
  {
    id: 'sight',
    icon: '🎯',
    name: 'כוונת השלכה וערכת פלנלית',
    price: 180,
    description: 'מקצרת זמן בין יריות ב-25% ומקטינה רתע ב-40%.'
  }
];

export const MISSIONS = {
  base: {
    id: 'base',
    roleId: 'all',
    order: 1,
    title: '1. ביצור שער הבסיס',
    description: 'הרם 5 שקי חול ממערום הציוד והנח אותם בעמדות הירוקות בשער הצפוני [E].',
    targetCount: 5,
    moneyReward: 150,
    scoreReward: 200,
    markerPos: { x: -8, z: 6 }
  },
  range: {
    id: 'range',
    roleId: 'all',
    order: 2,
    title: '2. מטווח ירי חי',
    description: 'הפעל את עמדת המטווח [E] ופגע ב-10 מטרות קופצות תוך 60 שניות.',
    targetCount: 10,
    moneyReward: 250,
    scoreReward: 300,
    markerPos: LANDMARKS.rangeConsole
  },
  doher_salvo: {
    id: 'doher_salvo',
    roleId: 'doher',
    order: 3,
    title: '3. פריסת תומ"ת "דוהר" וירי סוללתי',
    description: 'העמס 4 פגזי 155 מ"מ לסדן הדוהר ובצע ירי סוללתי [E].',
    targetCount: 4,
    moneyReward: 300,
    scoreReward: 350,
    markerPos: LANDMARKS.doherPos
  },
  roem_rapid: {
    id: 'roem_rapid',
    roleId: 'roem',
    order: 3,
    title: '3. ירי אוטומטי בתומ"ת "רועם"',
    description: 'כייל 3 צמתי בקרה סביב הרועם [E] ופגע ב-6 מטרות אש תוך 45 שניות.',
    targetCount: 6,
    moneyReward: 300,
    scoreReward: 350,
    markerPos: LANDMARKS.roemPos
  },
  rokhash_recon: {
    id: 'rokhash_recon',
    roleId: 'rokhash',
    order: 3,
    title: '3. סגירת מעגל — "רוכב שמיים"',
    description: 'שגר סקיילרק מרכס התצפית [E] והשמד 4 משדרי אויב לאורך גדר הגבול.',
    targetCount: 4,
    moneyReward: 300,
    scoreReward: 350,
    markerPos: LANDMARKS.uavLaunch
  },
  mafik_radar: {
    id: 'mafik_radar',
    roleId: 'mafik',
    order: 3,
    title: '3. איכון מכ"ם "ר"ז" וניהול אש',
    description: 'כייל 3 אנטנות סביב נגמ"ש המפי"ק [E] ויירט 3 רחפני תצפית עוינים.',
    targetCount: 3,
    moneyReward: 300,
    scoreReward: 350,
    markerPos: LANDMARKS.mafikPos
  },
  patrol: {
    id: 'patrol',
    roleId: 'all',
    order: 4,
    title: '4. שמירה וסיור במוצב הקו',
    description: 'סור ב-4 נקודות הביקורת במוצב הצפוני והשמד רחפני אויב תוקפים.',
    targetCount: 4,
    moneyReward: 350,
    scoreReward: 400,
    markerPos: LANDMARKS.outpostCenter
  }
};

export const isTouchDevice = () =>
  (typeof window !== 'undefined') &&
  (window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0);

export function stripKeyHints(text) {
  if (typeof text !== 'string' || !text) return text;
  return isTouchDevice() ? text.replace(/\s*\[[A-Z]{1,6}\]/g, '') : text;
}

export function getMissionsForRole(roleId) {
  const role = ROLES[roleId] || ROLES.doher;
  const special = MISSIONS[role.specialMissionId] || MISSIONS.doher_salvo;
  return [MISSIONS.base, MISSIONS.range, special, MISSIONS.patrol];
}
