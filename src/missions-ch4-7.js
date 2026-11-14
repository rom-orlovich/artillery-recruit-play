import { LANDMARKS } from './config.js';

export const MISSIONS_CH4_TO_7 = {
  ch4_m1_battery_deploy: {
    id: 'ch4_m1_battery_deploy',
    chapterId: 'ch4_mitkadem',
    order: 1,
    roleId: 'all',
    title: '4.1 דילוג ופריסת סוללה מהירה בשטח',
    briefing: 'תרגיל צפ"ס! הגע ל-3 עמדות הכלים והצב ארגז תחמושת תוך 65 שניות.',
    description: 'פריסה ב-3 עמדות והבאת ארגז תחמושת תוך 65 שניות.',
    targetCount: 2,
    moneyReward: 220,
    scoreReward: 220,
    daysAdvance: 12,
    markerPos: LANDMARKS.doherPos,
    objectives: [
      {
        id: 'ch4_m1_timed',
        type: 'timed',
        label: 'פריסת סוללה תוך 65 שניות',
        timeLimitSec: 65,
        targetCount: 2,
        subObjectives: [
          {
            id: 'ch4_m1_pos',
            type: 'reach',
            label: 'עבור ב-3 עמדות הפריסה',
            targetCount: 3,
            points: [
              { x: -6, z: -290, radius: 5, label: 'עמדת דוהר' },
              { x: 58, z: -282, radius: 5, label: 'עמדת רועם' },
              { x: -56, z: -261, radius: 5, label: 'עמדת מפי"ק' }
            ]
          },
          {
            id: 'ch4_m1_ammo',
            type: 'carry',
            label: 'הצב ארגז תחמושת בעמדת הפריסה [E]',
            targetCount: 1,
            carryItem: 'ammoCrate',
            points: [
              { x: -22, z: -281, radius: 4, label: 'מצבור תחמושת' },
              { x: -6, z: -290, radius: 4.5, label: 'עמדת סוללה' }
            ]
          }
        ]
      }
    ]
  },
  ch4_m2_wire_link: {
    id: 'ch4_m2_wire_link',
    chapterId: 'ch4_mitkadem',
    order: 2,
    roleId: 'all',
    title: '4.2 חיבור קווי תקשורת בין המפי"ק לפלגות האש',
    briefing: 'בעת שיבוש אלקטרוני עוברים לקו נדל"ן! חבר 4 קופסאות סעף מהמפי"ק אל הכלים.',
    description: 'חבר 4 קופסאות תקשורת קווית מהמפי"ק אל התומ"תים [E].',
    targetCount: 4,
    moneyReward: 220,
    scoreReward: 230,
    daysAdvance: 12,
    markerPos: LANDMARKS.mafikPos,
    objectives: [
      {
        id: 'ch4_m2_wires',
        type: 'interact',
        label: 'חבר 4 קופסאות סעף קוויות [E]',
        targetCount: 4,
        points: [
          { x: -56, z: -261, radius: 4.5, label: 'מפי"ק' },
          { x: 14, z: -232, radius: 4.5, label: 'מרכזייה' },
          { x: -6, z: -290, radius: 4.5, label: 'פלגת דוהר' },
          { x: 58, z: -282, radius: 4.5, label: 'פלגת רועם' }
        ]
      }
    ]
  },
  ch4_m3_illum_night_fire: {
    id: 'ch4_m3_illum_night_fire',
    chapterId: 'ch4_mitkadem',
    order: 3,
    roleId: 'all',
    title: '4.3 תרגיל סוללה לילה: ירי פצצות תאורה (תאורן)',
    briefing: 'חשיכה מוחלטת בגזרה. הזמן מטח תאורה (illum) במפת האש [M] והשמד 4 רחפנים.',
    description: 'הזמן פצצת תאורה (illum) ל-(0, -95) והשמד 4 מטרות אויב.',
    targetCount: 2,
    moneyReward: 260,
    scoreReward: 260,
    daysAdvance: 13,
    forceTimeOfDay: 22.0,
    markerPos: { x: 0, z: -400 },
    objectives: [
      {
        id: 'ch4_m3_seq',
        type: 'sequence',
        label: 'הארת גזרה וחיסול מטרות',
        targetCount: 2,
        subObjectives: [
          {
            id: 'ch4_m3_illum',
            type: 'call-fire',
            label: 'הזמן מטח פצצות תאורה (illum) [M]',
            targetCount: 1,
            shellType: 'illum',
            points: [{ x: 0, z: -418, radius: 28, label: 'שטח האש הצפוני' }]
          },
          {
            id: 'ch4_m3_drones',
            type: 'destroy-drones',
            label: 'השמד 4 מטרות/רחפני אויב',
            targetCount: 4,
            waveDrones: 4,
            entityGroup: 'drones'
          }
        ]
      }
    ]
  },
  ch4_m4_combined_loop: {
    id: 'ch4_m4_combined_loop',
    chapterId: 'ch4_mitkadem',
    order: 4,
    roleId: 'all',
    title: '4.4 סגירת מעגל אש משולבת: רוכ"ש ← מפי"ק ← תומ"ת',
    briefing: 'קבל איכון מרכס הרוכ"ש, אשר במפי"ק והנחת 2 מטחי סוללה במפת האש [M].',
    description: 'רוכ"ש (-42,-62) ← מפי"ק (-18,-24) ← 2 מטחי סוללה [M].',
    targetCount: 3,
    moneyReward: 280,
    scoreReward: 300,
    daysAdvance: 13,
    markerPos: LANDMARKS.uavLaunch,
    objectives: [
      {
        id: 'ch4_m4_seq',
        type: 'sequence',
        label: 'מעגל אש רב-מערכי',
        targetCount: 3,
        subObjectives: [
          {
            id: 'ch4_m4_uav',
            type: 'interact',
            label: 'קבל איכון במנחת הרוכ"ש [E]',
            targetCount: 1,
            points: [{ x: -100, z: -330, radius: 4.5, label: 'רכס הרוכ"ש' }]
          },
          {
            id: 'ch4_m4_mafik',
            type: 'interact',
            label: 'אשר נתוני ירי במפי"ק [E]',
            targetCount: 1,
            points: [{ x: -56, z: -261, radius: 4.5, label: 'מפי"ק' }]
          },
          {
            id: 'ch4_m4_fire',
            type: 'call-fire',
            label: 'הנחת 2 מטחי סוללה נפיצים [M]',
            targetCount: 2,
            shellType: 'he'
          }
        ]
      }
    ]
  },
  ch4_m5_doher_barrage: {
    id: 'ch4_m5_doher_barrage',
    chapterId: 'ch4_mitkadem',
    order: 5,
    roleId: 'doher',
    title: '4.5א תרגיל ירי חי מסכם ("דוהר"): מטח סוללתי רציף',
    briefing: 'העמס 4 פגזי 155 מ"מ, הנחת מטח ארטילרי [M] והדוף 2 רחפנים.',
    description: 'טעינת 4 פגזים, מטח ארטילרי [M] ויירוט 2 רחפנים.',
    targetCount: 3,
    moneyReward: 320,
    scoreReward: 350,
    daysAdvance: 13,
    markerPos: LANDMARKS.shellPile,
    objectives: [
      {
        id: 'ch4_doher_carry',
        type: 'carry',
        label: 'העמס 4 פגזי 155 מ"מ לדוהר [E]',
        targetCount: 4,
        carryItem: 'shell',
        points: [LANDMARKS.shellPile, LANDMARKS.doherPos]
      },
      {
        id: 'ch4_doher_fire',
        type: 'call-fire',
        label: 'הנחת מטח ארטילרי כבד [M]',
        targetCount: 1,
        shellType: 'he'
      },
      {
        id: 'ch4_doher_drones',
        type: 'destroy-drones',
        label: 'הדוף 2 רחפני אויב',
        targetCount: 2,
        waveDrones: 2,
        entityGroup: 'drones'
      }
    ]
  },
  ch4_m5_roem_shoot_scoot: {
    id: 'ch4_m5_roem_shoot_scoot',
    chapterId: 'ch4_mitkadem',
    order: 5,
    roleId: 'roem',
    title: '4.5ב תרגיל ירי חי מסכם ("רועם"): ירי בתנועה ודילוג מהיר',
    briefing: 'פגע ב-6 מטרות אש ממוחשבות ודלג לעמדת המסתור (0, 10) תוך 40 שניות!',
    description: '6 מטרות אש ודילוג ל-(0, 10) תוך 40 שניות.',
    targetCount: 2,
    moneyReward: 320,
    scoreReward: 350,
    daysAdvance: 13,
    markerPos: LANDMARKS.roemPos,
    objectives: [
      {
        id: 'ch4_roem_timed',
        type: 'timed',
        label: 'ירי ודילוג תוך 40 שניות',
        timeLimitSec: 40,
        targetCount: 2,
        subObjectives: [
          {
            id: 'ch4_roem_shoot',
            type: 'shoot-targets',
            label: 'פגע ב-6 מטרות אש רועם',
            targetCount: 6,
            entityGroup: 'roemTargets'
          },
          {
            id: 'ch4_roem_scoot',
            type: 'reach',
            label: 'דלג לעמדת המסתור (0, 10)',
            targetCount: 1,
            points: [{ x: 44, z: -268, radius: 5, label: 'עמדת מסתור' }]
          }
        ]
      }
    ]
  },
  ch4_m5_rokhash_laser_guide: {
    id: 'ch4_m5_rokhash_laser_guide',
    chapterId: 'ch4_mitkadem',
    order: 5,
    roleId: 'rokhash',
    title: '4.5ג תרגיל ירי חי מסכם ("רוכ"ש"): הכוונת אש מדויקת מהאוויר',
    briefing: 'שגר סקיילרק מרכס התצפית, השמד 3 משדרים והכוון 2 מטחי אש [M].',
    description: 'שיגור מ-(-42,-62), השמדת 3 משדרים ו-2 מטחי אש [M].',
    targetCount: 3,
    moneyReward: 320,
    scoreReward: 350,
    daysAdvance: 13,
    markerPos: LANDMARKS.uavLaunch,
    objectives: [
      {
        id: 'ch4_rokhash_launch',
        type: 'interact',
        label: 'שגר סקיילרק מרכס התצפית [E]',
        targetCount: 1,
        points: [{ x: -100, z: -330, radius: 4.5, label: 'מנחת סקיילרק' }]
      },
      {
        id: 'ch4_rokhash_tx',
        type: 'destroy-drones',
        label: 'השמד 3 משדרים בגבול',
        targetCount: 3,
        entityGroup: 'transmitters'
      },
      {
        id: 'ch4_rokhash_fire',
        type: 'call-fire',
        label: 'הכוון 2 מטחי אש ארטילריים [M]',
        targetCount: 2,
        shellType: 'he'
      }
    ]
  },
  ch4_m5_mafik_counter_battery: {
    id: 'ch4_m5_mafik_counter_battery',
    chapterId: 'ch4_mitkadem',
    order: 5,
    roleId: 'mafik',
    title: '4.5ד תרגיל ירי חי מסכם ("מפי"ק/ר"ז"): אש נגד-סוללה',
    briefing: 'כייל 3 אנטנות תוך 50 שניות, יירט 3 רחפנים והנחת מטח נגד-סוללה [M].',
    description: 'כיול 3 אנטנות, יירוט 3 רחפנים ומטח נפיץ [M] ב-50 שניות.',
    targetCount: 3,
    moneyReward: 320,
    scoreReward: 350,
    daysAdvance: 13,
    markerPos: LANDMARKS.mafikPos,
    objectives: [
      {
        id: 'ch4_mafik_timed',
        type: 'timed',
        label: 'אש נגד-סוללה תוך 50 שניות',
        timeLimitSec: 50,
        targetCount: 3,
        subObjectives: [
          {
            id: 'ch4_mafik_dishes',
            type: 'interact',
            label: 'כייל 3 אנטנות מכ"ם ר"ז [E]',
            targetCount: 3,
            entityGroup: 'radarDishes',
            points: [
              { x: -56, z: -261, radius: 4.5, label: 'אנטנה 1' },
              { x: -60, z: -258, radius: 4.5, label: 'אנטנה 2' },
              { x: -52, z: -258, radius: 4.5, label: 'אנטנה 3' }
            ]
          },
          {
            id: 'ch4_mafik_drones',
            type: 'destroy-drones',
            label: 'יירט 3 רחפנים תוקפים',
            targetCount: 3,
            waveDrones: 3,
            entityGroup: 'drones'
          },
          {
            id: 'ch4_mafik_fire',
            type: 'call-fire',
            label: 'הנחת מטח נגד-סוללה [M]',
            targetCount: 1,
            shellType: 'he'
          }
        ]
      }
    ]
  },
  ch4_m6_fighter_pin_ceremony: {
    id: 'ch4_m6_fighter_pin_ceremony',
    chapterId: 'ch4_mitkadem',
    order: 6,
    roleId: 'all',
    title: '4.6 טקס סיום מסלול והענקת סיכת לוחם תותחנים',
    briefing: '8 חודשי הכשרה הסתיימו! התייצב ברחבה ומול מפקד הגדוד לקבלת סיכת הלוחם ודרגת רב"ט.',
    description: 'התייצב ברחבת המסדרים (0, 18) וקבל סיכת לוחם ב-(-12, -22).',
    targetCount: 2,
    moneyReward: 300,
    scoreReward: 350,
    daysAdvance: 12,
    markerPos: LANDMARKS.spawn,
    unlocks: { ceremony: 'fighterPin', rankId: 'rabat', chapterId: 'ch5_kav' },
    objectives: [
      {
        id: 'ch4_m6_seq',
        type: 'sequence',
        label: 'טקס הענקת סיכת לוחם',
        targetCount: 2,
        subObjectives: [
          {
            id: 'ch4_m6_parade',
            type: 'reach',
            label: 'התייצב ברחבת המסדרים',
            targetCount: 1,
            points: [{ x: 0, z: 18, radius: 4.5, label: 'רחבת המסדרים' }]
          },
          {
            id: 'ch4_m6_pin',
            type: 'interact',
            label: 'קבל סיכת לוחם ליד תורן הדגל [E]',
            targetCount: 1,
            points: [{ x: -12, z: -22, radius: 5, label: 'במת הטקס' }]
          }
        ]
      }
    ]
  },

  patrol: {
    id: 'patrol',
    chapterId: 'ch5_kav',
    order: 1,
    roleId: 'all',
    title: '4. שמירה וסיור במוצב הקו',
    briefing: 'סור ב-4 נקודות הביקורת במוצב הצפוני והשמד רחפני אויב תוקפים.',
    description: 'סור ב-4 נקודות הביקורת במוצב הצפוני והשמד רחפני אויב תוקפים.',
    targetCount: 4,
    moneyReward: 350,
    scoreReward: 400,
    daysAdvance: 40,
    markerPos: LANDMARKS.outpostCenter,
    objectives: [
      {
        id: 'patrol_reach',
        type: 'reach',
        label: 'סור ב-4 נקודות הביקורת במוצב צוקית',
        targetCount: 4,
        points: [
          { x: -14, z: -376, radius: 4.5, label: 'עמדה מערבית' },
          { x: 14, z: -376, radius: 4.5, label: 'עמדה מזרחית' },
          { x: 14, z: -406, radius: 4.5, label: 'תצפית צפון-מזרח' },
          { x: -14, z: -406, radius: 4.5, label: 'תצפית צפון-מערב' }
        ]
      }
    ]
  },
  ch5_m2_night_amral_guard: {
    id: 'ch5_m2_night_amral_guard',
    chapterId: 'ch5_kav',
    order: 2,
    roleId: 'all',
    title: '5.2 שמירת לילה עם אמר"ל בבונקר הצפוני',
    briefing: 'לילה ערפילי במוצב צוקית. הגן על המגדל ל-45 שניות והשמד 5 רחפני אויב מתגנבים.',
    description: 'הגן על (0, -117) ל-45 שניות והשמד 5 רחפנים.',
    targetCount: 2,
    moneyReward: 320,
    scoreReward: 350,
    daysAdvance: 40,
    forceTimeOfDay: 22.5,
    markerPos: { x: 0, z: -407 },
    objectives: [
      {
        id: 'ch5_m2_defend',
        type: 'defend',
        label: 'הגן על מגדל התצפית (45 ש׳)',
        targetCount: 45,
        holdDurationSec: 45,
        points: [{ x: 0, z: -407, radius: 12, label: 'הבונקר הצפוני' }]
      },
      {
        id: 'ch5_m2_drones',
        type: 'destroy-drones',
        label: 'השמד 5 רחפנים בלילה',
        targetCount: 5,
        waveDrones: 5,
        entityGroup: 'drones'
      }
    ]
  },
  ch5_m3_dawn_alert_deploy: {
    id: 'ch5_m3_dawn_alert_deploy',
    chapterId: 'ch5_kav',
    order: 3,
    roleId: 'all',
    title: '5.3 "כוננות עם שחר": הקפצת סוללה לקו מגע',
    briefing: '05:15 — התרעת חדירה! הבא תחמושת לעמדת הירי הצפונית והדוף 3 רחפנים תוך 50 שניות.',
    description: 'העבר ארגז תחמושת ל-(0, -82) והשמד 3 רחפנים תוך 50 שניות.',
    targetCount: 2,
    moneyReward: 340,
    scoreReward: 360,
    daysAdvance: 40,
    forceTimeOfDay: 5.25,
    markerPos: { x: -22, z: -281 },
    objectives: [
      {
        id: 'ch5_m3_timed',
        type: 'timed',
        label: 'כוננות עם שחר תוך 50 שניות',
        timeLimitSec: 50,
        targetCount: 2,
        subObjectives: [
          {
            id: 'ch5_m3_ammo',
            type: 'carry',
            label: 'הבא ארגז תחמושת לעמדה (0, -82) [E]',
            targetCount: 1,
            carryItem: 'ammoCrate',
            points: [
              { x: -22, z: -281, radius: 4, label: 'מצבור תחמושת' },
              { x: 0, z: -374, radius: 5, label: 'עמדת ירי צפונית' }
            ]
          },
          {
            id: 'ch5_m3_drones',
            type: 'destroy-drones',
            label: 'יירט 3 רחפני חדירה',
            targetCount: 3,
            waveDrones: 3,
            entityGroup: 'drones'
          }
        ]
      }
    ]
  },
  ch5_m4_fire_mission_assist: {
    id: 'ch5_m4_fire_mission_assist',
    chapterId: 'ch5_kav',
    order: 4,
    roleId: 'all',
    title: '5.4 סיוע אש לכוח מתמרן ("קודקוד בזלת, כאן סופה")',
    briefing: 'כוח חי"ר מבקש סיוע דחוף! הנחת מטח מיסוך (smoke) ו-2 מטחי נפיץ (he) במפת האש [M].',
    description: 'מטח מיסוך (smoke) ל-(-25,-118) ו-2 מטחי נפיץ (he) ל-(20,-120).',
    targetCount: 2,
    moneyReward: 360,
    scoreReward: 380,
    daysAdvance: 40,
    markerPos: LANDMARKS.outpostCenter,
    objectives: [
      {
        id: 'ch5_m4_seq',
        type: 'sequence',
        label: 'משימת סיוע אש לכוח מתמרן',
        targetCount: 2,
        subObjectives: [
          {
            id: 'ch5_m4_smoke',
            type: 'call-fire',
            label: 'הנחת מטח מיסוך (smoke) [M]',
            targetCount: 1,
            shellType: 'smoke',
            points: [{ x: -30, z: -408, radius: 30, label: 'ציר חילוץ' }]
          },
          {
            id: 'ch5_m4_he',
            type: 'call-fire',
            label: 'הנחת 2 מטחי נפיץ (he) [M]',
            targetCount: 2,
            shellType: 'he',
            points: [{ x: 20, z: -410, radius: 30, label: 'ריכוז אויב' }]
          }
        ]
      }
    ]
  },
  ch5_m5_doher_danger_close: {
    id: 'ch5_m5_doher_danger_close',
    chapterId: 'ch5_kav',
    order: 5,
    roleId: 'doher',
    title: '5.5א ("דוהר"): אש בכינון ישיר ממוצב הקו',
    briefing: 'האויב מתקרב לגדר! טען 4 פגזי 155 מ"מ לדוהר והשמד 4 רחפני תקיפה משוריינים.',
    description: 'טעינת 4 פגזים לדוהר והשמדת 4 רחפנים.',
    targetCount: 2,
    moneyReward: 380,
    scoreReward: 420,
    daysAdvance: 40,
    markerPos: LANDMARKS.shellPile,
    objectives: [
      {
        id: 'ch5_doher_shells',
        type: 'carry',
        label: 'טען 4 פגזי 155 מ"מ לדוהר [E]',
        targetCount: 4,
        carryItem: 'shell',
        points: [LANDMARKS.shellPile, LANDMARKS.doherPos]
      },
      {
        id: 'ch5_doher_drones',
        type: 'destroy-drones',
        label: 'השמד 4 רחפני תקיפה',
        targetCount: 4,
        waveDrones: 4,
        entityGroup: 'drones'
      }
    ]
  },
  ch5_m5_roem_convoy_fire: {
    id: 'ch5_m5_roem_convoy_fire',
    chapterId: 'ch5_kav',
    order: 5,
    roleId: 'roem',
    title: '5.5ב ("רועם"): חיפוי אש אוטומטי לשיירת אספקה',
    briefing: 'פגע ב-8 מטרות אויב ב"רועם" תוך 45 שניות והנחת מטח חיפוי [M].',
    description: '8 מטרות רועם ב-45 ש׳ ומטח חיפוי נפיץ [M].',
    targetCount: 2,
    moneyReward: 380,
    scoreReward: 420,
    daysAdvance: 40,
    markerPos: LANDMARKS.roemPos,
    objectives: [
      {
        id: 'ch5_roem_shoot',
        type: 'shoot-targets',
        label: 'פגע ב-8 מטרות רועם תוך 45 ש׳',
        targetCount: 8,
        timeLimitSec: 45,
        entityGroup: 'roemTargets'
      },
      {
        id: 'ch5_roem_fire',
        type: 'call-fire',
        label: 'הנחת מטח חיפוי [M]',
        targetCount: 1,
        shellType: 'he'
      }
    ]
  },
  ch5_m5_rokhash_deep_hunt: {
    id: 'ch5_m5_rokhash_deep_hunt',
    chapterId: 'ch5_kav',
    order: 5,
    roleId: 'rokhash',
    title: '5.5ג ("רוכ"ש"): ציד משדרים מעבר לגדר הגבול',
    briefing: 'שגר סקיילרק מרכס התצפית, השמד 4 משדרי שיבוש והכוון מטח ארטילרי [M].',
    description: 'שיגור מ-(-42,-62), השמדת 4 משדרים ומטח נפיץ [M].',
    targetCount: 3,
    moneyReward: 380,
    scoreReward: 420,
    daysAdvance: 40,
    markerPos: LANDMARKS.uavLaunch,
    objectives: [
      {
        id: 'ch5_rokhash_launch',
        type: 'interact',
        label: 'שגר סקיילרק מרכס התצפית [E]',
        targetCount: 1,
        points: [{ x: -100, z: -330, radius: 4.5, label: 'מנחת סקיילרק' }]
      },
      {
        id: 'ch5_rokhash_tx',
        type: 'destroy-drones',
        label: 'השמד 4 משדרי שיבוש',
        targetCount: 4,
        entityGroup: 'transmitters'
      },
      {
        id: 'ch5_rokhash_fire',
        type: 'call-fire',
        label: 'הכוון מטח ארטילרי [M]',
        targetCount: 1,
        shellType: 'he'
      }
    ]
  },
  ch5_m5_mafik_jam_swarm: {
    id: 'ch5_m5_mafik_jam_swarm',
    chapterId: 'ch5_kav',
    order: 5,
    roleId: 'mafik',
    title: '5.5ד ("מפי"ק/ר"ז"): בלימת נחיל רחפנים ואיכון משגרים',
    briefing: 'נחיל רחפנים תוקף את המכ"ם! כייל 3 אנטנות והשמד 6 רחפנים.',
    description: 'כיול 3 אנטנות במפי"ק והשמדת 6 רחפנים.',
    targetCount: 2,
    moneyReward: 380,
    scoreReward: 420,
    daysAdvance: 40,
    markerPos: LANDMARKS.mafikPos,
    objectives: [
      {
        id: 'ch5_mafik_dishes',
        type: 'interact',
        label: 'כייל 3 אנטנות מכ"ם [E]',
        targetCount: 3,
        entityGroup: 'radarDishes',
        points: [
          { x: -56, z: -261, radius: 4.5, label: 'אנטנה 1' },
          { x: -60, z: -258, radius: 4.5, label: 'אנטנה 2' },
          { x: -52, z: -258, radius: 4.5, label: 'אנטנה 3' }
        ]
      },
      {
        id: 'ch5_mafik_drones',
        type: 'destroy-drones',
        label: 'השמד נחיל של 6 רחפנים',
        targetCount: 6,
        waveDrones: 6,
        entityGroup: 'drones'
      }
    ]
  },
  ch5_m6_heavy_outpost_defense: {
    id: 'ch5_m6_heavy_outpost_defense',
    chapterId: 'ch5_kav',
    order: 6,
    roleId: 'all',
    title: '5.6 קרב הגנה רב-זירתי על "מוצב צוקית"',
    briefing: 'שיא סבב הקו! הגן על מוצב צוקית 60 שניות, השמד 6 רחפנים והנחת 2 מטחי אש [M].',
    description: 'הגנה 60 ש׳ ב-(0,-102), 6 הפלות ו-2 מטחי אש [M].',
    targetCount: 3,
    moneyReward: 450,
    scoreReward: 500,
    daysAdvance: 40,
    markerPos: LANDMARKS.outpostCenter,
    unlocks: { rankId: 'samal', roleId: 'moran', chapterId: 'ch6_mefakzim' },
    objectives: [
      {
        id: 'ch5_m6_defend',
        type: 'defend',
        label: 'החזק במוצב צוקית (60 ש׳)',
        targetCount: 60,
        holdDurationSec: 60,
        points: [{ x: 0, z: -392, radius: 22, label: 'מוצב צוקית' }]
      },
      {
        id: 'ch5_m6_drones',
        type: 'destroy-drones',
        label: 'השמד 6 כלי טיס עוינים',
        targetCount: 6,
        waveDrones: 6,
        entityGroup: 'drones'
      },
      {
        id: 'ch5_m6_fire',
        type: 'call-fire',
        label: 'הנחת 2 מטחי סוללה [M]',
        targetCount: 2,
        shellType: 'he'
      }
    ]
  },

  ch6_m1_command_entry: {
    id: 'ch6_m1_command_entry',
    chapterId: 'ch6_mefakzim',
    order: 1,
    roleId: 'all',
    title: '6.1 כניסה לענף הפיקוד בשבטה ובוחן כניסה',
    briefing: 'חזרת לשבטה כצוער בקורס מפק"ץ! השלם מטווח מדויק של 8 מטרות ב-40 שניות.',
    description: 'פגע ב-8 מטרות מטווח תוך 40 שניות.',
    targetCount: 8,
    moneyReward: 250,
    scoreReward: 280,
    daysAdvance: 30,
    markerPos: LANDMARKS.rangeConsole,
    objectives: [
      {
        id: 'ch6_m1_timed',
        type: 'timed',
        label: 'בוחן כניסה למפק"ץ ב-40 שניות',
        timeLimitSec: 40,
        targetCount: 1,
        subObjectives: [
          {
            id: 'ch6_m1_shoot',
            type: 'shoot-targets',
            label: 'פגע ב-8 מטרות מטווח',
            targetCount: 8,
            entityGroup: 'rangeTargets',
            points: [LANDMARKS.rangeConsole]
          }
        ]
      }
    ]
  },
  ch6_m2_solo_night_nav: {
    id: 'ch6_m2_solo_night_nav',
    chapterId: 'ch6_mefakzim',
    order: 2,
    roleId: 'all',
    title: '6.2 ניווט בדד לילי בגבעות שבטה',
    briefing: 'עבור ב-4 נקודות ציון מרוחקות בחשיכה ללא חשיפה לרחפני הבקרה.',
    description: 'עבור ב-4 נקודות ניווט בלילה מבלי להתגלות לרחפנים.',
    targetCount: 4,
    moneyReward: 280,
    scoreReward: 300,
    daysAdvance: 30,
    forceTimeOfDay: 23.0,
    markerPos: { x: -42, z: -62 },
    objectives: [
      {
        id: 'ch6_m2_stealth',
        type: 'stealth',
        label: 'ניווט בדד חשאי ב-4 נקודות ציון',
        targetCount: 4,
        holdDurationSec: 5,
        maxDetectionRadius: 13,
        points: [
          { x: -42, z: -62, radius: 5, label: 'נ"צ 1' },
          { x: 38, z: -70, radius: 5, label: 'נ"צ 2' },
          { x: -35, z: -110, radius: 5, label: 'נ"צ 3' },
          { x: 28, z: -95, radius: 5, label: 'נ"צ 4' }
        ]
      }
    ]
  },
  ch6_m3_run_recruit_range: {
    id: 'ch6_m3_run_recruit_range',
    chapterId: 'ch6_mefakzim',
    order: 3,
    roleId: 'all',
    title: '6.3 פיקוד על כיתת טירונים במטווח ובביצורים',
    briefing: 'הפעם אתה המפקד! בדוק 3 עמדות טירונים בשער, הבא תחמושת למטווח והדגם 6 פגיעות.',
    description: 'בדיקת 3 עמדות בשער, הבאת תחמושת למטווח והדגמת 6 פגיעות.',
    targetCount: 3,
    moneyReward: 300,
    scoreReward: 320,
    daysAdvance: 30,
    markerPos: { x: 0, z: -31 },
    objectives: [
      {
        id: 'ch6_m3_seq',
        type: 'sequence',
        label: 'פיקוד והדגמה במטווח',
        targetCount: 3,
        subObjectives: [
          {
            id: 'ch6_m3_check',
            type: 'interact',
            label: 'בדוק 3 עמדות טירונים בשער הצפוני [E]',
            targetCount: 3,
            points: [
              { x: -9, z: -31, radius: 4.5, label: 'עמדה מערבית' },
              { x: 0, z: -31, radius: 4.5, label: 'ש"ג מרכזי' },
              { x: 9, z: -31, radius: 4.5, label: 'עמדה מזרחית' }
            ]
          },
          {
            id: 'ch6_m3_ammo',
            type: 'carry',
            label: 'הבא ארגז תחמושת לעמדת המטווח [E]',
            targetCount: 1,
            carryItem: 'ammoCrate',
            points: [
              { x: 12, z: 18, radius: 4, label: 'אפסנאות תחמושת' },
              { x: 49.5, z: 0, radius: 5, label: 'עמדת המטווח' }
            ]
          },
          {
            id: 'ch6_m3_shoot',
            type: 'shoot-targets',
            label: 'הדגם פגיעה ב-6 מטרות ב-45 ש׳',
            targetCount: 6,
            timeLimitSec: 45,
            entityGroup: 'rangeTargets',
            points: [LANDMARKS.rangeConsole]
          }
        ]
      }
    ]
  },
  ch6_m4_kasha_fire_plan: {
    id: 'ch6_m4_kasha_fire_plan',
    chapterId: 'ch6_mefakzim',
    order: 4,
    roleId: 'all',
    title: '6.4 תרגיל קש"א: תוכנית אש רב-שלבית',
    briefing: 'עלה לרכס התצפית והנחת סדרת אש מתוזמנת: תאורה, מיסוך ו-2 מטחי נפיץ [M].',
    description: 'הגעה ל-(-42,-62) ← מטח תאורה ← מטח מיסוך ← 2 מטחי נפיץ.',
    targetCount: 4,
    moneyReward: 320,
    scoreReward: 350,
    daysAdvance: 30,
    markerPos: { x: -42, z: -62 },
    objectives: [
      {
        id: 'ch6_m4_seq',
        type: 'sequence',
        label: 'תוכנית אש קש"א מלאה',
        targetCount: 4,
        subObjectives: [
          {
            id: 'ch6_m4_ridge',
            type: 'reach',
            label: 'עלה לעמדת התצפית ברכס',
            targetCount: 1,
            points: [{ x: -42, z: -62, radius: 5, label: 'רכס התצפית' }]
          },
          {
            id: 'ch6_m4_illum',
            type: 'call-fire',
            label: 'הנחת מטח תאורה (illum) [M]',
            targetCount: 1,
            shellType: 'illum'
          },
          {
            id: 'ch6_m4_smoke',
            type: 'call-fire',
            label: 'הנחת מטח מיסוך (smoke) [M]',
            targetCount: 1,
            shellType: 'smoke'
          },
          {
            id: 'ch6_m4_he',
            type: 'call-fire',
            label: 'הנחת 2 מטחי נפיץ (he) [M]',
            targetCount: 2,
            shellType: 'he'
          }
        ]
      }
    ]
  },
  ch6_m5_battery_crisis_sim: {
    id: 'ch6_m5_battery_crisis_sim',
    chapterId: 'ch6_mefakzim',
    order: 5,
    roleId: 'all',
    title: '6.5 פיקוד על סוללה תחת מתקפת פתע',
    briefing: 'מבחן מנהיגות תחת לחץ! כייל 3 עמדות, השמד 5 רחפנים והנחת מטח תוך 70 שניות.',
    description: 'כיול 3 עמדות, 5 רחפנים ומטח סוללתי תוך 70 שניות.',
    targetCount: 3,
    moneyReward: 380,
    scoreReward: 400,
    daysAdvance: 30,
    markerPos: { x: 19, z: 18 },
    objectives: [
      {
        id: 'ch6_m5_timed',
        type: 'timed',
        label: 'פיקוד סוללה תחת לחץ ב-70 ש׳',
        timeLimitSec: 70,
        targetCount: 3,
        subObjectives: [
          {
            id: 'ch6_m5_pos',
            type: 'interact',
            label: 'דלג וכייל 3 עמדות סוללה [E]',
            targetCount: 3,
            points: [
              { x: 19, z: 18, radius: 4.5, label: 'עמדת דוהר' },
              { x: 19, z: 28, radius: 4.5, label: 'עמדת רועם' },
              { x: -18, z: -24, radius: 4.5, label: 'מפי"ק' }
            ]
          },
          {
            id: 'ch6_m5_drones',
            type: 'destroy-drones',
            label: 'השמד 5 רחפנים תוקפים',
            targetCount: 5,
            waveDrones: 5,
            entityGroup: 'drones'
          },
          {
            id: 'ch6_m5_fire',
            type: 'call-fire',
            label: 'הנחת מטח סוללתי [M]',
            targetCount: 1,
            shellType: 'he'
          }
        ]
      }
    ]
  },
  ch6_m6_command_graduation: {
    id: 'ch6_m6_command_graduation',
    chapterId: 'ch6_mefakzim',
    order: 6,
    roleId: 'all',
    title: '6.6 מסע מפק"ץ וטקס הענקת סיכת מפקד צוות',
    briefing: 'השלמת את קורס המפקדים! צעד ממוצב הקו חזרה לשבטה וקבל את סיכת המפק"ץ.',
    description: 'צעדה מ-(0,-102) לרחבת המסדרים וטקס קבלת הסיכה ב-(-12,-22).',
    targetCount: 2,
    moneyReward: 400,
    scoreReward: 450,
    daysAdvance: 30,
    markerPos: LANDMARKS.outpostCenter,
    unlocks: { ceremony: 'commanderPin', roleId: 'kachaz', chapterId: 'ch7_shihrur' },
    objectives: [
      {
        id: 'ch6_m6_seq',
        type: 'sequence',
        label: 'מסע מפק"ץ וטקס הענקת סיכה',
        targetCount: 2,
        subObjectives: [
          {
            id: 'ch6_m6_march',
            type: 'reach',
            label: 'צעד ממוצב צוקית לרחבת המסדרים',
            targetCount: 2,
            points: [
              { x: 0, z: -392, radius: 6, label: 'מוצב צוקית' },
              { x: 0, z: 18, radius: 5, label: 'רחבת המסדרים' }
            ]
          },
          {
            id: 'ch6_m6_pin',
            type: 'interact',
            label: 'קבל את סיכת המפק"ץ בבמת הטקס [E]',
            targetCount: 1,
            points: [{ x: -12, z: -22, radius: 5, label: 'במת הטקס' }]
          }
        ]
      }
    ]
  },

  ch7_m1_mentor_recruits: {
    id: 'ch7_m1_mentor_recruits',
    chapterId: 'ch7_shihrur',
    order: 1,
    roleId: 'all',
    title: '7.1 חפיפת מחזור צעירים בסוללה (ותיקי הסמ"ר)',
    briefing: 'הפז"ם דופק — אתה כבר סמ"ר! עבור בין 4 עמדות האמל"ח והעבר חפיפה ללוחמים החדשים.',
    description: 'העבר חפיפה ב-4 עמדות האמל"ח [E].',
    targetCount: 4,
    moneyReward: 300,
    scoreReward: 300,
    daysAdvance: 30,
    markerPos: LANDMARKS.doherPos,
    unlocks: { rankId: 'samar', roleId: 'zik' },
    objectives: [
      {
        id: 'ch7_m1_mentor',
        type: 'interact',
        label: 'חפוף 4 צוותים בעמדות האמל"ח [E]',
        targetCount: 4,
        points: [
          { x: -6, z: -290, radius: 4.5, label: 'צוות דוהר' },
          { x: 58, z: -282, radius: 4.5, label: 'צוות רועם' },
          { x: -56, z: -261, radius: 4.5, label: 'צוות מפי"ק' },
          { x: -100, z: -330, radius: 4.5, label: 'צוות רוכ"ש' }
        ]
      }
    ]
  },
  ch7_m2_brigade_war_drill: {
    id: 'ch7_m2_brigade_war_drill',
    chapterId: 'ch7_shihrur',
    order: 2,
    roleId: 'all',
    title: '7.2 תרגיל עוצבתי רב-מערכי בגזרה הצפונית',
    briefing: 'כל האגד באוויר ובקרקע! הגע למוצב הקו, השמד 4 משדרים והנחת 3 מטחי אש [M].',
    description: 'מוצב הקו (0,-102) ← 4 משדרים ← 3 מטחי אש עוצבתיים.',
    targetCount: 3,
    moneyReward: 400,
    scoreReward: 450,
    daysAdvance: 35,
    markerPos: LANDMARKS.outpostCenter,
    objectives: [
      {
        id: 'ch7_m2_seq',
        type: 'sequence',
        label: 'תרגיל עוצבתי רב-מערכי',
        targetCount: 3,
        subObjectives: [
          {
            id: 'ch7_m2_reach',
            type: 'reach',
            label: 'הגע למוצב הקו הצפוני',
            targetCount: 1,
            points: [{ x: 0, z: -392, radius: 6, label: 'מוצב צוקית' }]
          },
          {
            id: 'ch7_m2_tx',
            type: 'destroy-drones',
            label: 'השמד 4 משדרי אויב בגבול',
            targetCount: 4,
            entityGroup: 'transmitters'
          },
          {
            id: 'ch7_m2_fire',
            type: 'call-fire',
            label: 'הנחת 3 מטחי אש עוצבתיים [M]',
            targetCount: 3,
            shellType: 'he'
          }
        ]
      }
    ]
  },
  ch7_m3_final_night_barrage: {
    id: 'ch7_m3_final_night_barrage',
    chapterId: 'ch7_shihrur',
    order: 3,
    roleId: 'all',
    title: '7.3 לילה אחרון בקו: בלימת מתקפת נחילי אויב',
    briefing: 'הלילה האחרון במוצב צוקית! הגן על המוצב 75 שניות, השמד 8 רחפנים והנחת 2 מטחים [M].',
    description: 'הגנה 75 ש׳ במוצב, 8 הפלות רחפנים ו-2 מטחי אש [M].',
    targetCount: 3,
    moneyReward: 500,
    scoreReward: 600,
    daysAdvance: 35,
    forceTimeOfDay: 23.0,
    markerPos: LANDMARKS.outpostCenter,
    objectives: [
      {
        id: 'ch7_m3_defend',
        type: 'defend',
        label: 'בלום מתקפה במוצב צוקית (75 ש׳)',
        targetCount: 75,
        holdDurationSec: 75,
        points: [{ x: 0, z: -392, radius: 24, label: 'מוצב צוקית' }]
      },
      {
        id: 'ch7_m3_drones',
        type: 'destroy-drones',
        label: 'הדוף 8 רחפני אויב',
        targetCount: 8,
        waveDrones: 8,
        entityGroup: 'drones'
      },
      {
        id: 'ch7_m3_fire',
        type: 'call-fire',
        label: 'הנחת 2 מטחי אש [M]',
        targetCount: 2,
        shellType: 'he'
      }
    ]
  },
  ch7_m4_quartermaster_return: {
    id: 'ch7_m4_quartermaster_return',
    chapterId: 'ch7_shihrur',
    order: 4,
    roleId: 'all',
    title: '7.4 טופס טיולים יוצא: הזדכות על ציוד באפסנאות',
    briefing: 'חוזרים לבסיס האם! החזר 3 ארגזי ציוד לאפסנאי וקבל חתימה בטופס הטיולים.',
    description: 'החזר 3 ארגזי ציוד לאפסנאות (17.2, -14) וקבל חתימה.',
    targetCount: 2,
    moneyReward: 250,
    scoreReward: 300,
    daysAdvance: 30,
    markerPos: { x: 12, z: 18 },
    objectives: [
      {
        id: 'ch7_m4_seq',
        type: 'sequence',
        label: 'הזדכות באפסנאות',
        targetCount: 2,
        subObjectives: [
          {
            id: 'ch7_m4_crates',
            type: 'carry',
            label: 'החזר 3 ארגזי ציוד לאפסנאות [E]',
            targetCount: 3,
            carryItem: 'ammoCrate',
            points: [
              { x: 12, z: 18, radius: 4.5, label: 'עמדת האמל"ח' },
              { x: 17.2, z: -14, radius: 4.5, label: 'אפסנאות' }
            ]
          },
          {
            id: 'ch7_m4_sign',
            type: 'interact',
            label: 'קבל חתימת אפסנאי על טופס טיולים [E]',
            targetCount: 1,
            points: [{ x: 17.2, z: -14, radius: 4.5, label: 'אפסנאות' }]
          }
        ]
      }
    ]
  },
  ch7_m5_farewell_parade: {
    id: 'ch7_m5_farewell_parade',
    chapterId: 'ch7_shihrur',
    order: 5,
    roleId: 'all',
    title: '7.5 מסדר פרידה מהסוללה ושתיית שחרור בשק"ם',
    briefing: 'החברים בסוללה עורכים לך מסדר פרידה! היפרד מהמפקדים, מחברי הצוות והשק"מיסט.',
    description: 'היפרד ב-4 שיחות פרידה מהסוללה ומהשק"ם [E].',
    targetCount: 4,
    moneyReward: 250,
    scoreReward: 300,
    daysAdvance: 30,
    markerPos: { x: 0, z: 14 },
    objectives: [
      {
        id: 'ch7_m5_farewell',
        type: 'interact',
        label: 'היפרד מ-4 דמויות בסוללה ובשק"ם [E]',
        targetCount: 4,
        points: [
          { x: 0, z: 14, radius: 4.5, label: 'המפק"ץ' },
          { x: 6, z: 14, radius: 4.5, label: 'מפקד הסוללה' },
          { x: -12, z: -22, radius: 4.5, label: 'הרס"ר' },
          { x: -4, z: -16, radius: 4.5, label: 'שתיית שחרור בשק"ם' }
        ]
      }
    ]
  },
  ch7_m6_bakum_discharge: {
    id: 'ch7_m6_bakum_discharge',
    chapterId: 'ch7_shihrur',
    order: 6,
    roleId: 'all',
    title: '7.6 בקו"ם שחרור: גזירת חוגר ותעודת שחרור בכבוד!',
    briefing: '840 ימים חלפו! הפקד את הנשק בנשקייה, צעד לשער היציאה וקבל תעודת שחרור בכבוד!',
    description: 'הפקדת נשק בנשקייה (14, -8) והתייצבות בשער השחרור (0, 34).',
    targetCount: 3,
    moneyReward: 1000,
    scoreReward: 1000,
    daysAdvance: 19,
    targetDay: 840,
    markerPos: { x: 14, z: -8 },
    unlocks: { discharged: true },
    objectives: [
      {
        id: 'ch7_m6_seq',
        type: 'sequence',
        label: 'גזירת חוגר ושחרור בבקו"ם',
        targetCount: 3,
        subObjectives: [
          {
            id: 'ch7_m6_armory',
            type: 'interact',
            label: 'הזדכה על הנשק האישי בנשקייה [E]',
            targetCount: 1,
            points: [{ x: 14, z: -8, radius: 4.5, label: 'נשקייה' }]
          },
          {
            id: 'ch7_m6_gate',
            type: 'reach',
            label: 'צעד אל שער היציאה של הבסיס',
            targetCount: 1,
            points: [{ x: 0, z: 34, radius: 5, label: 'שער היציאה' }]
          },
          {
            id: 'ch7_m6_discharge',
            type: 'interact',
            label: 'גזור חוגר בעמדת השחרור בבקו"ם [E]',
            targetCount: 1,
            points: [{ x: 0, z: 34, radius: 5, label: 'עמדת השחרור' }]
          }
        ]
      }
    ]
  }
};
