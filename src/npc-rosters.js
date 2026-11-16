export const MAP_NPC_ROSTERS = {
  shivta: {
    minCount: 14,
    heroGunId: 'hero',
    heroGunPos: { x: 24, z: -4 },
    ammoDump: { x: 14, z: -6 },
    shellRack: { x: 18, z: -5 },
    generatorPos: { x: 12, z: -10 },
    stove: null,
    cots: [{ x: -16, z: -12 }, { x: -10, z: -12 }, { x: 8, z: -14 }, { x: 14, z: -14 }],
    guardPosts: [{ x: -6, z: -38 }, { x: 6, z: -38 }],
    officers: [
      { officerId: 'rasar', name: 'שמעון', rank: 'רנ"ג', role: 'מפקד צוות', x: -12, z: -22, ry: 0, pose: 'stand' },
      { officerId: 'masul', name: 'דניאל', rank: 'רס"ן', role: 'מפקד צוות', x: 6, z: 14, ry: Math.PI, pose: 'stand' },
      { officerId: 'mefaketz', name: 'איתי', rank: 'סגן', role: 'מפקד צוות', x: 0, z: 14, ry: Math.PI, pose: 'stand' },
      { officerId: 'apsanai', name: 'מאיר', rank: 'רס"ל', role: 'קשר', x: 17.2, z: -12, ry: -Math.PI / 2, pose: 'stand' },
      { officerId: 'shekemist', name: 'נועם', rank: 'טוראי', role: 'קשר', x: -4, z: -16, ry: 0, pose: 'stand' }
    ],
    fallbackEnlisted: [
      { x: -6, z: -38, ry: 0, pose: 'stand', role: 'ש.ג', rank: 'טוראי' },
      { x: 6, z: -38, ry: 0, pose: 'stand', role: 'ש.ג', rank: 'רב"ט' },
      { x: 52, z: -18, ry: -Math.PI / 2, pose: 'stand', role: 'מטווח/רוכ"ש', rank: 'רב"ט' },
      { x: 54, z: -28, ry: -Math.PI / 2, pose: 'stand', role: 'מטווח/רוכ"ש', rank: 'טוראי' },
      { x: 18, z: -6, ry: 0, pose: 'arms', role: 'נהג', rank: 'טוראי' },
      { x: 22, z: -2, ry: 0, pose: 'arms', role: 'טען', rank: 'טוראי' },
      { x: -12, z: 6, ry: 0, pose: 'stand', role: 'תותחן', rank: 'טוראי' },
      { x: -6, z: 4, ry: 0, pose: 'stand', role: 'תותחן', rank: 'רב"ט' },
      { x: 8, z: -20, ry: 0, pose: 'stand', role: 'תותחן', rank: 'טוראי' }
    ]
  },
  yoav: {
    minCount: 10,
    heroGunId: 'hero',
    heroGunPos: { x: -72, z: -168 },
    ammoDump: { x: -64, z: -162 },
    shellRack: { x: -67, z: -164 },
    generatorPos: { x: -60, z: -160 },
    stove: null,
    cots: [{ x: -84, z: -176 }, { x: -78, z: -176 }, { x: -90, z: -178 }],
    guardPosts: [{ x: -52, z: -165 }, { x: -54, z: -180 }],
    officers: [
      { officerId: 'kasha', name: 'יעל', rank: 'סרן', role: 'מטווח/רוכ"ש', x: -96, z: -172, ry: Math.PI / 4, pose: 'stand' }
    ],
    fallbackEnlisted: [
      { x: -72, z: -167, ry: 0, pose: 'arms', crewOf: 'yoav_doher', role: 'תותחן', rank: 'רב"ט' },
      { x: -73.5, z: -168, ry: 0, pose: 'arms', crewOf: 'yoav_doher', role: 'טען', rank: 'טוראי' },
      { x: -70.5, z: -168, ry: 0, pose: 'arms', crewOf: 'yoav_doher', role: 'נהג', rank: 'טוראי' },
      { x: -72, z: -169.5, ry: 0, pose: 'arms', crewOf: 'yoav_doher', role: 'מפקד צוות', rank: 'סמל' },
      { x: -86, z: -166, ry: 0, pose: 'stand', role: 'קשר', rank: 'טוראי' },
      { x: -88, z: -162, ry: 0, pose: 'stand', role: 'קשר', rank: 'רב"ט' },
      { x: -92, z: -178, ry: 0, pose: 'stand', role: 'מטווח/רוכ"ש', rank: 'רב"ט' },
      { x: -98, z: -178, ry: 0, pose: 'stand', role: 'מטווח/רוכ"ש', rank: 'טוראי' },
      { x: -52, z: -165, ry: 0, pose: 'stand', role: 'ש.ג', rank: 'טוראי' }
    ]
  },
  line: {
    minCount: 18,
    heroGunId: 'hero',
    heroGunPos: { x: 0, z: -272 },
    ammoDump: { x: -16, z: -258 },
    shellRack: { x: -7, z: -268 },
    generatorPos: { x: -20, z: -256 },
    stove: null,
    cots: [{ x: -10, z: -248 }, { x: 10, z: -248 }, { x: -20, z: -252 }, { x: 20, z: -252 }],
    guardPosts: [{ x: -28, z: -221 }, { x: 62, z: -254 }],
    officers: [
      { officerId: 'outpost_cmd', name: 'רותם', rank: 'סגן', role: 'מפקד צוות', x: 0, z: -256, ry: 0, pose: 'stand' }
    ],
    fallbackEnlisted: [
      { x: 0, z: -271, ry: 0, pose: 'arms', crewOf: 'line_hero', role: 'תותחן', rank: 'רב"ט' },
      { x: -1.5, z: -272, ry: 0, pose: 'arms', crewOf: 'line_hero', role: 'טען', rank: 'טוראי' },
      { x: 1.5, z: -272, ry: 0, pose: 'arms', crewOf: 'line_hero', role: 'מפקד צוות', rank: 'סמל' },
      { x: -34, z: -272, ry: 0, pose: 'arms', crewOf: 'line_g1', role: 'תותחן', rank: 'טוראי' },
      { x: -35.5, z: -272, ry: 0, pose: 'arms', crewOf: 'line_g1', role: 'טען', rank: 'טוראי' },
      { x: 34, z: -272, ry: 0, pose: 'arms', crewOf: 'line_g3', role: 'תותחן', rank: 'טוראי' },
      { x: 35.5, z: -272, ry: 0, pose: 'arms', crewOf: 'line_g3', role: 'טען', rank: 'טוראי' },
      { x: -64, z: -272, ry: 0, pose: 'arms', crewOf: 'line_g4', role: 'תותחן', rank: 'רב"ט' },
      { x: -65.5, z: -272, ry: 0, pose: 'arms', crewOf: 'line_g4', role: 'טען', rank: 'טוראי' },
      { x: 64, z: -272, ry: 0, pose: 'arms', crewOf: 'line_g5', role: 'תותחן', rank: 'טוראי' },
      { x: 65.5, z: -272, ry: 0, pose: 'arms', crewOf: 'line_g5', role: 'טען', rank: 'טוראי' },
      { x: 94, z: -272, ry: 0, pose: 'arms', crewOf: 'line_g6', role: 'תותחן', rank: 'רב"ט' },
      { x: 18, z: -244, ry: 0, pose: 'stand', role: 'קשר', rank: 'טוראי' },
      { x: -48, z: -260, ry: 0, pose: 'stand', role: 'קשר', rank: 'רב"ט' },
      { x: -28, z: -221, ry: 0, pose: 'stand', role: 'ש.ג', rank: 'טוראי' },
      { x: 62, z: -254, ry: 0, pose: 'stand', role: 'ש.ג', rank: 'רב"ט' },
      { x: -12, z: -258, ry: 0, pose: 'stand', role: 'נהג', rank: 'טוראי' }
    ]
  },
  zaura: {
    minCount: 9,
    heroGunId: 'hero',
    heroGunPos: { x: 0, z: -20 },
    ammoDump: { x: -22, z: 8 },
    shellRack: { x: -7, z: -15 },
    generatorPos: { x: 28, z: 24 },
    stove: { x: 18, z: 26 },
    cots: [{ x: -46, z: -10 }, { x: -5, z: -6 }, { x: 36, z: -10 }],
    guardPosts: [{ x: 68, z: 46 }, { x: -52, z: -42 }],
    officers: [
      { officerId: 'masul', name: 'דניאל', rank: 'רס"ן', role: 'מפקד צוות', x: 52, z: 8, ry: -Math.PI / 2, pose: 'stand' }
    ],
    fallbackEnlisted: [
      { x: 0, z: -19, ry: 0, pose: 'arms', crewOf: 'Z2', role: 'תותחן', rank: 'רב"ט' },
      { x: -1.5, z: -20, ry: 0, pose: 'arms', crewOf: 'Z2', role: 'טען', rank: 'טוראי' },
      { x: 1.5, z: -20, ry: 0, pose: 'arms', crewOf: 'Z2', role: 'מפקד צוות', rank: 'סמל' },
      { x: 0, z: -21.5, ry: 0, pose: 'arms', crewOf: 'Z2', role: 'נהג', rank: 'טוראי' },
      { x: -42, z: -24, ry: 0, pose: 'stand', role: 'תותחן', rank: 'טוראי' },
      { x: 42, z: -26, ry: 0, pose: 'stand', role: 'טען', rank: 'טוראי' },
      { x: 18, z: 26, ry: 0, pose: 'stand', role: 'נהג', rank: 'רב"ט', station: 'stove' },
      { x: 68, z: 46, ry: Math.PI, pose: 'stand', role: 'ש.ג', rank: 'טוראי' }
    ]
  },
  beit_hillel: {
    minCount: 9,
    heroGunId: 'hero',
    heroGunPos: { x: 0, z: -24 },
    ammoDump: { x: -38, z: 18 },
    shellRack: { x: -8, z: -18 },
    generatorPos: { x: -34, z: 18 },
    stove: { x: 38, z: 22 },
    cots: [{ x: 58, z: 26 }, { x: 2, z: 22 }, { x: 24, z: 22 }],
    guardPosts: [{ x: -50, z: 62 }, { x: -18, z: -5 }],
    officers: [
      { officerId: 'kasha', name: 'יעל', rank: 'סרן', role: 'מטווח/רוכ"ש', x: -14, z: 22, ry: Math.PI, pose: 'stand' }
    ],
    fallbackEnlisted: [
      { x: 0, z: -23, ry: 0, pose: 'arms', crewOf: 'BH2', role: 'תותחן', rank: 'רב"ט' },
      { x: -1.5, z: -24, ry: 0, pose: 'arms', crewOf: 'BH2', role: 'טען', rank: 'טוראי' },
      { x: 1.5, z: -24, ry: 0, pose: 'arms', crewOf: 'BH2', role: 'מפקד צוות', rank: 'סמל' },
      { x: 0, z: -25.5, ry: 0, pose: 'arms', crewOf: 'BH2', role: 'נהג', rank: 'טוראי' },
      { x: -34, z: -24, ry: 0, pose: 'stand', role: 'תותחן', rank: 'טוראי' },
      { x: 34, z: -24, ry: 0, pose: 'stand', role: 'קשר', rank: 'רב"ט' },
      { x: 38, z: 22, ry: 0, pose: 'stand', role: 'טען', rank: 'טוראי', station: 'stove' },
      { x: -50, z: 62, ry: Math.PI, pose: 'stand', role: 'ש.ג', rank: 'טוראי' }
    ]
  },
  kadita: {
    minCount: 9,
    heroGunId: 'hero',
    heroGunPos: { x: 0, z: -22 },
    ammoDump: { x: -48, z: 20 },
    shellRack: { x: -8, z: -16 },
    generatorPos: { x: -44, z: 20 },
    stove: { x: 24, z: 18 },
    cots: [{ x: -26, z: -6 }, { x: 10, z: -6 }, { x: -12, z: 16 }],
    guardPosts: [{ x: -12, z: -52 }, { x: -18, z: 3 }],
    officers: [
      { officerId: 'mefaketz', name: 'איתי', rank: 'סגן', role: 'מפקד צוות', x: 14, z: 18, ry: Math.PI, pose: 'stand' }
    ],
    fallbackEnlisted: [
      { x: 0, z: -21, ry: 0, pose: 'arms', crewOf: 'K2', role: 'תותחן', rank: 'רב"ט' },
      { x: -1.5, z: -22, ry: 0, pose: 'arms', crewOf: 'K2', role: 'טען', rank: 'טוראי' },
      { x: 1.5, z: -22, ry: 0, pose: 'arms', crewOf: 'K2', role: 'מפקד צוות', rank: 'סמל' },
      { x: 0, z: -23.5, ry: 0, pose: 'arms', crewOf: 'K2', role: 'נהג', rank: 'טוראי' },
      { x: -34, z: -22, ry: 0, pose: 'stand', role: 'תותחן', rank: 'טוראי' },
      { x: 34, z: -22, ry: 0, pose: 'stand', role: 'טען', rank: 'טוראי' },
      { x: -18, z: 3, ry: 0, pose: 'stand', role: 'מטווח/רוכ"ש', rank: 'רב"ט' },
      { x: 24, z: 18, ry: 0, pose: 'stand', role: 'נהג', rank: 'טוראי', station: 'stove' }
    ]
  }
};
