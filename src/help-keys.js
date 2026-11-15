import { runtime } from './state.js';
import { showToast } from './hud.js';

let highlightTimer = null;

export function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderKeysTab() {
  const el = document.getElementById('help-keys');
  if (!el) return;
  const keys = [
    ['WASD', 'תנועה בשטח לכל הכיוונים'],
    ['Shift', 'ריצה מהירה'],
    ['Space', 'קפיצה'],
    ['E', 'אינטראקציה ודיבור עם חיילים'],
    ['M', 'פתיחת מפת השטח המלאה'],
    ['J', 'פתיחת יומן המשימות והקמפיין'],
    ['Esc', 'השהיית המשחק או סגירת חלון'],
    ['H / F1', 'פתיחה וסגירה של מסך העזרה'],
    ['R', 'טעינה ואיפוס קירור הנשק לירי'],
    ['Tab', 'הדגשת היעד הנוכחי בראש המסך']
  ];
  el.innerHTML = [
    '<div class="help-section"><h3>מקשי מקלדת במשחק</h3>',
    '<ul class="help-keys-list">',
    ...keys.map(([k, desc]) => `<li><kbd class="help-kbd">${esc(k)}</kbd> <span>${esc(desc)}</span></li>`),
    '</ul></div>'
  ].join('');
}

export function highlightObjectiveBanner() {
  const pill = document.getElementById('hud-objective-pill');
  if (!pill) return;
  if (highlightTimer) clearTimeout(highlightTimer);
  pill.setAttribute('data-highlighted', 'true');
  pill.classList.add('objective-highlight');
  pill.style.borderColor = '#fbbf24';
  pill.style.boxShadow = '0 0 18px rgba(251, 191, 36, 0.85)';
  highlightTimer = setTimeout(() => {
    pill.removeAttribute('data-highlighted');
    pill.classList.remove('objective-highlight');
    pill.style.borderColor = '';
    pill.style.boxShadow = '';
    highlightTimer = null;
  }, 2500);
}

export function initHelpKeys({ isHelpOpen, isPauseVisible, openHelpPanel, closeHelpPanel }) {
  window.addEventListener('keydown', (e) => {
    if (document.activeElement?.tagName === 'INPUT') return;
    if (e.repeat) return;
    if (e.code === 'Escape' && isHelpOpen()) {
      e.preventDefault();
      e.stopImmediatePropagation();
      closeHelpPanel();
      return;
    }
    if (e.code === 'KeyH' || e.code === 'F1') {
      e.preventDefault();
      if (isHelpOpen()) {
        e.stopImmediatePropagation();
        closeHelpPanel();
      } else if (runtime.isPlaying || isPauseVisible()) {
        e.stopImmediatePropagation();
        openHelpPanel('guide');
      }
      return;
    }
    if (e.code === 'Tab' && runtime.isPlaying) {
      e.preventDefault();
      e.stopImmediatePropagation();
      highlightObjectiveBanner();
      return;
    }
    if (e.code === 'KeyR' && runtime.isPlaying) {
      e.preventDefault();
      runtime.shootCooldown = 0;
      runtime.recoil = 0;
      showToast('🔄 הנשק מוכן לירי', 1400);
    }
  }, true);
}
