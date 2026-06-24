// =============================================
//  Sky Camp Admin — Core App State & Auth
// =============================================

const API = '/api/admin';

const State = {
  currentSection: 'dashboard',
  currentStatus:  'all',
  currentPage:    1,
  showUnreadOnly: false,
  searchTimer:    null,
};

/* ── Auth ──────────────────────────────────── */
export function getHeaders() {
  const token = localStorage.getItem('admin_token');
  return {
    Authorization:  'Bearer ' + token,
    'Content-Type': 'application/json',
  };
}

export async function promptLogin(message = '') {
  if (message) showToast(message, 'error');
  const user = prompt('Логін адміністратора:');
  const pass = prompt('Пароль:');
  if (user && pass) {
    try {
      const res = await fetch(`${API}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user, password: pass })
      });
      const data = await res.json();
      if (data.ok && data.token) {
        localStorage.setItem('admin_token', data.token);
        location.reload();
      } else {
        alert('Невірний логін або пароль');
        promptLogin();
      }
    } catch (err) {
      alert('Помилка входу');
    }
  }
}

export function logout() {
  if (!confirm('Ви дійсно хочете вийти?')) return;
  localStorage.removeItem('admin_token');
  location.reload();
}

/* ── API helper ────────────────────────────── */
export async function apiFetch(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: { ...getHeaders(), ...(options.headers || {}) },
  });
  if (res.status === 401 || res.status === 403) {
    promptLogin('Сесія завершена. Увійдіть знову.');
    throw new Error('Unauthorized');
  }
  const json = await res.json();
  if (!res.ok || !json.ok) {
    throw new Error(json.error || 'API Error');
  }
  return json;
}

/* ── Toast ─────────────────────────────────── */
export function showToast(msg, type = '') {
  const existing = document.getElementById('toast');
  if (existing) existing.remove();

  const t = document.createElement('div');
  t.id = 'toast';
  t.className = `toast${type ? ' toast-' + type : ''}`;
  t.innerHTML = `<span class="material-symbols-outlined" style="font-size:16px">${
    type === 'success' ? 'check_circle' : type === 'error' ? 'error' : 'info'
  }</span><span>${msg}</span>`;
  document.body.appendChild(t);
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.remove(), 3500);
}

/* ── Pagination ────────────────────────────── */
export function renderPagination(containerId, current, total, onPageChange) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = '';
  if (total <= 1) return;

  for (let i = 1; i <= total; i++) {
    const btn = document.createElement('button');
    btn.className = 'pag-btn' + (i === current ? ' active' : '');
    btn.textContent = i;
    btn.addEventListener('click', () => onPageChange(i));
    el.appendChild(btn);
  }
}

/* ── Status badge ──────────────────────────── */
export function statusBadge(status) {
  const labels = { pending: 'В обробці', paid: 'Оплачено', cancelled: 'Скасовано' };
  return `<span class="badge badge-${status}">${labels[status] || status}</span>`;
}

/* ── Navigation ────────────────────────────── */
export function showSection(name) {
  State.currentSection = name;
  const sections = ['dashboard', 'bookings', 'contacts'];

  sections.forEach(s => {
    const el = document.getElementById(`section-${s}`);
    if (el) el.style.display = s === name ? '' : 'none';
  });

  document.querySelectorAll('.nav-item[data-section]').forEach(el => {
    el.classList.toggle('active', el.dataset.section === name);
  });

  if (name === 'dashboard') import('./dashboard.js').then(m => m.loadStats());
  if (name === 'bookings')  import('./bookings.js').then(m => m.loadBookings(1));
  if (name === 'contacts')  import('./contacts.js').then(m => m.loadContacts(1));
}

/* ── Expose to global for HTML onclick attrs ─ */
window.Admin = { showSection, logout };

export { State };
