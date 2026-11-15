import { CHAPTERS, ACHIEVEMENTS } from './campaign-data.js';
import { save, runtime } from './state.js';
import { stripKeyHints } from './config.js';

export function createCampaignUi(deps) {
  let modalPreviewChapter = null;

  function ensureCampaignModalDOM() {
    if (document.getElementById('campaign-modal')) return;
    const modal = document.createElement('div');
    modal.id = 'campaign-modal';
    modal.className = 'overlay-modal hidden';
    modal.style.display = 'none';
    modal.innerHTML = `
    <div class="modal-card modal-wide campaign-card">
      <div class="modal-header campaign-header">
        <h2>📋 יומן הקמפיין ועיטורי שירות</h2>
        <button type="button" id="btn-close-campaign" class="btn-secondary modal-close-btn" aria-label="סגור">✕</button>
      </div>
      <div class="modal-body">
        <div id="campaign-chapters-tabs" class="campaign-tabs"></div>
        <div class="campaign-chapter-bar">
          <span id="campaign-chapter-desc"></span>
          <button type="button" id="btn-skip-commanders-course" class="btn-secondary">דלג על קורס מפק"ץ (עבור לפרק 7)</button>
        </div>
        <div id="campaign-missions-grid" class="campaign-missions-grid"></div>
        <h3 class="campaign-section-title">עיטורי שירות והישגים (12)</h3>
        <div id="campaign-achievements-grid" class="campaign-achievements-grid"></div>
      </div>
      <div class="modal-footer"><button type="button" id="btn-campaign-done" class="btn-primary">חזור לשטח</button></div>
    </div>`;
    document.body.appendChild(modal);
    document.getElementById('btn-skip-commanders-course')?.addEventListener('click', deps.skipCommandersCourse);
  }

  function renderCampaignModal(chapterId = modalPreviewChapter || save.chapterId) {
    ensureCampaignModalDOM();
    modalPreviewChapter = chapterId;
    const tabsEl = document.getElementById('campaign-chapters-tabs');
    const gridEl = document.getElementById('campaign-missions-grid');
    const achEl = document.getElementById('campaign-achievements-grid');
    const descEl = document.getElementById('campaign-chapter-desc');
    const skipBtn = document.getElementById('btn-skip-commanders-course');

    if (tabsEl) {
      tabsEl.innerHTML = CHAPTERS.map((ch) => {
        const unlocked = deps.isChapterUnlocked(ch.id);
        const active = ch.id === chapterId;
        return `<button type="button" class="campaign-tab ${active ? 'active' : ''} ${unlocked ? '' : 'locked'}" data-chapter-id="${ch.id}">${ch.order}. ${ch.shortTitle} (${ch.dayRangeText})</button>`;
      }).join('');
      tabsEl.querySelectorAll('[data-chapter-id]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const cid = btn.getAttribute('data-chapter-id');
          if (deps.isChapterUnlocked(cid)) deps.setActiveChapter(cid);
          renderCampaignModal(cid);
        });
      });
    }

    const chObj = CHAPTERS.find((c) => c.id === chapterId) || CHAPTERS[0];
    if (descEl) descEl.textContent = stripKeyHints(`${chObj.title} — ${chObj.summary}`);
    if (skipBtn) {
      const canSkip = deps.isChapterUnlocked('ch6_mefakzim') && !save.commandCourseSkipped && !deps.isChapterCompleted('ch6_mefakzim');
      skipBtn.style.display = canSkip ? 'inline-block' : 'none';
    }

    if (gridEl) {
      const unlocked = deps.isChapterUnlocked(chapterId);
      const list = deps.getChapterMissions(chapterId);
      gridEl.innerHTML = list.map((m) => {
        const done = Boolean(save.completed?.[m.id]);
        const isCurrent = save.activeMissionId === m.id;
        const objLines = (m.objectives || []).map((o) => `<li>${stripKeyHints(o.label)}</li>`).join('');
        const btnText = done ? 'בצע שוב' : isCurrent ? 'פעילה כעת' : unlocked ? 'הפעל משימה' : 'פרק נעול';
        const btnCls = unlocked && !done ? 'btn-primary' : 'btn-secondary';
        return `<div class="campaign-mission-card ${done ? 'completed' : ''} ${isCurrent ? 'active' : ''}" data-mission-id="${m.id}">
        <div class="mission-title">${done ? '✅ ' : ''}${m.title}</div>
        <div class="mission-desc">${stripKeyHints(m.briefing || m.description)}</div>
        <ul class="mission-objectives">${objLines}</ul>
        <div class="mission-reward">פרס: ${m.moneyReward} ₪ | ${m.scoreReward} נק׳ | +${m.daysAdvance || 1} ימים</div>
        <button type="button" class="btn-start-campaign-mission ${btnCls}" data-start-id="${m.id}" ${unlocked ? '' : 'disabled'}>${btnText}</button>
      </div>`;
      }).join('');
      gridEl.querySelectorAll('[data-start-id]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const mid = btn.getAttribute('data-start-id');
          if (deps.startCampaignMission(mid)) closeCampaignModal();
        });
      });
    }

    if (achEl) {
      achEl.innerHTML = ACHIEVEMENTS.map((a) => {
        const earned = Boolean(save.achievements?.[a.id]);
        return `<div class="achievement-card ${earned ? 'earned' : 'locked'}" data-ach-id="${a.id}">
        <div class="achievement-title">${a.icon} ${a.title}</div>
        <div class="achievement-desc">${stripKeyHints(a.description)}</div>
      </div>`;
      }).join('');
    }
  }

  function openCampaignModal() {
    ensureCampaignModalDOM();
    const modal = document.getElementById('campaign-modal');
    if (!modal) return;
    runtime.campaignModalOpen = true;
    document.exitPointerLock?.();
    renderCampaignModal(save.chapterId || 'ch1_bakum');
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
  }

  function closeCampaignModal() {
    const modal = document.getElementById('campaign-modal');
    if (modal) {
      modal.classList.add('hidden');
      modal.style.display = 'none';
    }
    runtime.campaignModalOpen = false;
  }

  return { ensureCampaignModalDOM, renderCampaignModal, openCampaignModal, closeCampaignModal };
}
