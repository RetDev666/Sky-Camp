import { apiFetch, showToast } from './app.js';

export async function loadShifts() {
  const tbody = document.getElementById('shifts-tbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="7">Завантаження...</td></tr>';
  
  try {
    const { shifts } = await apiFetch('/shifts');
    if (!shifts || !shifts.length) {
      tbody.innerHTML = '<tr><td colspan="7">Жодної зміни не додано.</td></tr>';
      return;
    }
    
    tbody.innerHTML = shifts.map(s => `
      <tr>
        <td>${s.id}</td>
        <td><strong>${escape(s.name)}</strong></td>
        <td>${escape(s.start_date)}</td>
        <td>${escape(s.end_date)}</td>
        <td>₴${s.price || 0}</td>
        <td>${s.old_price ? '₴' + s.old_price : '—'}</td>
        <td>
          <button class="btn btn-danger btn-sm" onclick="deleteShift(${s.id})">
            <span class="material-symbols-outlined">delete</span>
          </button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    if (err.message !== 'Unauthorized') {
      tbody.innerHTML = `<tr><td colspan="7">Помилка завантаження: ${escape(err.message)}</td></tr>`;
    }
  }
}

export async function deleteShift(id) {
  if (!confirm('Ви дійсно хочете видалити цю зміну? Вона зникне зі списку бронювання на сайті.')) return;
  try {
    const res = await apiFetch(`/shifts/${id}`, { method: 'DELETE' });
    if (res.ok) {
      showToast('Зміну видалено', 'success');
      loadShifts();
    }
  } catch (err) {
    if (err.message !== 'Unauthorized') showToast(err.message, 'error');
  }
}

const form = document.getElementById('new-shift-form');
if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('new-shift-name').value;
    const start_date = document.getElementById('new-shift-start').value;
    const end_date = document.getElementById('new-shift-end').value;
    const price = document.getElementById('new-shift-price').value;
    const old_price = document.getElementById('new-shift-old-price').value || null;
    
    try {
      const res = await apiFetch('/shifts', {
        method: 'POST',
        body: JSON.stringify({ name, start_date, end_date, price: Number(price), old_price: old_price ? Number(old_price) : null })
      });
      if (res.ok) {
        showToast('Зміну додано', 'success');
        document.getElementById('shift-modal').classList.add('hidden');
        form.reset();
        loadShifts();
      }
    } catch (err) {
      if (err.message !== 'Unauthorized') showToast(err.message, 'error');
    }
  });
}

function escape(str) {
  return String(str || '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\\'':'&#39;','"':'&quot;'}[c]));
}
