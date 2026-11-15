import { getCurrentTarget } from './current-target.js';
import { player, save } from './state.js';
import { isTouchDevice, stripKeyHints, ROLES } from './config.js';

const COMPASS_DIRS = [
  'צפון',
  'צפון-מזרח',
  'מזרח',
  'דרום-מזרח',
  'דרום',
  'דרום-מערב',
  'מערב',
  'צפון-מערב'
];

const SHORTCUTS = [
  ['<kbd>WASD</kbd>', 'תנועה קדימה, אחורה ולצדדים'],
  ['<kbd>Shift</kbd>', 'ריצה מהירה'],
  ['<kbd>Space</kbd> (רווח)', 'קפיצה'],
  ['<kbd>E</kbd>', 'אינטראקציה, איסוף ציוד ודיבור עם חיילים'],
  ['<kbd>M</kbd>', 'פתיחה וסגירה של המפה המלאה'],
  ['<kbd>J</kbd>', 'פתיחת לוח המשימות והקמפיין'],
  ['<kbd>Esc</kbd>', 'השהיה או סגירת חלון פתוח'],
  ['<kbd>H</kbd> / <kbd>F1</kbd>', 'פתיחה וסגירה של חלון העזרה'],
  ['<kbd>R</kbd>', 'טעינת נשק מחדש'],
  ['<kbd>Tab</kbd>', 'הדגשת היעד הנוכחי']
];

function escHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getDirectionInfo(target) {
  const px = player?.pos?.x ?? 0;
  const pz = player?.pos?.z ?? 0;
  const dx = target.x - px;
  const dz = target.z - pz;
  const dist = Math.round(Math.hypot(dx, dz));
  const idx = ((Math.round((Math.atan2(dx, -dz) * 8) / (Math.PI * 2)) % 8) + 8) % 8;
  const compass = COMPASS_DIRS[idx];
  const yaw = Number.isFinite(player?.yaw) ? player.yaw : (player?.rotation?.y || 0);
  const fwdDot = dx * -Math.sin(yaw) + dz * -Math.cos(yaw);
  const rightDot = dx * Math.cos(yaw) + dz * -Math.sin(yaw);
  let relative = 'קדימה';
  if (Math.abs(fwdDot) >= Math.abs(rightDot)) {
    relative = fwdDot >= 0 ? 'קדימה' : 'אחורה';
  } else {
    relative = rightDot >= 0 ? 'ימין' : 'שמאל';
  }
  return { dist, compass, relative };
}

function getNextSteps(target, info) {
  if (!target) {
    return [
      'פתח את לוח המשימות (J) או המפה המלאה (M) כדי לבחור משימה פעילה.',
      'התקרב אל מפקד או חייל בבסיס ולחץ E כדי לדבר ולקבל משימות חדשות.'
    ];
  }
  const where = `${info.compass} (${info.relative}, ${info.dist} מ')`;
  if (target.kind === 'carry-drop' || player?.carryingType) {
    return [
      `התקדם עם הציוד לכיוון ${where} אל נקודת הפריקה המסומנת.`,
      'התקרב אל אזור היעד ולחץ על כפתור הפעולה או E כדי להניח או לטעון.'
    ];
  }
  if (target.missionId === 'range') {
    return [
      `נווט אל עמדת המטווח לכיוון ${where} והפעל את מסוף הירי החי.`,
      'כוון אל מטרות המטווח וירה עד לפגיעה בכולן.'
    ];
  }
  if (target.missionId === 'roem_rapid') {
    return [
      `הגע אל צומת הבקרה או עמדת התותח לכיוון ${where}.`,
      'כייל את הצומת ולאחר מכן פגע בכל מטרות האש.'
    ];
  }
  if (target.missionId === 'doher_salvo') {
    return [
      `אסוף פגזי 155 מ"מ וטען אותם לסדן ה"דוהר" בכיוון ${where}.`,
      'לאחר השלמת הטעינה בצע ירי סוללתי להשלמת המשימה.'
    ];
  }
  if (target.missionId === 'patrol') {
    return [
      `התקדם אל נקודת הסיור הבאה בכיוון ${where}.`,
      'עבור בכל נקודות הביקורת במסלול עד לסיום הסיור.'
    ];
  }
  return [
    `התקדם לכיוון ${where} בעקבות סמן היעד והמצפן.`,
    'בצע את פעולת המשימה ביעד (ירי או אינטראקציה עם E) כדי להשלים את השלב.'
  ];
}

export function renderGuideTab(containerEl) {
  if (!containerEl) return;
  const bannerEl = document.getElementById('objective-text');
  const bannerText = bannerEl ? bannerEl.textContent.trim() : '';
  const target = getCurrentTarget();
  const objectiveText = bannerText || (target ? stripKeyHints(target.text || '') : 'בחר משימה מלוח המשימות או סייר בבסיס');
  const info = target ? getDirectionInfo(target) : null;
  const steps = getNextSteps(target, info);
  const locationHtml = info
    ? `<p class="guide-location">מיקום: <strong>${info.dist} מ'</strong> לכיוון <strong>${escHtml(info.compass)}</strong> (${escHtml(info.relative)})</p>`
    : '<p class="guide-location">מיקום: פתח מפה (M) או לוח משימות (J) לבחירת יעד.</p>';
  const roleNames = Object.values(ROLES || {})
    .map((r) => r?.name || r?.title || r?.label)
    .filter(Boolean)
    .join(', ');
  const activeRole = save?.profile?.roleId && ROLES?.[save.profile.roleId];
  const activeRoleName = activeRole?.name || activeRole?.title || activeRole?.label || '';
  const roleSummary = roleNames
    ? `בסיס שבטה מציע מגוון תפקידים בחיל התותחנים (${escHtml(roleNames)}).`
    : 'בחר תפקיד בחיל התותחנים — לכל תפקיד נשק, יכולת מיוחדת ומשימות משלו.';
  const currentRoleLine = activeRoleName ? ` התפקיד הפעיל שלך כרגע: ${escHtml(activeRoleName)}.` : '';

  containerEl.innerHTML =
    `<section class="guide-section guide-now">` +
    `<h3>🎯 מה לעשות עכשיו</h3>` +
    `<p class="guide-objective">${escHtml(objectiveText)}</p>` +
    locationHtml +
    `<ol class="guide-steps">` +
    `<li class="guide-step">1. ${escHtml(steps[0])}</li>` +
    `<li class="guide-step">2. ${escHtml(steps[1])}</li>` +
    `</ol></section>` +
    `<section class="guide-section"><h3>🎖️ מטרת המשחק</h3><p>השלם את המסלול מטירון ללוחם תותחנים מוסמך: בצע משימות מבצעיות, מטווחים, תפעול כלים והגנה על גזרת הבסיס.</p></section>` +
    `<section class="guide-section"><h3>🪖 תפקידים</h3><p>${roleSummary}${currentRoleLine}</p></section>` +
    `<section class="guide-section"><h3>🗺️ משימות ומפה</h3><p>לוח המשימות (J) מציג משימות פעילות והושלמו, והמפה המלאה (M) מראה את מיקום היעדים והמבנים בבסיס.</p></section>` +
    `<section class="guide-section"><h3>💰 כסף ודרגות</h3><p>השלמת משימות מזכה בשקלים ובניסיון לקידום בדרגה. בכסף ניתן לרכוש ציוד ושדרוגים בחנות הבסיס.</p></section>` +
    `<section class="guide-section"><h3>🚛 נהיגה ורישיון נט"ר</h3><p>השג רישיון נט"ר דרך המשימות והאימונים כדי לנהוג בכלי הרכב הכבדים של הסוללה ברחבי הבסיס והשטח.</p></section>` +
    `<section class="guide-section"><h3>💬 דיבור עם חיילים</h3><p>התקרב אל מפקדים, מדריכים וחיילים בבסיס ולחץ E או על כפתור הדיבור כדי לקבל הנחיות, משימות ומידע.</p></section>`;
}

export function renderControlsTab(containerEl) {
  if (!containerEl) return;
  const touch = isTouchDevice() || document.body.classList.contains('is-touch');
  if (touch) {
    containerEl.innerHTML =
      `<div class="controls-list">` +
      `<div class="control-row"><span class="icon">🕹️</span><div><strong>ג'ויסטיק שמאלי</strong><p>תנועה לכל הכיוונים וריצה אוטומטית בדחיפה מלאה.</p></div></div>` +
      `<div class="control-row"><span class="icon">👆</span><div><strong>החלקה על המסך (מבט)</strong><p>סיבוב מבט וכיוון הנשק בצד ימין של המסך.</p></div></div>` +
      `<div class="control-row"><span class="icon">🔥</span><div><strong>כפתורי פעולה: ירי, קפיצה, ריצה, יכולת</strong><p>שימוש מהיר בירי, קפיצה, ריצה, יכולת מיוחדת ודיבור עם חיילים.</p></div></div>` +
      `</div>`;
    return;
  }
  containerEl.innerHTML =
    `<div class="controls-list">` +
    `<div class="control-row"><span class="icon">🖱️</span><div><strong>עכבר</strong><p>הזזת העכבר לסיבוב מבט וכיוון, וקליק שמאלי לירי.</p></div></div>` +
    `<div class="control-row"><span class="icon">⌨️</span><div><strong>מקלדת</strong><p>מקשי WASD לתנועה, Shift לריצה, רווח לקפיצה ו-E לפעולה.</p></div></div>` +
    `</div>`;
}

export function renderKeysTab(containerEl) {
  if (!containerEl) return;
  const rows = SHORTCUTS.map(
    ([keyHtml, action]) => `<tr><td class="key-cell">${keyHtml}</td><td class="action-cell">${escHtml(action)}</td></tr>`
  ).join('');
  containerEl.innerHTML =
    `<table class="keys-table">` +
    `<thead><tr><th>מקש</th><th>פעולה</th></tr></thead>` +
    `<tbody>${rows}</tbody>` +
    `</table>`;
}

export function renderHelpContent(activeTab = 'guide') {
  const guideEl = document.getElementById('help-guide');
  const controlsEl = document.getElementById('help-controls');
  const keysEl = document.getElementById('help-keys');
  if (guideEl && (activeTab === 'guide' || !guideEl.innerHTML)) renderGuideTab(guideEl);
  if (controlsEl && (activeTab === 'controls' || !controlsEl.innerHTML)) renderControlsTab(controlsEl);
  if (keysEl && (activeTab === 'keys' || !keysEl.innerHTML)) renderKeysTab(keysEl);
}
