// =============================================
//  Sky Camp Admin — Bookings Section
// =============================================
import { apiFetch, showToast, renderPagination, statusBadge, State } from './app.js';

/* ── Load bookings list ─────────────────────── */
export async function loadBookings(page = 1) {
  State.currentPage = page;
  const search = document.getElementById('booking-search')?.value || '';
  const params = new URLSearchParams({
    page,
    limit:  15,
    status: State.currentStatus,
  });
  if (search) params.set('search', search);

  const tbody = document.getElementById('bookings-tbody');
  if (!tbody) return;

  // Skeleton rows
  tbody.innerHTML = Array(5).fill(0).map(() =>
    `<tr>${Array(8).fill('<td><span class="skeleton" style="display:block;height:16px;border-radius:4px"></span></td>').join('')}</tr>`
  ).join('');

  try {
    const { bookings, pages } = await apiFetch(`/bookings?${params}`);

    if (!bookings?.length) {
      tbody.innerHTML = `
        <tr><td colspan="8">
          <div class="empty">
            <span class="material-symbols-outlined">inbox</span>
            <p>Бронювань не знайдено</p>
          </div>
        </td></tr>`;
    } else {
      tbody.innerHTML = bookings.map(b => `
        <tr>
          <td><code style="font-size:12px;color:var(--primary)">${escHtml(b.booking_ref)}</code></td>
          <td><strong>${escHtml(b.child_first)} ${escHtml(b.child_last)}</strong></td>
          <td style="color:var(--muted)">${escHtml(b.parent_email)}</td>
          <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"
              title="${escHtml(b.program)}">${escHtml(b.program)}</td>
          <td style="font-variant-numeric:tabular-nums">₴${Number(b.price).toLocaleString('uk-UA')}</td>
          <td>${statusBadge(b.status)}</td>
          <td style="color:var(--muted);font-size:12px;white-space:nowrap">${b.created_at.slice(0,16)}</td>
          <td>
            <button class="btn btn-ghost btn-sm" data-booking-id="${b.id}">
              <span class="material-symbols-outlined" style="font-size:14px">open_in_new</span>
              Деталі
            </button>
          </td>
        </tr>
      `).join('');

      // Attach event listeners instead of inline onclick
      tbody.querySelectorAll('[data-booking-id]').forEach(btn => {
        btn.addEventListener('click', () => openBookingModal(Number(btn.dataset.bookingId)));
      });
    }

    renderPagination('bookings-pagination', page, pages || 1, loadBookings);

  } catch (err) {
    if (err.message !== 'Unauthorized') {
      tbody.innerHTML = `<tr><td colspan="8"><div class="empty"><span class="material-symbols-outlined">error</span><p>Помилка завантаження</p></div></td></tr>`;
    }
  }
}

/* ── Filter by status tab ──────────────────── */
export function filterBookings(status, el) {
  State.currentStatus = status;
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  if (el) el.classList.add('active');
  loadBookings(1);
}

/* ── Debounced search ──────────────────────── */
export function debouncedSearch() {
  clearTimeout(State.searchTimer);
  State.searchTimer = setTimeout(() => loadBookings(1), 350);
}

/* ── Booking detail modal ──────────────────── */
export async function openBookingModal(id) {
  const modal = document.getElementById('booking-modal');
  if (!modal) return;

  // Show modal with loader
  document.getElementById('modal-ref').textContent = 'Завантаження...';
  document.getElementById('modal-body').innerHTML   = '<div style="padding:40px;text-align:center"><span class="skeleton" style="display:inline-block;width:80%;height:400px;border-radius:8px"></span></div>';
  document.getElementById('modal-footer').innerHTML = '';
  modal.classList.remove('hidden');

  try {
    const { booking: b } = await apiFetch(`/bookings/${id}`);
    document.getElementById('modal-ref').textContent = `#${b.booking_ref}`;

    document.getElementById('modal-body').innerHTML = `
      <div class="modal-section">Програма</div>
      ${row('Зміна',    escHtml(b.program))}
      ${row('Дати',     escHtml(b.dates))}
      ${row('Вартість', `₴${Number(b.price).toLocaleString('uk-UA')}`)}
      ${row('Статус',   statusBadge(b.status))}

      <div class="modal-section">Учасник</div>
      ${row("Ім'я",            `${escHtml(b.child_first)} ${escHtml(b.child_last)}`)}
      ${row('Дата народження', escHtml(b.child_dob))}
      ${row('Вікова група',    escHtml(b.child_age))}

      <div class="modal-section">Батьки</div>
      ${row('ПІБ',    escHtml(b.parent_name))}
      ${row('Email',  `<a href="mailto:${escHtml(b.parent_email)}">${escHtml(b.parent_email)}</a>`)}
      ${row('Тел.',   escHtml(b.parent_phone) + (b.parent_phone2 ? ` / ${escHtml(b.parent_phone2)}` : ''))}

      <div class="modal-section">Медична інформація</div>
      ${row('Алергії',    escHtml(b.med_allergies  || '—'))}
      ${row('Захворювання', escHtml(b.med_conditions || '—'))}
      ${row('Ліки',       escHtml(b.med_medications || '—'))}
      ${row('Дієта',      escHtml(b.med_diet        || '—'))}

      <div class="modal-section">Системна інформація</div>
      ${row('Дата заявки', b.created_at)}
      ${row('Оновлено',    b.updated_at)}
      ${row('IP адреса',   escHtml(b.ip_address || '—'))}
    `;

    document.getElementById('modal-footer').innerHTML = `
      <button class="btn btn-success" data-action="paid">
        <span class="material-symbols-outlined">check_circle</span> Оплачено
      </button>
      <button class="btn btn-danger" data-action="cancelled">
        <span class="material-symbols-outlined">cancel</span> Скасувати
      </button>
      <button class="btn btn-ghost" data-action="pending">
        <span class="material-symbols-outlined">pending</span> В обробці
      </button>
      <button class="btn btn-ghost" style="margin-left:auto" id="modal-close-btn">Закрити</button>
    `;

    document.getElementById('modal-close-btn').addEventListener('click', closeModal);
    document.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => changeStatus(b.id, btn.dataset.action));
    });

  } catch (err) {
    if (err.message !== 'Unauthorized') {
      document.getElementById('modal-body').innerHTML = '<div class="empty"><span class="material-symbols-outlined">error</span><p>Не вдалося завантажити дані</p></div>';
    }
  }
}

/* ── Change booking status ─────────────────── */
export async function changeStatus(id, status) {
  try {
    const data = await apiFetch(`/bookings/${id}/status`, {
      method: 'PATCH',
      body:   JSON.stringify({ status }),
    });
    if (data.ok) {
      showToast('Статус оновлено ✓', 'success');
      closeModal();
      loadBookings(State.currentPage);
    } else {
      showToast(data.error || 'Помилка оновлення', 'error');
    }
  } catch (err) {
    if (err.message !== 'Unauthorized') showToast('Помилка сервера', 'error');
  }
}

/* ── Modal close ───────────────────────────── */
export function closeModal() {
  document.getElementById('booking-modal')?.classList.add('hidden');
}

/* ── Helpers ───────────────────────────────── */
function row(label, value) {
  return `
    <div class="modal-row">
      <div class="modal-row-label">${label}</div>
      <div>${value}</div>
    </div>`;
}

function escHtml(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ── Expose to window for sidebar onclick ─── */
window.filterBookings  = filterBookings;
window.debouncedSearch = debouncedSearch;
window.closeModal      = closeModal;
