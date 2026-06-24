// =============================================
//  Sky Camp Admin — Dashboard (Stats)
// =============================================
import { apiFetch, showToast } from './app.js';

export async function loadStats() {
  try {
    setSkeletons();
    const { stats: s } = await apiFetch('/stats');

    setText('s-total',     s.total_bookings);
    setText('s-pending',   s.pending);
    setText('s-paid',      s.paid);
    setText('s-cancelled', s.cancelled);
    setText('s-revenue',   '₴' + Number(s.total_revenue).toLocaleString('uk-UA'));
    setText('s-today',     s.today_bookings);
    setText('s-unread',    s.unread_contacts);
    setText('s-contacts',  s.total_contacts);

    // Unread badge in sidebar
    const badge = document.getElementById('unread-badge');
    if (badge) {
      badge.textContent    = s.unread_contacts;
      badge.style.display  = s.unread_contacts > 0 ? '' : 'none';
    }
  } catch (err) {
    if (err.message !== 'Unauthorized') {
      showToast(err.message || 'Не вдалося завантажити статистику', 'error');
    }
  }
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value ?? '—';
}

function setSkeletons() {
  ['s-total','s-pending','s-paid','s-cancelled','s-revenue','s-today','s-unread','s-contacts']
    .forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.innerHTML = '<span class="skeleton" style="display:inline-block;width:60px;height:32px;border-radius:6px"></span>';
      }
    });
}
