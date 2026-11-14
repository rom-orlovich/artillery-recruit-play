import { SHOP_ITEMS, EVENTS, stripKeyHints } from './config.js';
import {
  save,
  player,
  runtime,
  writeSave,
  syncDerivedStats,
  advanceDay,
  addScoreAndMoney,
  emit,
  on
} from './state.js';

let closeCallback = null;
let initialized = false;

function setShopModalVisible(visible) {
  const modal = document.getElementById('shop-modal');
  if (!modal) return;
  modal.classList.toggle('hidden', !visible);
  modal.style.display = visible ? 'flex' : 'none';
}

function renderShop() {
  const moneyEl = document.getElementById('shop-money');
  const container = document.getElementById('shop-items-container');
  if (moneyEl) moneyEl.textContent = `${save.money} ₪`;
  if (!container) return;

  container.innerHTML = '';
  for (const item of SHOP_ITEMS) {
    const owned = Boolean(save.gear[item.id]);
    const canAfford = save.money >= item.price;

    const card = document.createElement('div');
    card.className = 'shop-item-card';

    const title = document.createElement('h3');
    title.textContent = `${item.icon} ${item.name}`;

    const desc = document.createElement('p');
    desc.className = 'modal-desc';
    desc.textContent = stripKeyHints(item.description);

    const footer = document.createElement('div');
    footer.className = 'modal-actions';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.itemId = item.id;

    if (owned) {
      btn.className = 'btn-secondary';
      btn.disabled = true;
      btn.textContent = 'נרכש ✓';
    } else if (!canAfford) {
      btn.className = 'btn-secondary';
      btn.disabled = true;
      btn.textContent = `חסר תקציב (${item.price} ₪)`;
    } else {
      btn.className = 'btn-primary';
      btn.textContent = `רכוש (${item.price} ₪)`;
      btn.addEventListener('click', () => buyGearItem(item.id));
    }

    footer.appendChild(btn);
    card.appendChild(title);
    card.appendChild(desc);
    card.appendChild(footer);
    container.appendChild(card);
  }
}

export function initShop(onCloseCallback) {
  closeCallback = typeof onCloseCallback === 'function' ? onCloseCallback : null;

  if (!initialized) {
    initialized = true;
    const closeBtn = document.getElementById('btn-close-shop');
    closeBtn?.addEventListener('click', () => closeShop());
    document.getElementById('btn-shop-go-mission')?.addEventListener('click', () => closeShop());

    on(EVENTS.STATE_CHANGED, () => {
      if (runtime.shopOpen) renderShop();
    });
  }

  renderShop();
}

export function openShop() {
  runtime.shopOpen = true;
  runtime.isPlaying = false;
  if (document.pointerLockElement && document.exitPointerLock) {
    try {
      document.exitPointerLock();
    } catch {}
  }
  renderShop();
  setShopModalVisible(true);
}

export function closeShop() {
  runtime.shopOpen = false;
  setShopModalVisible(false);
  if (typeof closeCallback === 'function') {
    closeCallback();
  }
}

export function buyGearItem(itemId) {
  const item = SHOP_ITEMS.find((entry) => entry.id === itemId);
  if (!item || save.gear[item.id]) return false;

  if (save.money < item.price) {
    emit(EVENTS.TOAST, { message: 'אין מספיק שקלים לרכישת הציוד!', duration: 2500 });
    return false;
  }

  save.money -= item.price;
  save.gear[item.id] = true;
  syncDerivedStats();
  if (item.id === 'shluker') {
    player.hp = Math.min(player.maxHp, player.hp + 25);
  }

  writeSave();
  emit(EVENTS.GEAR_PURCHASED, { itemId: item.id, price: item.price });
  emit(EVENTS.TOAST, { message: `נרכש באפסנאות: ${item.name}`, duration: 2800 });
  renderShop();
  return true;
}

export function useClinic() {
  if (player.hp >= player.maxHp) {
    emit(EVENTS.TOAST, { message: 'מד הבריאות כבר מלא (100%).', duration: 2200 });
    return;
  }
  player.hp = player.maxHp;
  writeSave();
  emit(EVENTS.TOAST, { message: 'טופלת במרפאה הצבאית — הבריאות שוחזרה ל-100%!', duration: 3000 });
}

export function performMorningInspection() {
  advanceDay(1);
  addScoreAndMoney(15, 0);
  emit(EVENTS.TOAST, {
    message: `מסדר בוקר הושלם! יום ${save.day} (+15 נק׳ משמעת)`,
    duration: 3200
  });
}
