import { CHAPTERS, ACHIEVEMENTS } from './campaign-data.js';
import { save, runtime } from './state.js';
import { stripKeyHints } from './config.js';

export function createCampaignUi(deps) {
  let modalPreviewChapter = null;

  function ensureCampaignModalDOM() {
    if (document.getElementById('campaign-modal')) return;
    const modal = document.createElement('div');
    modal.id = 'campaign-modal';
    modal.className = 'modal hidden';
    modal.style.display = 'none';
    modal.innerHTML = `
    <div class="modal-content" style="max-width:860px;width:94%;max-height:88vh;overflow-y:auto;direction:rtl;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <h2 style="margin:0;">יומן הקמפיין ועיטורי שירות</h2>
        <button id="btn-close-campaign" class="btn-secondary">${stripKeyHints('סגור [J]')}</button>
      </div>
      <div id="campaign-chapters-tabs" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px;"></div>
      <div style="margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;">
        <span id="campaign-chapter-desc" style="font-size:13px;opacity:0.9;"></span>
        <button id="btn-skip-commanders-course" class="btn-secondary" style="display:none;">דלג על קורס מפק"ץ (עבור לפרק 7)</button>
      </div>
      <div id="campaign-missions-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px;margin-bottom:16px;"></div>
      <h3 style="margin:8px 0;">עיטורי שירות והישגים (12)</h3>
      <div id="campaign-achievements-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px;"></div>
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
        return `<button class="campaign-tab ${active ? 'active' : ''} ${unlocked ? '' : 'locked'}" data-chapter-id="${ch.id}" style="padding:6px 10px;border-radius:6px;cursor:pointer;border:1px solid ${active ? '#4ade80' : '#475569'};background:${active ? '#1e3a2f' : '#1e293b'};color:#f8fafc;">${ch.order}. ${ch.shortTitle} (${ch.dayRangeText})</button>`;
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
        return `<div class="campaign-mission-card ${done ? 'completed' : ''} ${isCurrent ? 'active' : ''}" data-mission-id="${m.id}" style="padding:10px;border-radius:8px;border:1px solid ${done ? '#22c55e' : isCurrent ? '#eab308' : '#334155'};background:#0f172a;color:#f1f5f9;">
        <div style="font-weight:700;margin-bottom:4px;">${done ? '✅ ' : ''}${m.title}</div>
        <div style="font-size:12px;opacity:0.85;margin-bottom:6px;">${stripKeyHints(m.briefing || m.description)}</div>
        <ul style="font-size:12px;padding-right:18px;margin:0 0 8px 0;">${objLines}</ul>
        <div style="font-size:12px;color:#fbbf24;margin-bottom:8px;">פרס: ${m.moneyReward} ₪ | ${m.scoreReward} נק׳ | +${m.daysAdvance || 1} ימים</div>
        <button class="btn-start-campaign-mission" data-start-id="${m.id}" ${unlocked ? '' : 'disabled'} style="width:100%;padding:5px;border-radius:5px;cursor:${unlocked ? 'pointer' : 'not-allowed'};">${btnText}</button>
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
        return `<div class="achievement-card ${earned ? 'earned' : 'locked'}" data-ach-id="${a.id}" style="padding:8px;border-radius:6px;border:1px solid ${earned ? '#f59e0b' : '#334155'};background:${earned ? '#1f2937' : '#0b1120'};opacity:${earned ? '1' : '0.6'};">
        <div style="font-weight:700;">${a.icon} ${a.title}</div>
        <div style="font-size:12px;opacity:0.85;">${stripKeyHints(a.description)}</div>
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
