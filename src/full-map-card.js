import { player } from './state.js';
import { hasRemainingMissions } from './current-target.js';

export const MODAL_ID = 'full-map-modal';

export function ensureStylesheet() {
  if (document.querySelector('link[href="styles/maps.css"], link[href$="/styles/maps.css"]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'styles/maps.css';
  document.head.appendChild(link);
}

export function ensureFullMapDom(onToggleZoom) {
  const modal = document.getElementById(MODAL_ID);
  const canvas = document.getElementById('full-map-canvas');
  if (!modal || !canvas) return;
  const shell = canvas.parentElement;
  if (shell) shell.classList.add('full-map-shell');
  if (document.getElementById('full-map-body')) return;

  const body = document.createElement('div');
  body.id = 'full-map-body';
  const stage = document.createElement('div');
  stage.id = 'full-map-stage';
  canvas.parentNode.insertBefore(body, canvas);
  stage.appendChild(canvas);

  const card = document.createElement('aside');
  card.id = 'full-map-mission-card';
  card.setAttribute('dir', 'rtl');
  card.innerHTML =
    '<div class="fmmc-badge">משימה פעילה</div>' +
    '<h3 id="full-map-mission-title" class="fmmc-title"></h3>' +
    '<p id="full-map-objective-text" class="fmmc-objective"></p>' +
    '<div class="fmmc-meta"><span class="fmmc-label">מרחק ליעד</span><bdi id="full-map-objective-dist" class="fmmc-dist" dir="ltr"></bdi></div>' +
    '<div class="fmmc-legend">' +
    '<span class="fmmc-legend-item"><i class="fmmc-swatch fmmc-swatch-player"></i>מיקומך</span>' +
    '<span class="fmmc-legend-item"><i class="fmmc-swatch fmmc-swatch-target"></i>יעד</span>' +
    '<span class="fmmc-legend-item"><i class="fmmc-swatch fmmc-swatch-route"></i>נתיב</span>' +
    '</div>';

  const toggle = document.createElement('button');
  toggle.id = 'full-map-zoom-toggle';
  toggle.type = 'button';
  toggle.textContent = 'כל הגזרות';
  toggle.addEventListener('click', onToggleZoom);

  stage.appendChild(toggle);
  body.appendChild(card);
  body.appendChild(stage);
}

export function syncToggleButton(zoomMode) {
  const btn = document.getElementById('full-map-zoom-toggle');
  if (!btn) return;
  btn.textContent = zoomMode === 'fit' ? 'כל הגזרות' : 'האזור שלי';
  btn.dataset.zoomMode = zoomMode;
  btn.setAttribute('aria-pressed', zoomMode === 'all' ? 'true' : 'false');
}

export function updateMissionCard(info) {
  const active = hasRemainingMissions();
  const titleEl = document.getElementById('full-map-mission-title');
  const objEl = document.getElementById('full-map-objective-text');
  const distEl = document.getElementById('full-map-objective-dist');
  if (titleEl) titleEl.textContent = active ? info.missionTitle : 'אין משימה פעילה';
  if (objEl) objEl.textContent = active ? info.objectiveText : 'אין משימה פעילה';
  if (distEl) {
    distEl.textContent = active && info.target
      ? `${Math.max(0, Math.round(Math.hypot(info.target.x - player.pos.x, info.target.z - player.pos.z)))}m`
      : '';
  }
}

export function drawTargetAndLabel(ctx, target, labelText, toScreen, dpr, pulse) {
  const [tx, ty] = toScreen(target.x, target.z);
  const pulseR = (13 + pulse * 5) * dpr;
  ctx.save();
  ctx.beginPath();
  ctx.arc(tx, ty, pulseR, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 136, 0, 0.24)';
  ctx.fill();
  ctx.lineWidth = 3 * dpr;
  ctx.strokeStyle = '#1d1202';
  ctx.stroke();
  ctx.lineWidth = 2 * dpr;
  ctx.strokeStyle = '#ff9f1c';
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(tx, ty, 5.5 * dpr, 0, Math.PI * 2);
  ctx.fillStyle = '#ff6a00';
  ctx.fill();
  ctx.lineWidth = 1.6 * dpr;
  ctx.strokeStyle = '#fff3b0';
  ctx.stroke();

  const shortText = labelText.length > 26 ? `${labelText.slice(0, 25)}…` : labelText;
  ctx.font = `bold ${Math.round(13 * dpr)}px Tahoma, Arial, sans-serif`;
  ctx.direction = 'rtl';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const tw = ctx.measureText(shortText).width + 14 * dpr;
  const th = 20 * dpr;
  const lx = Math.min(ctx.canvas.width - tw / 2 - 4 * dpr, Math.max(tw / 2 + 4 * dpr, tx));
  const ly = ty - pulseR - th / 2 - 4 * dpr > 4 * dpr ? ty - pulseR - th / 2 - 4 * dpr : ty + pulseR + th / 2 + 4 * dpr;
  ctx.fillStyle = 'rgba(18, 14, 6, 0.9)';
  ctx.fillRect(lx - tw / 2, ly - th / 2, tw, th);
  ctx.strokeStyle = '#ff9f1c';
  ctx.lineWidth = 1.5 * dpr;
  ctx.strokeRect(lx - tw / 2, ly - th / 2, tw, th);
  ctx.fillStyle = '#ffe875';
  ctx.fillText(shortText, lx, ly + 0.5 * dpr);
  ctx.restore();
  return [tx, ty];
}
