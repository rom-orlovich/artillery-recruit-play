import { EVENTS } from './config.js';
import { player, runtime, on } from './state.js';
import { resetInputState, releaseGameLock } from './controls.js';
import { setModalVisible, closeAllModals } from './modal-manager.js';
import { getCurrentTarget } from './current-target.js';
import { esc, renderKeysTab, highlightObjectiveBanner, initHelpKeys } from './help-keys.js';

export { highlightObjectiveBanner };
export const GUIDE_OFFERED_KEY = 'artillery_guideOffered';

const TAB_BODIES = { guide: 'help-guide', controls: 'help-controls', keys: 'help-keys' };
const COMPASS_DIRS = ['צפון', 'צפון-מזרח', 'מזרח', 'דרום-מזרח', 'דרום', 'דרום-מערב', 'מערב', 'צפון-מערב'];

let returnState = 'play';
let initialized = false;
let offerHeldPlay = false;
let previousFocus = null;

function stripKeyHints(text) {
  return String(text || '').replace(/\s*\[[^\]]+\]/g, '').trim();
}

function isTouchMode() {
  return Boolean(
    runtime.isMobile ||
    document.body?.classList.contains('is-touch') ||
    'ontouchstart' in window ||
    (navigator.maxTouchPoints || 0) > 0 ||
    window.matchMedia?.('(pointer: coarse)')?.matches ||
    window.matchMedia?.('(any-pointer: coarse)')?.matches
  );
}

function isVisibleModal(id) {
  const el = document.getElementById(id);
  return Boolean(el && !el.classList.contains('hidden') && getComputedStyle(el).display !== 'none');
}

function isHelpOpen() {
  return isVisibleModal('help-panel');
}

function isPauseVisible() {
  return isVisibleModal('pause-modal');
}

function hideGuideOffer() {
  const offer = document.getElementById('guide-offer');
  if (!offer) return;
  offer.classList.add('hidden');
  offer.style.display = 'none';
  if (offerHeldPlay) {
    offerHeldPlay = false;
    runtime.isPlaying = true;
  }
}

function maybeShowGuideOffer() {
  if (localStorage.getItem(GUIDE_OFFERED_KEY) || isHelpOpen() || isPauseVisible()) return;
  const offer = document.getElementById('guide-offer');
  if (!offer) return;
  const anyOverlayOpen = Array.from(document.querySelectorAll('.overlay-modal')).some(
    (m) => !m.classList.contains('hidden') && getComputedStyle(m).display !== 'none'
  );
  if (anyOverlayOpen) return;
  offer.classList.remove('hidden');
  offer.style.display = '';
  if (getComputedStyle(offer).display === 'none') offer.style.display = 'flex';
  if (!runtime.isMobile && runtime.isPlaying) {
    offerHeldPlay = true;
    resetInputState();
    releaseGameLock();
  }
}

function getDirectionInfo(tx, tz) {
  const dx = tx - player.pos.x;
  const dz = tz - player.pos.z;
  const dist = Math.round(Math.hypot(dx, dz));
  const deg = ((Math.atan2(dx, -dz) * 180) / Math.PI + 360) % 360;
  const compass = COMPASS_DIRS[Math.round(deg / 45) % 8];
  const sinY = Math.sin(player.yaw || 0);
  const cosY = Math.cos(player.yaw || 0);
  const fwd = dx * -sinY + dz * -cosY;
  const right = dx * cosY + dz * -sinY;
  const rel = (Math.atan2(right, fwd) * 180) / Math.PI;
  let relText = 'קדימה';
  if (rel > 45 && rel < 135) relText = 'ימין';
  else if (rel < -45 && rel > -135) relText = 'שמאל';
  else if (Math.abs(rel) >= 135) relText = 'אחורה';
  return { dist, compass, relText };
}

function renderGuideTab() {
  const el = document.getElementById('help-guide');
  if (!el) return;
  const touch = isTouchMode();
  const banner = document.getElementById('objective-text')?.textContent?.trim() || '';
  const target = getCurrentTarget?.() || null;
  const objText = banner || stripKeyHints(target?.text || '') || 'התקדם אל היעד המסומן במצפן';
  const hasCoords = target && Number.isFinite(target.x) && Number.isFinite(target.z);
  const dir = hasCoords ? getDirectionInfo(target.x, target.z) : null;
  const locLine = dir ? `${dir.dist} מ' לכיוון ${dir.compass} (${dir.relText})` : 'עקוב אחר סמן המצפן שבראש המסך';
  const step1 = dir
    ? (dir.dist <= 5
        ? `אתה קרוב ליעד (${dir.dist} מ' לכיוון ${dir.compass}) — בצע אינטראקציה או שיחה.`
        : `התקדם ${dir.dist} מ' לכיוון ${dir.compass} (${dir.relText}) בעזרת המצפן העליון.`)
    : 'הבט אל המצפן שבראש המסך והתקדם לכיוון החץ.';
  const step2 = touch
    ? 'בהגעה ליעד לחץ על כפתור דבר/פעולה, או פתח קמפיין למעקב אחרי המשימה.'
    : 'בהגעה ליעד לחץ E לאינטראקציה, או J לפתיחת יומן המשימות והקמפיין.';

  el.innerHTML = [
    '<section class="help-section help-now">',
    '<h3>מה לעשות עכשיו</h3>',
    `<p><strong>המשימה הנוכחית:</strong> ${esc(objText)}</p>`,
    `<p><strong>מיקום:</strong> ${esc(locLine)}</p>`,
    '<p><strong>הצעדים הבאים:</strong></p>',
    `<ol class="help-steps"><li>${esc(step1)}</li><li>${esc(step2)}</li></ol>`,
    '</section>',
    '<section class="help-section"><h4>מטרת המשחק</h4><p>התגייס לחיל התותחנים, השלם אימונים ומשימות שטח, הגן על הבסיס מפני כטב"מים והתקדם בדרגות.</p></section>',
    '<section class="help-section"><h4>תפקידים</h4><p>בחר בין לוחם תותחן, מפקד כלי או תצפיתן/לוחם מודיעין — לכל תפקיד יכולת מיוחדת וציוד משלו.</p></section>',
    '<section class="help-section"><h4>משימות ומפה</h4><p>עקוב אחר יעד המשימה במצפן, פתח את יומן המשימות לבחירת שלבים ובדוק את מפת השטח המלאה להתמצאות.</p></section>',
    '<section class="help-section"><h4>כסף ודרגות</h4><p>השלמת משימות ופגיעה במטרות מזכות בשקלים ובנקודות. רכוש שדרוגים בחנות ועלה בדרגה מטירון ועד קצין.</p></section>',
    '<section class="help-section"><h4>נהיגה ורישיון נט"ר</h4><p>צבור ניסיון והשלם משימות הכשרה כדי לקבל רישיון נט"ר ולנהוג ברק"ם התותחנים בין עמדות הירי.</p></section>',
    '<section class="help-section"><h4>דיבור עם חיילים</h4><p>התקרב לחיילים ומפקדים בבסיס והפעל אינטראקציה כדי לקבל תדריך, משימות חדשות וטיפים לשטח.</p></section>'
  ].join('');
}

function renderControlsTab() {
  const el = document.getElementById('help-controls');
  if (!el) return;
  const rows = isTouchMode()
    ? [
        ['🕹️', 'ג\'ויסטיק תנועה', 'גרור בצד המסך כדי ללכת לכל הכיוונים; משיכה לקצה נועלת ריצה.'],
        ['👁️', 'מבט וכוונה', 'החלק על אזור המבט כדי לסובב את המצלמה ולכוון את הנשק.'],
        ['🔥', 'ירי', 'לחיצה על כפתור הירי תוקפת מטרות וכטב"מים.'],
        ['⚡', 'יכולת', 'מפעיל את היכולת המיוחדת של התפקיד שלך.'],
        ['🏃', 'ריצה וקפיצה', 'כפתורי ריצה וקפיצה למעבר מהיר מעל מכשולים.'],
        ['💬', 'דבר / פעולה', 'שיחה עם חיילים ומפקדים ואינטראקציה עם אובייקטים בשטח.'],
        ['🗺️', 'מפה, קמפיין והשהיה', 'כפתורים מהירים למפת השטח, יומן המשימות ותפריט ההשהיה.']
      ]
    : [
        ['🖱️', 'עכבר (מבט וירי)', 'הזזת העכבר מסובבת את המצלמה; לחיצה שמאלית נועלת סמן ויורה.'],
        ['⌨️', 'תנועה (WASD / חצים)', 'הליכה קדימה, אחורה ולצדדים; החזק Shift לריצה ו-Space לקפיצה.'],
        ['💬', 'אינטראקציה (E)', 'דיבור עם חיילים וביצוע משימות ואיסוף ציוד בשטח.'],
        ['⚡', 'יכולת תפקיד (Q)', 'הפעלת היכולת המיוחדת של התפקיד שבחרת.'],
        ['🗺️', 'מפה ומשימות (M / J / Tab)', 'פתיחת מפה (M), יומן משימות (J) והדגשת היעד הנוכחי (Tab).'],
        ['❓', 'עזרה והשהיה (H / F1 / Esc)', 'פתיחת המדריך (H או F1) והשהיית המשחק (Esc).']
      ];
  el.innerHTML = [
    `<div class="help-section"><h3>${isTouchMode() ? 'פקדי מגע במסך' : 'שליטה בעכבר ומקלדת'}</h3>`,
    '<ul class="help-list">',
    ...rows.map(([icon, title, desc]) => `<li><span class="help-icon">${icon}</span> <strong>${esc(title)}:</strong> ${esc(desc)}</li>`),
    '</ul></div>'
  ].join('');
}

function renderHelpContent() {
  renderGuideTab();
  renderControlsTab();
  renderKeysTab();
}

export function switchHelpTab(tabKey = 'guide') {
  const normalized = tabKey === 'shortcuts' ? 'keys' : (TAB_BODIES[tabKey] ? tabKey : 'guide');
  const panel = document.getElementById('help-panel');
  if (!panel) return;
  panel.querySelectorAll('[data-help-tab]').forEach((btn) => {
    const active = btn.getAttribute('data-help-tab') === normalized;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  Object.entries(TAB_BODIES).forEach(([key, bodyId]) => {
    const body = document.getElementById(bodyId);
    if (!body) return;
    const active = key === normalized;
    body.classList.toggle('hidden', !active);
    body.classList.toggle('active', active);
    body.style.display = active ? '' : 'none';
    if (active && getComputedStyle(body).display === 'none') body.style.display = 'block';
  });
}

export function openHelpPanel(tabKey = 'guide') {
  const panel = document.getElementById('help-panel');
  if (!panel) return;
  if (!isHelpOpen()) {
    previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const pauseModal = document.getElementById('pause-modal');
    const pauseWasOpen = Boolean(pauseModal && !pauseModal.classList.contains('hidden'));
    returnState = pauseWasOpen ? 'pause' : 'play';
    if (pauseWasOpen) {
      setModalVisible('pause-modal', false);
    } else {
      runtime.isPlaying = false;
      runtime.modalOpen = true;
      runtime.paused = false;
      resetInputState();
      releaseGameLock();
    }
  }
  hideGuideOffer();
  renderHelpContent();
  switchHelpTab(tabKey);
  panel.classList.remove('hidden');
  panel.style.display = 'flex';
  const activeTab = panel.querySelector('[role="tab"][aria-selected="true"]') || panel.querySelector('[data-help-tab]');
  if (activeTab && typeof activeTab.focus === 'function') {
    activeTab.focus({ preventScroll: true });
  }
}

export function closeHelpPanel() {
  const panel = document.getElementById('help-panel');
  if (!panel || !isHelpOpen()) return;
  panel.classList.add('hidden');
  panel.style.display = 'none';
  if (returnState === 'pause') {
    setModalVisible('pause-modal', true);
    runtime.paused = true;
    runtime.modalOpen = true;
    runtime.isPlaying = false;
  } else {
    closeAllModals();
  }
  const target = previousFocus && previousFocus.isConnected && !panel.contains(previousFocus)
    ? previousFocus
    : document.body;
  previousFocus = null;
  if (target === document.body) {
    if (document.activeElement && document.activeElement !== document.body && typeof document.activeElement.blur === 'function') {
      document.activeElement.blur();
    }
  } else if (target && typeof target.focus === 'function') {
    target.focus({ preventScroll: true });
  }
}

export function initHelpAndShortcuts(callbacks = {}) {
  if (initialized) return;
  initialized = true;

  document.addEventListener('pointerlockchange', () => {
    const offer = document.getElementById('guide-offer');
    if (!document.pointerLockElement || !offer || offer.classList.contains('hidden')) return;
    offerHeldPlay = offerHeldPlay || runtime.isPlaying;
    resetInputState();
    releaseGameLock();
  });

  if (EVENTS?.ENLIST_COMPLETED) {
    on(EVENTS.ENLIST_COMPLETED, () => setTimeout(maybeShowGuideOffer, 0));
  }

  document.addEventListener('click', (e) => {
    const tabBtn = e.target.closest('#help-panel [data-help-tab]');
    if (tabBtn) {
      const key = tabBtn.getAttribute('data-help-tab') || 'guide';
      renderHelpContent();
      switchHelpTab(key);
      return;
    }
    if (e.target.closest('#btn-help')) {
      openHelpPanel('guide');
      return;
    }
    if (e.target.closest('#help-close')) {
      closeHelpPanel();
      return;
    }
    if (e.target.closest('#guide-offer-yes')) {
      localStorage.setItem(GUIDE_OFFERED_KEY, '1');
      hideGuideOffer();
      openHelpPanel('guide');
      return;
    }
    if (e.target.closest('#guide-offer-no')) {
      localStorage.setItem(GUIDE_OFFERED_KEY, '1');
      hideGuideOffer();
      return;
    }
    if (e.target.closest('#btn-confirm-role')) {
      setTimeout(maybeShowGuideOffer, 0);
    }
  });

  initHelpKeys({ isHelpOpen, isPauseVisible, openHelpPanel, closeHelpPanel });

  const modals = document.querySelectorAll('.overlay-modal');
  if (modals.length && typeof MutationObserver !== 'undefined') {
    const obs = new MutationObserver(() => {
      const offer = document.getElementById('guide-offer');
      if (!offer || offer.classList.contains('hidden')) return;
      const anyOpen = Array.from(modals).some(
        (m) => !m.classList.contains('hidden') && getComputedStyle(m).display !== 'none'
      );
      if (anyOpen) hideGuideOffer();
    });
    for (const m of modals) {
      obs.observe(m, { attributes: true, attributeFilter: ['class', 'style'] });
    }
  }
}
