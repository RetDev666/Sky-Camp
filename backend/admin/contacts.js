// =============================================
//  Sky Camp Admin — Contacts Section
// =============================================
import { apiFetch, showToast, renderPagination, State } from './app.js';
import { loadStats } from './dashboard.js';

/* ── Load contacts list ─────────────────────── */
export async function loadContacts(page = 1, toggleUnread = false) {
  if (toggleUnread) State.showUnreadOnly = !State.showUnreadOnly;

  const params = new URLSearchParams({ page, limit: 15 });
  if (State.showUnreadOnly) params.set('unread', '1');

  const tbody = document.getElementById('contacts-tbody');
  const filterBtn = document.getElementById('contacts-filter-btn');

  if (!tbody) return;

  // Update filter button state
  if (filterBtn) {
    filterBtn.classList.toggle('btn-primary', State.showUnreadOnly);
    filterBtn.classList.toggle('btn-ghost',  !State.showUnreadOnly);
  }

  // Skeleton
  tbody.innerHTML = Array(5).fill(0).map(() =>
    `<tr>${Array(6).fill('<td><span class="skeleton" style="display:block;height:14px;border-radius:4px"></span></td>').join('')}</tr>`
  ).join('');

  try {
    const { contacts, pages } = await apiFetch(`/contacts?${params}`);

    if (!contacts?.length) {
      tbody.innerHTML = `
        <tr><td colspan="6">
          <div class="empty">
            <span class="material-symbols-outlined">mail</span>
            <p>${State.showUnreadOnly ? 'Непрочитаних повідомлень немає' : 'Немає повідомлень'}</p>
          </div>
        </td></tr>`;
    } else {
      tbody.innerHTML = contacts.map(c => `
        <tr style="${!c.is_read ? 'font-weight:600' : 'opacity:0.85'}">
          <td>${escHtml(c.name)}</td>
          <td><a href="mailto:${escHtml(c.email)}">${escHtml(c.email)}</a></td>
          <td><span style="max-width:120px;display:inline-block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escHtml(c.subject)}">${escHtml(c.subject)}</span></td>
          <td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"
              title="${escHtml(c.message)}">${escHtml(c.message)}</td>
          <td style="color:var(--muted);font-size:12px;white-space:nowrap">${c.created_at.slice(0,16)}</td>
          <td>${
            !c.is_read
              ? `<button class="btn btn-ghost btn-sm" data-contact-id="${c.id}">
                   <span class="material-symbols-outlined" style="font-size:14px">mark_email_read</span>
                   Прочитано
                 </button>`
              : '<span style="color:var(--muted);font-size:12px">✓ Прочитано</span>'
          }</td>
        </tr>
      `).join('');

      // Attach event listeners
      tbody.querySelectorAll('[data-contact-id]').forEach(btn => {
        btn.addEventListener('click', () => markRead(Number(btn.dataset.contactId), btn));
      });
    }

    renderPagination('contacts-pagination', page, pages || 1, loadContacts);

  } catch (err) {
    if (err.message !== 'Unauthorized') {
      tbody.innerHTML = `<tr><td colspan="6"><div class="empty"><span class="material-symbols-outlined">error</span><p>Помилка завантаження</p></div></td></tr>`;
    }
  }
}

/* ── Mark contact as read ──────────────────── */
export async function markRead(id, btn) {
  try {
    await apiFetch(`/contacts/${id}/read`, { method: 'PATCH' });
    const row = btn.closest('tr');
    row.style.fontWeight = '';
    row.style.opacity    = '0.85';
    btn.replaceWith(Object.assign(document.createElement('span'), {
      style: 'color:var(--muted);font-size:12px',
      textContent: '✓ Прочитано',
    }));
    showToast('Позначено як прочитане', 'success');
    loadStats(); // refresh unread count in sidebar
  } catch (err) {
    if (err.message !== 'Unauthorized') showToast('Помилка', 'error');
  }
}

/* ── Helper ─────────────────────────────────── */
function escHtml(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ── Expose for sidebar onclick ─────────────── */
window.loadContacts = loadContacts;
