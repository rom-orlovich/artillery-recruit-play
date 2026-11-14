export const TERRAIN_EXTENT = { minX: -300, maxX: 300, minZ: -520, maxZ: 160 };

export const REGIONS = {
  shivta: {
    id: 'shivta',
    name: 'מחנה שבטה — ביסל"ת',
    short: 'שבטה',
    rect: [-210, 210, -128, 100],
    travel: { x: 0, z: 24, yaw: 0 },
    mapColor: '#d3bc8f'
  },
  yoav: {
    id: 'yoav',
    name: 'מחנה יואב — כביש 978',
    short: 'מחנה יואב',
    rect: [-178, -48, -222, -128],
    travel: { x: -70, z: -178, yaw: Math.PI / 2 },
    mapColor: '#6c6656'
  },
  line: {
    id: 'line',
    name: 'קו הסוללה — רמת הגולן',
    short: 'קו הסוללה',
    rect: [-210, 210, -450, -128],
    travel: { x: -57, z: -244, yaw: -0.55 },
    mapColor: '#8f7f52'
  }
};

export const DESERT_EDGE_Z = { start: -108, end: -142 };

export const ROADS = [
  {
    kind: 'asphalt',
    width: 5,
    points: [[0, -30], [0, -70], [0, -104], [-4, -122], [-14, -140], [-28, -156], [-40, -170], [-46, -184], [-48, -202], [-52, -220], [-60, -238], [-78, -258], [-102, -288], [-118, -325], [-120, -370], [-110, -415], [-98, -470]]
  },
  { kind: 'asphalt', width: 6, points: [[0, 30], [0, 120]] },
  { kind: 'asphalt', width: 5, points: [[-46, -178], [-60, -178]] },
  { kind: 'dirt', width: 3.4, points: [[35, 0], [46, 0]] },
  { kind: 'dirt', width: 3, points: [[-4, -40], [16, -52], [28, -78], [12, -100]] },
  { kind: 'dirt', width: 3, points: [[-4, -44], [-26, -58], [-44, -84], [-38, -112]] },
  { kind: 'dirt', width: 3.4, points: [[-58, -234], [-36, -235], [-10, -232], [32, -229]] },
  { kind: 'dirt', width: 3.2, points: [[-6, -252], [-4, -276]] },
  { kind: 'dirt', width: 3.4, points: [[-84, -276], [-44, -283], [-6, -279], [32, -286], [84, -293], [122, -298], [160, -290], [190, -288]] },
  { kind: 'dirt', width: 3, points: [[30, -262], [48, -272], [58, -278]] },
  { kind: 'dirt', width: 3, points: [[-36, -235], [-50, -247], [-56, -256]] },
  { kind: 'dirt', width: 3, points: [[-22, -283], [-24, -320], [-10, -350], [0, -368]] },
  { kind: 'dirt', width: 3, points: [[-108, -300], [-100, -321]] }
];

export const GUNS = [
  { id: 'A1', section: "פלגה א'", rear: [-44, -296] },
  { id: 'A2', section: "פלגה א'", rear: [-6, -290], hero: true },
  { id: 'A3', section: "פלגה א'", rear: [32, -298] },
  { id: 'B1', section: "פלגה ב'", rear: [84, -304] },
  { id: 'B2', section: "פלגה ב'", rear: [122, -310] },
  { id: 'B3', section: "פלגה ב'", rear: [160, -302] }
];

export const GUN_BODY_OFFSET = -4.4;

export const BERM = { halfWidth: 7.5, back: 3.8, front: -11, gapFrom: 2, height: 2.1, profile: 3.2 };

export const FOOTPRINTS = [
  { id: 'shivtaBarracksA', region: 'shivta', kind: 'building', x: -23, z: 12, w: 8, d: 10, h: 6.6, label: "מגורים א'" },
  { id: 'shivtaBarracksB', region: 'shivta', kind: 'building', x: -23, z: -12, w: 8, d: 10, h: 6.6, label: "מגורים ב'" },
  { id: 'shivtaClinic', region: 'shivta', kind: 'building', x: -15, z: 6.5, w: 5.2, d: 5, h: 3.6, label: 'מרפאה' },
  { id: 'shivtaMess', region: 'shivta', kind: 'building', x: 1, z: -24, w: 14, d: 8, h: 5.2, label: 'חדרי האוכל' },
  { id: 'shivtaShop', region: 'shivta', kind: 'building', x: 22.5, z: -14, w: 6.5, d: 7.5, h: 4, label: 'אפסנאות' },
  { id: 'shivtaArmory', region: 'shivta', kind: 'building', x: 24, z: -26, w: 8, d: 6, h: 4, label: 'נשקייה' },
  { id: 'shivtaSim', region: 'shivta', kind: 'building', x: -18, z: -30, w: 8, d: 6, h: 4.2, label: 'סימולטור מפי"ק' },
  { id: 'shivtaParade', region: 'shivta', kind: 'pad', x: 0, z: 18, w: 26, d: 24, label: 'רחבת המסדרים' },
  { id: 'shivtaPlaza', region: 'shivta', kind: 'pad', x: -14, z: -22, w: 14, d: 10, label: 'רחבת הטקסים' },
  { id: 'shivtaPark', region: 'shivta', kind: 'pad', x: 24, z: 22, w: 18, d: 24, label: 'פארק תומ"תים' },
  { id: 'shivtaRange', region: 'shivta', kind: 'range', x: 68, z: 0, w: 44, d: 34, label: 'מטווח שבטה' },
  { id: 'yoavBarracks1', region: 'yoav', kind: 'building', x: -126, z: -156, w: 18, d: 8, h: 4.2, label: 'מגורים' },
  { id: 'yoavBarracks2', region: 'yoav', kind: 'building', x: -126, z: -170, w: 18, d: 8, h: 4.2, label: 'מגורים' },
  { id: 'yoavMess', region: 'yoav', kind: 'building', x: -92, z: -200, w: 18, d: 10, h: 4.6, label: 'חדר אוכל' },
  { id: 'yoavHangar', region: 'yoav', kind: 'building', x: -146, z: -198, w: 18, d: 12, h: 5.6, label: 'ימ"ח' },
  { id: 'yoavParade', region: 'yoav', kind: 'pad', x: -95, z: -176, w: 22, d: 16, label: 'רחבת היערכות' },
  { id: 'yoavStaging', region: 'yoav', kind: 'gravel', x: -144, z: -183, w: 32, d: 12, label: 'מכלאת שיירות' },
  { id: 'yoavMemorial', region: 'yoav', kind: 'pad', x: -76, z: -158, w: 10, d: 10, label: 'גן אלון' },
  { id: 'lineSleepTent', region: 'line', kind: 'tent', x: 0, z: -244, w: 6, d: 15, label: 'אוהל שינה' },
  { id: 'lineDinnerTent', region: 'line', kind: 'tent', x: 9, z: -244, w: 6, d: 15, label: 'אוהל אוכל' },
  { id: 'lineCommandTent', region: 'line', kind: 'building', x: 20, z: -244, w: 4.4, d: 6, h: 2.8, label: 'מסו"ל' },
  { id: 'lineKitchen', region: 'line', kind: 'building', x: 30, z: -236, w: 3, d: 5.5, h: 2.8, label: 'מטבח שדה' },
  { id: 'lineGenerator', region: 'line', kind: 'building', x: 33, z: -248, w: 1.6, d: 2.6, h: 1.6, label: 'גנרטור' },
  { id: 'lineToilets', region: 'line', kind: 'building', x: 40, z: -238, w: 3.6, d: 1.3, h: 2.3, label: 'שירותים' },
  { id: 'lineGym', region: 'line', kind: 'pad', x: -10, z: -240, w: 4.5, d: 4, label: 'חדר כושר' },
  { id: 'lineMafikVehicle', region: 'line', kind: 'vehicle', x: -56, z: -266.5, w: 2.6, d: 4.9, h: 2.6, label: 'מפי"ק' },
  { id: 'lineOutpostBunker', region: 'line', kind: 'building', x: 6, z: -400, w: 6, d: 5, h: 2.6, label: 'בונקר' },
  { id: 'lineAmmoDump', region: 'line', kind: 'pad', x: -22, z: -276, w: 7, d: 5, label: 'מצבור תחמושת' }
];

export const WALLS = [
  { region: 'shivta', kind: 'twall', from: [-35, -35], to: [-7, -35] },
  { region: 'shivta', kind: 'twall', from: [7, -35], to: [35, -35] },
  { region: 'shivta', kind: 'fence', from: [-35, -35], to: [-35, 35] },
  { region: 'shivta', kind: 'fence', from: [-35, 35], to: [-5, 35] },
  { region: 'shivta', kind: 'fence', from: [5, 35], to: [35, 35] },
  { region: 'shivta', kind: 'fence', from: [35, -35], to: [35, -6] },
  { region: 'shivta', kind: 'fence', from: [35, 6], to: [35, 35] },
  { region: 'shivta', kind: 'berm', from: [47, -17], to: [89, -17] },
  { region: 'shivta', kind: 'berm', from: [47, 17], to: [89, 17] },
  { region: 'shivta', kind: 'berm', from: [89, -17], to: [89, 17] },
  { region: 'yoav', kind: 'fence', from: [-168, -146], to: [-58, -146] },
  { region: 'yoav', kind: 'fence', from: [-168, -212], to: [-58, -212] },
  { region: 'yoav', kind: 'fence', from: [-168, -146], to: [-168, -212] },
  { region: 'yoav', kind: 'fence', from: [-58, -146], to: [-58, -174] },
  { region: 'yoav', kind: 'fence', from: [-58, -182], to: [-58, -212] },
  { region: 'line', kind: 'stone', from: [-24, -372], to: [-6, -372] },
  { region: 'line', kind: 'stone', from: [6, -372], to: [24, -372] },
  { region: 'line', kind: 'stone', from: [-24, -372], to: [-24, -412] },
  { region: 'line', kind: 'stone', from: [24, -372], to: [24, -412] },
  { region: 'line', kind: 'stone', from: [-24, -412], to: [24, -412] }
];

export const TREES = [
  [-31, 31, 'tamarisk'], [-31, -2, 'tamarisk'], [12, 32, 'palm'], [-12, 32, 'palm'], [31, 8, 'tamarisk'], [-31, -32, 'tamarisk'],
  [8, -32, 'palm'], [32, -33, 'tamarisk'], [-62, -20, 'tamarisk'], [60, 40, 'tamarisk'],
  [-82, -152, 'cypress'], [-82, -164, 'cypress'], [-70, -152, 'cypress'], [-110, -150, 'oak'], [-160, -150, 'oak'], [-160, -208, 'oak'], [-64, -206, 'oak'],
  [-26, -318, 'oak'], [46, -262, 'oak'], [-150, -262, 'oak'], [100, -364, 'oak'], [-170, -386, 'oak'], [152, -236, 'oak'], [-94, -234, 'oak'], [70, -420, 'oak']
];

export const FEATURES = {
  ridges: [
    { from: [-82, -273], to: [-34, -276], height: 3.2, halfWidth: 7 }
  ],
  plateaus: [
    { x: -100, z: -330, radius: 9, falloff: 16, height: 1.0 }
  ],
  hills: [
    { x: -58, z: -66, radius: 13, height: 4 },
    { x: -150, z: -372, radius: 42, height: 13 },
    { x: 150, z: -388, radius: 48, height: 11 },
    { x: 124, z: -206, radius: 30, height: 6 },
    { x: -190, z: -250, radius: 36, height: 9 },
    { x: 120, z: 70, radius: 40, height: 7 },
    { x: -140, z: 40, radius: 45, height: 9 }
  ],
  wadis: [
    { points: [[60, -40], [88, -78], [140, -108], [215, -118]], depth: 1.8, halfWidth: 7 }
  ]
};

export const FLAT_ZONES = [
  { rect: [-48, 48, -48, 48], feather: 16 },
  { rect: [40, 100, -26, 26], feather: 10 },
  { rect: [-70, 60, -122, -44], feather: 24, keep: 0.25 },
  { rect: [-172, -52, -216, -142], feather: 12 },
  { rect: [-44, 52, -262, -216], feather: 12 },
  { rect: [-44, 44, -422, -364], feather: 12 },
  { circle: [-56, -262, 11], feather: 7 },
  { circle: [-22, -276, 9], feather: 7 },
  { circle: [58, -288, 13], feather: 8 },
  { circle: [58, -334, 18], feather: 8 },
  { circle: [44, -268, 6], feather: 6 },
  { circle: [-54, -236, 7], feather: 7 },
  { circle: [-40, -386, 8], feather: 6 },
  { circle: [-60, -100, 8], feather: 6 },
  ...GUNS.map((gun) => ({ circle: [gun.rear[0], gun.rear[1] - 3, 17], feather: 10 }))
];

export const MAP_LABELS = [
  { x: 0, z: -38, text: 'ש"ג צפוני' },
  { x: -40, z: -62, text: 'רכס התצפית' },
  { x: 2, z: -70, text: 'שטח אימונים' },
  { x: -58, z: -176, text: 'ש"ג 978' },
  { x: -52, z: -232, text: 'שלט הסוללה' },
  { x: 4, z: -230, text: 'מאהל הסוללה' },
  { x: 0, z: -392, text: 'מוצב צוקית' },
  { x: -100, z: -330, text: 'רכס רוכ"ש' },
  { x: 58, z: -282, text: 'רועם' }
];
