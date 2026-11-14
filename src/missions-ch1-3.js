import { LANDMARKS } from './config.js';

export const MISSIONS_CH1_TO_3 = {
  ch1_m1_bakum_gear: {
    id: 'ch1_m1_bakum_gear',
    chapterId: 'ch1_bakum',
    order: 1,
    roleId: 'all',
    title: '1.1 שרשרת חיול ואפסנאות קליטה',
    briefing: 'ברוך הבא לחיל התותחנים! חתום על קיטבג א׳ ומדי ב׳ באפסנאות הקליטה והעבר אותו למגורים א׳.',
    description: 'חתום על ציוד באפסנאות (17.2, -14) והבא את הקיטבג למגורים א׳ (-17.5, 12).',
    targetCount: 2,
    moneyReward: 80,
    scoreReward: 60,
    daysAdvance: 2,
    markerPos: LANDMARKS.shop,
    objectives: [
      {
        id: 'ch1_m1_seq',
        type: 'sequence',
        label: 'שרשרת חיול וקליטת ציוד',
        targetCount: 2,
        subObjectives: [
          {
            id: 'ch1_m1_sign',
            type: 'interact',
            label: 'חתום על ציוד א׳ באפסנאות [E]',
            targetCount: 1,
            points: [{ x: 17.2, z: -14, radius: 4.5, label: 'אפסנאות קליטה' }]
          },
          {
            id: 'ch1_m1_carry',
            type: 'carry',
            label: 'העבר קיטבג מאפסנאות אל מגורים א׳ [E]',
            targetCount: 1,
            carryItem: 'kitbag',
            points: [
              { x: 17.2, z: -14, radius: 4.5, label: 'איסוף קיטבג' },
              { x: -17.5, z: 12, radius: 4.5, label: 'מגורים א׳' }
            ]
          }
        ]
      }
    ]
  },
  ch1_m2_shivta_bus: {
    id: 'ch1_m2_shivta_bus',
    chapterId: 'ch1_bakum',
    order: 2,
    roleId: 'all',
    title: '1.2 ירידה למחנה שבטה והיכרות עם הבסיס',
    briefing: 'ירדת מהאוטובוס בלב הנגב. בצע סיור היכרות ב-4 מוקדי הבסיס המרכזיים.',
    description: 'הגע ל-4 נקודות ההיכרות: רחבת המסדרים, המרפאה, חדר האוכל והאפסנאות.',
    targetCount: 4,
    moneyReward: 80,
    scoreReward: 70,
    daysAdvance: 2,
    markerPos: LANDMARKS.spawn,
    objectives: [
      {
        id: 'ch1_m2_reach',
        type: 'reach',
        label: 'סייר ב-4 מוקדי מחנה שבטה',
        targetCount: 4,
        points: [
          { x: 0, z: 18, radius: 4, label: 'רחבת המסדרים' },
          { x: -15, z: 12, radius: 4, label: 'המרפאה' },
          { x: -4, z: -18, radius: 4, label: 'חדר האוכל' },
          { x: 17, z: -14, radius: 4, label: 'הנשקייה והאפסנאות' }
        ]
      }
    ]
  },
  ch1_m3_rasar_inspection: {
    id: 'ch1_m3_rasar_inspection',
    chapterId: 'ch1_bakum',
    order: 3,
    roleId: 'all',
    title: '1.3 מסדר רס"ר ראשון ומשמעת בסיס',
    briefing: 'הרס"ר מחכה ליד תורן הדגל! סדר 3 מוקדים ברחבה והתייצב למסדר תוך 60 שניות.',
    description: 'סדר 3 מוקדים ברחבה והתייצב מול הרס"ר (-12, -22) תוך 60 שניות.',
    targetCount: 4,
    moneyReward: 100,
    scoreReward: 80,
    daysAdvance: 2,
    markerPos: { x: -12, z: -22 },
    objectives: [
      {
        id: 'ch1_m3_timed',
        type: 'timed',
        label: 'השלמת מסדר רס"ר בזמן',
        timeLimitSec: 60,
        targetCount: 2,
        subObjectives: [
          {
            id: 'ch1_m3_clean',
            type: 'interact',
            label: 'אסוף 3 פריטי ציוד ברחבה [E]',
            targetCount: 3,
            points: [
              { x: -6, z: 6, radius: 4, label: 'מוקד סידור 1' },
              { x: 6, z: 8, radius: 4, label: 'מוקד סידור 2' },
              { x: 0, z: 14, radius: 4, label: 'מוקד סידור 3' }
            ]
          },
          {
            id: 'ch1_m3_rasar',
            type: 'interact',
            label: 'התייצב מול הרס"ר בתורן הדגל [E]',
            targetCount: 1,
            points: [{ x: -12, z: -22, radius: 4.5, label: 'תורן הדגל' }]
          }
        ]
      }
    ]
  },
  ch1_m4_gibbush_sacks: {
    id: 'ch1_m4_gibbush_sacks',
    chapterId: 'ch1_bakum',
    order: 4,
    roleId: 'all',
    title: '1.4 גיבוש תותחנים: אקט סחיבת שקים',
    briefing: 'שבוע הגיבוש החל! שא 3 שקי חול ברצף ממערום הגיבוש אל עמדת הסיום הדרומית.',
    description: 'העבר 3 שקי חול ממערום (-8, 6) אל קו הגיבוש (0, 32).',
    targetCount: 3,
    moneyReward: 120,
    scoreReward: 100,
    daysAdvance: 3,
    markerPos: { x: -8, z: 6 },
    objectives: [
      {
        id: 'ch1_m4_carry',
        type: 'carry',
        label: 'סחיבת 3 שקי חול בגיבוש [E]',
        targetCount: 3,
        carryItem: 'sandbag',
        points: [
          { x: -8, z: 6, radius: 4, label: 'מערום שקים' },
          { x: 0, z: 32, radius: 4.5, label: 'קו הסיום הדרומי' }
        ]
      }
    ]
  },
  ch1_m5_gibbush_sprint: {
    id: 'ch1_m5_gibbush_sprint',
    chapterId: 'ch1_bakum',
    order: 5,
    roleId: 'all',
    title: '1.5 גיבוש תותחנים: בוחן ספרינטים וניווט',
    briefing: 'חלק שני של הגיבוש: רוץ בין 5 דגלי ניווט סביב היקף המחנה תוך 75 שניות!',
    description: 'עבור ב-5 דגלי ניווט מדבריים סביב היקף המחנה תוך 75 שניות.',
    targetCount: 5,
    moneyReward: 130,
    scoreReward: 110,
    daysAdvance: 3,
    markerPos: { x: -30, z: 20 },
    objectives: [
      {
        id: 'ch1_m5_timed',
        type: 'timed',
        label: 'בוחן ספרינטים תוך 75 שניות',
        timeLimitSec: 75,
        targetCount: 1,
        subObjectives: [
          {
            id: 'ch1_m5_flags',
            type: 'reach',
            label: 'עבור ב-5 דגלי הניווט',
            targetCount: 5,
            points: [
              { x: -30, z: 20, radius: 4.5, label: 'דגל 1' },
              { x: -30, z: -25, radius: 4.5, label: 'דגל 2' },
              { x: 0, z: -33, radius: 4.5, label: 'דגל 3' },
              { x: 30, z: -20, radius: 4.5, label: 'דגל 4' },
              { x: 25, z: 22, radius: 4.5, label: 'דגל 5' }
            ]
          }
        ]
      }
    ]
  },
  ch1_m6_array_sorting: {
    id: 'ch1_m6_array_sorting',
    chapterId: 'ch1_bakum',
    order: 6,
    roleId: 'all',
    title: '1.6 ראיון אישי ושיוך למערכי החיל',
    briefing: 'סיימת את הגיבוש! גש למפקד הסוללה ברחבה והתייצב בעמדת המערך שלך.',
    description: 'דבר עם המסו"ל (6, 14) והגע לעמדת הדוהר (19, 18) או עמדת התפקיד.',
    targetCount: 2,
    moneyReward: 140,
    scoreReward: 120,
    daysAdvance: 2,
    markerPos: { x: 6, z: 14 },
    unlocks: { chapterId: 'ch2_tironut' },
    objectives: [
      {
        id: 'ch1_m6_seq',
        type: 'sequence',
        label: 'ראיון שיבוץ למערכי החיל',
        targetCount: 2,
        subObjectives: [
          {
            id: 'ch1_m6_talk',
            type: 'interact',
            label: 'קבל תדריך ממפקד הסוללה [E]',
            targetCount: 1,
            points: [{ x: 6, z: 14, radius: 4.5, label: 'מפקד הסוללה' }]
          },
          {
            id: 'ch1_m6_pos',
            type: 'reach',
            label: 'התייצב בעמדת האמל"ח של המערך',
            targetCount: 1,
            points: [{ x: 19, z: 18, radius: 5, label: 'מתחם האמל"ח' }]
          }
        ]
      }
    ]
  },

  ch2_m1_morning_parade: {
    id: 'ch2_m1_morning_parade',
    chapterId: 'ch2_tironut',
    order: 1,
    roleId: 'all',
    title: '2.1 מסדר בוקר בח׳ וגילוח-צחצוח',
    briefing: '06:00 בבוקר בשבטה. שתה מים בחדר האוכל, סדר מיטה במגורים והתייצב למסדר ח׳ תוך 50 שניות.',
    description: 'שתיית מים, סידור מיטה והתייצבות במסדר ח׳ (0, 14) תוך 50 שניות.',
    targetCount: 3,
    moneyReward: 100,
    scoreReward: 90,
    daysAdvance: 8,
    markerPos: { x: -4, z: -18 },
    objectives: [
      {
        id: 'ch2_m1_timed',
        type: 'timed',
        label: 'מסדר בוקר תוך 50 שניות',
        timeLimitSec: 50,
        targetCount: 3,
        subObjectives: [
          {
            id: 'ch2_m1_mess',
            type: 'interact',
            label: 'שתה מים בחדר האוכל [E]',
            targetCount: 1,
            points: [{ x: -4, z: -18, radius: 4.5, label: 'חדר האוכל' }]
          },
          {
            id: 'ch2_m1_bunk',
            type: 'interact',
            label: 'סדר את המיטה במגורים א׳ [E]',
            targetCount: 1,
            points: [{ x: -17.5, z: 12, radius: 4.5, label: 'מגורים א׳' }]
          },
          {
            id: 'ch2_m1_formation',
            type: 'reach',
            label: 'התייצב ברחבת הח׳ מול המפק"ץ',
            targetCount: 1,
            points: [{ x: 0, z: 14, radius: 4, label: 'רחבת הח׳' }]
          }
        ]
      }
    ]
  },
  ch2_m2_weapon_cleaning: {
    id: 'ch2_m2_weapon_cleaning',
    chapterId: 'ch2_tironut',
    order: 2,
    roleId: 'all',
    title: '2.2 ניקוי נשק בפלנלית ושמן רובים',
    briefing: 'סופת חול בנגב! נקה את ה-M4 ב-3 תחנות הפלנלית ליד הנשקייה לפני בדיקת המפקד.',
    description: 'בצע 3 פעולות ניקוי נשק בשולחן הנשקייה (14, -8).',
    targetCount: 3,
    moneyReward: 110,
    scoreReward: 100,
    daysAdvance: 8,
    markerPos: { x: 14, z: -8 },
    objectives: [
      {
        id: 'ch2_m2_clean',
        type: 'interact',
        label: 'נקה את ה-M4 בפלנלית ושמן [E]',
        targetCount: 3,
        entityGroup: 'cleaningTable',
        points: [{ x: 14, z: -8, radius: 4.5, label: 'שולחן ניקוי נשק' }]
      }
    ]
  },
  base: {
    id: 'base',
    chapterId: 'ch2_tironut',
    order: 3,
    roleId: 'all',
    title: '1. ביצור שער הבסיס',
    briefing: 'הרם 5 שקי חול ממערום הציוד והנח אותם בעמדות הירוקות בשער הצפוני [E].',
    description: 'הרם 5 שקי חול ממערום הציוד והנח אותם בעמדות הירוקות בשער הצפוני [E].',
    targetCount: 5,
    moneyReward: 150,
    scoreReward: 200,
    daysAdvance: 10,
    markerPos: { x: -8, z: 6 },
    objectives: [
      {
        id: 'base_carry',
        type: 'carry',
        label: 'העבר 5 שקי חול לשער הצפוני [E]',
        targetCount: 5,
        carryItem: 'sandbag',
        points: [
          { x: -8, z: 6, radius: 4, label: 'מערום שקים' },
          { x: 0, z: -31, radius: 10, label: 'השער הצפוני' }
        ]
      }
    ]
  },
  ch2_m4_guard_tower: {
    id: 'ch2_m4_guard_tower',
    chapterId: 'ch2_tironut',
    order: 4,
    roleId: 'all',
    title: '2.4 תורנות שמירה בש"ג ובמגדל',
    briefing: 'אייש את עמדת הש"ג למשך 35 שניות והדוף 2 רחפני תצפית שמתקרבים לגדר.',
    description: 'שמור בשער הצפוני (0, -31) 35 שניות ויירט 2 רחפנים.',
    targetCount: 2,
    moneyReward: 160,
    scoreReward: 150,
    daysAdvance: 10,
    markerPos: { x: 0, z: -31 },
    objectives: [
      {
        id: 'ch2_m4_defend',
        type: 'defend',
        label: 'אבטח את השער הצפוני (35 ש׳)',
        targetCount: 35,
        holdDurationSec: 35,
        points: [{ x: 0, z: -31, radius: 9, label: 'ש"ג צפוני' }]
      },
      {
        id: 'ch2_m4_drones',
        type: 'destroy-drones',
        label: 'השמד 2 רחפני תצפית',
        targetCount: 2,
        waveDrones: 2,
        entityGroup: 'drones'
      }
    ]
  },
  range: {
    id: 'range',
    chapterId: 'ch2_tironut',
    order: 5,
    roleId: 'all',
    title: '2. מטווח ירי חי',
    briefing: 'הפעל את עמדת המטווח [E] ופגע ב-10 מטרות קופצות תוך 60 שניות.',
    description: 'הפעל את עמדת המטווח [E] ופגע ב-10 מטרות קופצות תוך 60 שניות.',
    targetCount: 10,
    moneyReward: 250,
    scoreReward: 300,
    daysAdvance: 10,
    markerPos: LANDMARKS.rangeConsole,
    objectives: [
      {
        id: 'range_shoot',
        type: 'shoot-targets',
        label: 'פגע ב-10 מטרות מטווח תוך 60 ש׳',
        targetCount: 10,
        timeLimitSec: 60,
        entityGroup: 'rangeTargets',
        points: [LANDMARKS.rangeConsole]
      }
    ]
  },
  ch2_m6_night_range: {
    id: 'ch2_m6_night_range',
    chapterId: 'ch2_tironut',
    order: 6,
    roleId: 'all',
    title: '2.6 מטווח לילה וירי תחת תאורה',
    briefing: 'השמש שקעה מעל שבטה. בצע מקצה ירי לילה של 8 מטרות קופצות תוך 50 שניות.',
    description: 'פגע ב-8 מטרות במטווח הלילה תוך 50 שניות.',
    targetCount: 8,
    moneyReward: 180,
    scoreReward: 180,
    daysAdvance: 10,
    forceTimeOfDay: 21.5,
    markerPos: LANDMARKS.rangeConsole,
    objectives: [
      {
        id: 'ch2_m6_shoot',
        type: 'shoot-targets',
        label: 'פגע ב-8 מטרות בלילה תוך 50 ש׳',
        targetCount: 8,
        timeLimitSec: 50,
        entityGroup: 'rangeTargets',
        points: [LANDMARKS.rangeConsole]
      }
    ]
  },
  ch2_m7_war_week: {
    id: 'ch2_m7_war_week',
    chapterId: 'ch2_tironut',
    order: 7,
    roleId: 'all',
    title: '2.7 שבוע מלחמה: הסתערות וטיהור שטח אש',
    briefing: 'דלג בין 3 מחסות בשטח האש הצפוני, השמד 4 רחפני אויב וכבוש את גבעת היעד.',
    description: 'דלג ל-3 מחסות בשטח האש הצפוני והשמד 4 רחפנים.',
    targetCount: 2,
    moneyReward: 220,
    scoreReward: 220,
    daysAdvance: 10,
    markerPos: { x: 18, z: -48 },
    objectives: [
      {
        id: 'ch2_m7_seq',
        type: 'sequence',
        label: 'הסתערות וטיהור שטח אש',
        targetCount: 2,
        subObjectives: [
          {
            id: 'ch2_m7_cover',
            type: 'reach',
            label: 'דלג בין 3 מחסות סלע בשטח האש',
            targetCount: 3,
            points: [
              { x: 18, z: -48, radius: 4.5, label: 'מחסה 1' },
              { x: -14, z: -58, radius: 4.5, label: 'מחסה 2' },
              { x: 0, z: -70, radius: 4.5, label: 'גבעת היעד' }
            ]
          },
          {
            id: 'ch2_m7_kill',
            type: 'destroy-drones',
            label: 'השמד 4 רחפני אויב',
            targetCount: 4,
            waveDrones: 4,
            entityGroup: 'drones'
          }
        ]
      }
    ]
  },
  ch2_m8_oath_and_beret_march: {
    id: 'ch2_m8_oath_and_beret_march',
    chapterId: 'ch2_tironut',
    order: 8,
    roleId: 'all',
    title: '2.8 מסע כומתה בנגב וטקס השבעה',
    briefing: 'מסע כומתת הטורקיז! צעד דרך 5 נקודות ציון מדבריות והתייצב בבמת הטקס לקבלת הכומתה.',
    description: 'צעד ב-5 נקודות המסע והתייצב בבמת הטקס (-12, -22).',
    targetCount: 2,
    moneyReward: 250,
    scoreReward: 300,
    daysAdvance: 10,
    markerPos: { x: -40, z: 30 },
    unlocks: { ceremony: 'turquoiseBeret', swearingIn: true, chapterId: 'ch3_mikzoi' },
    objectives: [
      {
        id: 'ch2_m8_seq',
        type: 'sequence',
        label: 'מסע כומתת הטורקיז וטקס השבעה',
        targetCount: 2,
        subObjectives: [
          {
            id: 'ch2_m8_march',
            type: 'reach',
            label: 'צעד דרך 5 נקודות הציון במדבר',
            targetCount: 5,
            points: [
              { x: -40, z: 30, radius: 5, label: 'נקודת מסע 1' },
              { x: -42, z: -62, radius: 5, label: 'רכס תצפית' },
              { x: 0, z: -82, radius: 5, label: 'קו צפוני' },
              { x: 48, z: 0, radius: 5, label: 'מטווח שבטה' },
              { x: 0, z: 18, radius: 5, label: 'שער הסיום' }
            ]
          },
          {
            id: 'ch2_m8_oath',
            type: 'interact',
            label: 'התייצב בבמת ההשבעה לקבלת כומתת הטורקיז [E]',
            targetCount: 1,
            points: [{ x: -12, z: -22, radius: 5, label: 'במת הטקס' }]
          }
        ]
      }
    ]
  },

  ch3_m1_theory_sim: {
    id: 'ch3_m1_theory_sim',
    chapterId: 'ch3_mikzoi',
    order: 1,
    roleId: 'all',
    title: '3.1 סימולטור תותחנות והכרת המערך',
    briefing: 'התחלת את הקורס המקצועי בביסל"ת! עבור בין 3 עמדות ההדרכה והשלם את מבחן ההסמכה.',
    description: 'בצע אינטראקציה ב-3 עמדות הדרכה במתחם האמל"ח [E].',
    targetCount: 3,
    moneyReward: 150,
    scoreReward: 150,
    daysAdvance: 12,
    markerPos: { x: 14, z: 16 },
    objectives: [
      {
        id: 'ch3_m1_sim',
        type: 'interact',
        label: 'עבור 3 עמדות סימולטור והדרכה [E]',
        targetCount: 3,
        points: [
          { x: 12, z: 14, radius: 4, label: 'עמדת הדרכה 1' },
          { x: 18, z: 18, radius: 4, label: 'סימולטור 2' },
          { x: 19, z: 26, radius: 4, label: 'מבחן הסמכה 3' }
        ]
      }
    ]
  },
  ch3_m2_vehicle_drive: {
    id: 'ch3_m2_vehicle_drive',
    chapterId: 'ch3_mikzoi',
    order: 2,
    roleId: 'all',
    title: '3.2 נהיגת שטח והובלת רק"ם לעמדה',
    briefing: 'חבר את הרכב המערכי ב-[E] והובל אותו בשטח מהבסיס אל עמדת הפריסה הקדמית.',
    description: 'הפעל רכב ב-(8, 22) וסע דרך 3 שערי המסלול אל (0, -76).',
    targetCount: 2,
    moneyReward: 180,
    scoreReward: 180,
    daysAdvance: 12,
    markerPos: { x: 8, z: 22 },
    objectives: [
      {
        id: 'ch3_m2_seq',
        type: 'sequence',
        label: 'הובלת רק"ם לעמדת הפריסה',
        targetCount: 2,
        subObjectives: [
          {
            id: 'ch3_m2_mount',
            type: 'interact',
            label: 'התנע והיכנס לרכב המערך [E]',
            targetCount: 1,
            entityGroup: 'vehicle',
            points: [{ x: 8, z: 22, radius: 5, label: 'חניון רכבים' }]
          },
          {
            id: 'ch3_m2_route',
            type: 'reach',
            label: 'נווט דרך 3 שערי עמדת הפריסה',
            targetCount: 3,
            points: [
              { x: 0, z: -40, radius: 6, label: 'שער מסלול 1' },
              { x: -20, z: -60, radius: 6, label: 'שער מסלול 2' },
              { x: 0, z: -76, radius: 6, label: 'עמדת פריסה קדמית' }
            ]
          }
        ]
      }
    ]
  },
  ch3_m3_radio_comms: {
    id: 'ch3_m3_radio_comms',
    chapterId: 'ch3_mikzoi',
    order: 3,
    roleId: 'all',
    title: '3.3 נוהל קשר סוללתי ("רשת קרקע")',
    briefing: 'אלחוטן קרבי שולט בקשר! כייל 3 מכשירי קשר מוצפנים בבסיס ובשטח האש.',
    description: 'כייל 3 עמדות קשר במפי"ק, בדוהר וברכס התצפית [E].',
    targetCount: 3,
    moneyReward: 160,
    scoreReward: 160,
    daysAdvance: 12,
    markerPos: LANDMARKS.mafikPos,
    objectives: [
      {
        id: 'ch3_m3_radio',
        type: 'interact',
        label: 'כייל 3 מכשירי קשר סוללתיים [E]',
        targetCount: 3,
        points: [
          { x: -56, z: -261, radius: 4.5, label: 'קשר מפי"ק' },
          { x: -6, z: -290, radius: 4.5, label: 'קשר דוהר' },
          { x: -100, z: -330, radius: 4.5, label: 'קשר רכס תצפית' }
        ]
      }
    ]
  },
  ch3_m4_night_camo: {
    id: 'ch3_m4_night_camo',
    chapterId: 'ch3_mikzoi',
    order: 4,
    roleId: 'all',
    title: '3.4 פריסת רשתות הסוואה ואבטחת אמצעים',
    briefing: 'כוח אווירי עוין סורק את הגזרה! פרוס 3 רשתות הסוואה ויירט 2 רחפני צילום תוך 60 שניות.',
    description: 'פרוס 3 רשתות הסוואה ויירט 2 רחפנים תוך 60 שניות.',
    targetCount: 2,
    moneyReward: 200,
    scoreReward: 200,
    daysAdvance: 14,
    markerPos: LANDMARKS.doherPos,
    objectives: [
      {
        id: 'ch3_m4_timed',
        type: 'timed',
        label: 'הסוואה ויירוט תוך 60 שניות',
        timeLimitSec: 60,
        targetCount: 2,
        subObjectives: [
          {
            id: 'ch3_m4_camo',
            type: 'interact',
            label: 'פרוס 3 רשתות הסוואה על הכלים [E]',
            targetCount: 3,
            points: [
              { x: -6, z: -290, radius: 4.5, label: 'הסוואת דוהר' },
              { x: 58, z: -282, radius: 4.5, label: 'הסוואת רועם' },
              { x: -56, z: -261, radius: 4.5, label: 'הסוואת מפי"ק' }
            ]
          },
          {
            id: 'ch3_m4_drones',
            type: 'destroy-drones',
            label: 'יירט 2 רחפני צילום',
            targetCount: 2,
            waveDrones: 2,
            entityGroup: 'drones'
          }
        ]
      }
    ]
  },
  doher_salvo: {
    id: 'doher_salvo',
    chapterId: 'ch3_mikzoi',
    order: 5,
    roleId: 'doher',
    title: '3. פריסת תומ"ת "דוהר" וירי סוללתי',
    briefing: 'העמס 4 פגזי 155 מ"מ לסדן הדוהר ובצע ירי סוללתי [E].',
    description: 'העמס 4 פגזי 155 מ"מ לסדן הדוהר ובצע ירי סוללתי [E].',
    targetCount: 4,
    moneyReward: 300,
    scoreReward: 350,
    daysAdvance: 12,
    markerPos: LANDMARKS.doherPos,
    objectives: [
      {
        id: 'doher_load',
        type: 'carry',
        label: 'העמס 4 פגזי 155 מ"מ לדוהר [E]',
        targetCount: 4,
        carryItem: 'shell',
        points: [LANDMARKS.shellPile, LANDMARKS.doherPos]
      }
    ]
  },
  ch3_doher_breech_drill: {
    id: 'ch3_doher_breech_drill',
    chapterId: 'ch3_mikzoi',
    order: 6,
    roleId: 'doher',
    title: '3.6א תרגול צוות "דוהר": חנ"ה, סדן וכינון ישיר',
    briefing: 'תרגול מהירות טען-כוון! העמס 3 פגזים תוך 55 שניות והדוף 2 רחפנים המאיימים על החנ"ה.',
    description: 'העמס 3 פגזים ויירט 2 רחפנים תוך 55 שניות.',
    targetCount: 2,
    moneyReward: 260,
    scoreReward: 280,
    daysAdvance: 13,
    markerPos: LANDMARKS.shellPile,
    unlocks: { chapterId: 'ch4_mitkadem' },
    objectives: [
      {
        id: 'ch3_doher_timed',
        type: 'timed',
        label: 'תרגול טען-כוון ב-55 שניות',
        timeLimitSec: 55,
        targetCount: 2,
        subObjectives: [
          {
            id: 'ch3_doher_shells',
            type: 'carry',
            label: 'טען 3 פגזי 155 מ"מ לסדן [E]',
            targetCount: 3,
            carryItem: 'shell',
            points: [
              { x: -9.2, z: -291, radius: 4, label: 'מערום חנ"ה' },
              { x: -6, z: -290, radius: 4.5, label: 'סדן הדוהר' }
            ]
          },
          {
            id: 'ch3_doher_drones',
            type: 'destroy-drones',
            label: 'הדוף 2 רחפנים תוקפים',
            targetCount: 2,
            waveDrones: 2,
            entityGroup: 'drones'
          }
        ]
      }
    ]
  },
  roem_rapid: {
    id: 'roem_rapid',
    chapterId: 'ch3_mikzoi',
    order: 5,
    roleId: 'roem',
    title: '3. ירי אוטומטי בתומ"ת "רועם"',
    briefing: 'כייל 3 צמתי בקרה סביב הרועם [E] ופגע ב-6 מטרות אש תוך 45 שניות.',
    description: 'כייל 3 צמתי בקרה סביב הרועם [E] ופגע ב-6 מטרות אש תוך 45 שניות.',
    targetCount: 6,
    moneyReward: 300,
    scoreReward: 350,
    daysAdvance: 12,
    markerPos: LANDMARKS.roemPos,
    objectives: [
      {
        id: 'roem_shoot',
        type: 'shoot-targets',
        label: 'פגע ב-6 מטרות אש תוך 45 ש׳',
        targetCount: 6,
        timeLimitSec: 45,
        entityGroup: 'roemTargets'
      }
    ]
  },
  ch3_roem_autoloader: {
    id: 'ch3_roem_autoloader',
    chapterId: 'ch3_mikzoi',
    order: 6,
    roleId: 'roem',
    title: '3.6ב תפעול מעצור במערכת הטעינה האוטומטית ("רועם")',
    briefing: 'תקלה בסימולציית קרב! אפס 3 צמתי בקרת אש של ה"רועם" והשמד 3 רחפנים תוקפים.',
    description: 'אפס 3 צמתי בקרה ברועם והשמד 3 רחפנים.',
    targetCount: 2,
    moneyReward: 260,
    scoreReward: 280,
    daysAdvance: 13,
    markerPos: LANDMARKS.roemPos,
    unlocks: { chapterId: 'ch4_mitkadem' },
    objectives: [
      {
        id: 'ch3_roem_seq',
        type: 'sequence',
        label: 'תפעול מעצור ובלימת אויב',
        targetCount: 2,
        subObjectives: [
          {
            id: 'ch3_roem_nodes',
            type: 'interact',
            label: 'אפס 3 צמתי בקרת אש של הרועם [E]',
            targetCount: 3,
            entityGroup: 'roemNodes',
            points: [
              { x: 55.5, z: -280.5, radius: 4, label: 'צומת רועם 1' },
              { x: 58, z: -282, radius: 4, label: 'צומת רועם 2' },
              { x: 60.5, z: -280.5, radius: 4, label: 'צומת רועם 3' }
            ]
          },
          {
            id: 'ch3_roem_drones',
            type: 'destroy-drones',
            label: 'השמד 3 רחפנים תוקפים',
            targetCount: 3,
            waveDrones: 3,
            entityGroup: 'drones'
          }
        ]
      }
    ]
  },
  rokhash_recon: {
    id: 'rokhash_recon',
    chapterId: 'ch3_mikzoi',
    order: 5,
    roleId: 'rokhash',
    title: '3. סגירת מעגל — "רוכב שמיים"',
    briefing: 'שגר סקיילרק מרכס התצפית [E] והשמד 4 משדרי אויב לאורך גדר הגבול.',
    description: 'שגר סקיילרק מרכס התצפית [E] והשמד 4 משדרי אויב לאורך גדר הגבול.',
    targetCount: 4,
    moneyReward: 300,
    scoreReward: 350,
    daysAdvance: 12,
    markerPos: LANDMARKS.uavLaunch,
    objectives: [
      {
        id: 'rokhash_tx',
        type: 'destroy-drones',
        label: 'השמד 4 משדרי אויב בגדר',
        targetCount: 4,
        entityGroup: 'transmitters'
      }
    ]
  },
  ch3_rokhash_wind_launch: {
    id: 'ch3_rokhash_wind_launch',
    chapterId: 'ch3_mikzoi',
    order: 6,
    roleId: 'rokhash',
    title: '3.6ג המראת "סקיילרק" ברוח צד ותצפית חשאית',
    briefing: 'התגנב לעמדת תצפית קדמית ללא גילוי ל-20 שניות והנחת מטח ארטילרי [M].',
    description: 'תצפית חשאית 20 ש׳ ב-(-35, -92) והכוונת מטח אש [M].',
    targetCount: 2,
    moneyReward: 260,
    scoreReward: 280,
    daysAdvance: 13,
    markerPos: { x: -38, z: -382 },
    unlocks: { chapterId: 'ch4_mitkadem' },
    objectives: [
      {
        id: 'ch3_rokhash_seq',
        type: 'sequence',
        label: 'תצפית חשאית והכוונת אש',
        targetCount: 2,
        subObjectives: [
          {
            id: 'ch3_rokhash_stealth',
            type: 'stealth',
            label: 'שמור על תצפית חשאית ל-20 שניות',
            targetCount: 1,
            holdDurationSec: 20,
            maxDetectionRadius: 14,
            points: [{ x: -38, z: -382, radius: 5.5, label: 'עמדת תצפית קדמית' }]
          },
          {
            id: 'ch3_rokhash_fire',
            type: 'call-fire',
            label: 'הנחת מטח ארטילרי נפיץ [M]',
            targetCount: 1,
            shellType: 'he'
          }
        ]
      }
    ]
  },
  mafik_radar: {
    id: 'mafik_radar',
    chapterId: 'ch3_mikzoi',
    order: 5,
    roleId: 'mafik',
    title: '3. איכון מכ"ם "ר"ז" וניהול אש',
    briefing: 'כייל 3 אנטנות סביב נגמ"ש המפי"ק [E] ויירט 3 רחפני תצפית עוינים.',
    description: 'כייל 3 אנטנות סביב נגמ"ש המפי"ק [E] ויירט 3 רחפני תצפית עוינים.',
    targetCount: 3,
    moneyReward: 300,
    scoreReward: 350,
    daysAdvance: 12,
    markerPos: LANDMARKS.mafikPos,
    objectives: [
      {
        id: 'mafik_drones',
        type: 'destroy-drones',
        label: 'יירט 3 רחפני תצפית עוינים',
        targetCount: 3,
        waveDrones: 3,
        entityGroup: 'drones'
      }
    ]
  },
  ch3_mafik_ballistics: {
    id: 'ch3_mafik_ballistics',
    chapterId: 'ch3_mikzoi',
    order: 6,
    roleId: 'mafik',
    title: '3.6ד הזנת נתוני מטאורולוגיה במכ"ש וחישוב מטח',
    briefing: 'אסוף נתוני רוח מ-2 אנטנות מטאורולוגיה והנחת 2 מטחי איכון במפת האש [M].',
    description: 'כייל 2 אנטנות מטאורולוגיה והנחת 2 מטחי נפיץ [M].',
    targetCount: 2,
    moneyReward: 260,
    scoreReward: 280,
    daysAdvance: 13,
    markerPos: { x: -64, z: -265 },
    unlocks: { chapterId: 'ch4_mitkadem' },
    objectives: [
      {
        id: 'ch3_mafik_seq',
        type: 'sequence',
        label: 'חישוב נתוני מטח והנחתת אש',
        targetCount: 2,
        subObjectives: [
          {
            id: 'ch3_mafik_wind',
            type: 'interact',
            label: 'אסוף נתוני רוח מ-2 אנטנות [E]',
            targetCount: 2,
            points: [
              { x: -64, z: -265, radius: 4.5, label: 'אנטנה מערבית' },
              { x: -48, z: -265, radius: 4.5, label: 'אנטנה מזרחית' }
            ]
          },
          {
            id: 'ch3_mafik_fire',
            type: 'call-fire',
            label: 'הנחת 2 מטחי איכון במפת האש [M]',
            targetCount: 2,
            shellType: 'he'
          }
        ]
      }
    ]
  },
  ch3_moran_hidden_obs: {
    id: 'ch3_moran_hidden_obs',
    chapterId: 'ch3_mikzoi',
    order: 5,
    roleId: 'moran',
    title: '3.5ה ("מורן/מיתר"): הסוואה עמוקה ושיגור מדויק',
    briefing: 'התמקם בעמדת מסתור בקו הגבול ל-25 שניות ללא גילוי והשמד 3 מטרות איכות.',
    description: 'תצפית חשאית 25 ש׳ ב-(-38, -108) והשמדת 3 משדרים.',
    targetCount: 2,
    moneyReward: 350,
    scoreReward: 400,
    daysAdvance: 12,
    markerPos: { x: -36, z: -396 },
    objectives: [
      {
        id: 'ch3_moran_stealth',
        type: 'stealth',
        label: 'החזק תצפית מוסווית 25 שניות',
        targetCount: 1,
        holdDurationSec: 25,
        maxDetectionRadius: 12,
        points: [{ x: -36, z: -396, radius: 5, label: 'עמדת מסתור מורן' }]
      },
      {
        id: 'ch3_moran_tx',
        type: 'destroy-drones',
        label: 'השמד 3 מטרות/משדרים מרחוק',
        targetCount: 3,
        entityGroup: 'transmitters'
      }
    ]
  },
  ch3_zik_high_altitude: {
    id: 'ch3_zik_high_altitude',
    chapterId: 'ch3_mikzoi',
    order: 5,
    roleId: 'zik',
    title: '3.5ו ("דוהר שמיים/זיק"): סגירת מעגל חטיבתית',
    briefing: 'שגר כטמ"ם מרכס התצפית והנחת 2 מטחי סוללה כבדים על יעדי האויב [M].',
    description: 'הפעל מנחת (-42, -62) והנחת 2 מטחי סוללה [M].',
    targetCount: 2,
    moneyReward: 350,
    scoreReward: 400,
    daysAdvance: 12,
    markerPos: LANDMARKS.uavLaunch,
    objectives: [
      {
        id: 'ch3_zik_seq',
        type: 'sequence',
        label: 'סגירת מעגל חטיבתית',
        targetCount: 2,
        subObjectives: [
          {
            id: 'ch3_zik_launch',
            type: 'interact',
            label: 'שגר כטמ"ם זיק מרכס התצפית [E]',
            targetCount: 1,
            points: [{ x: -100, z: -330, radius: 4.5, label: 'מנחת התצפית' }]
          },
          {
            id: 'ch3_zik_fire',
            type: 'call-fire',
            label: 'הנחת 2 מטחי סוללה כבדים [M]',
            targetCount: 2,
            shellType: 'he'
          }
        ]
      }
    ]
  }
};
