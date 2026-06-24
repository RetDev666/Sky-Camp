import { apiFetch, showToast } from './app.js';

export async function loadShifts() {
  const tbody = document.getElementById('shifts-tbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="5">Завантаження...</td></tr>';
  
  try {
    const { shifts } = await apiFetch('/shifts');
    if (!shifts || !shifts.length) {
      tbody.innerHTML = '<tr><td colspan="5">Жодної зміни не додано.</td></tr>';
      return;
    }
    
    tbody.innerHTML = shifts.map(s => `
      <tr>
        <td>${s.id}</td>
        <td><strong>${escape(s.name)}</strong></td>
        <td>${escape(s.start_date)}</td>
        <td>${escape(s.end_date)}</td>
        <td>
          <button class="btn btn-danger btn-sm" onclick="deleteShift(${s.id})">
            <span class="material-symbols-outlined">delete</span>
          </button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    if (err.message !== 'Unauthorized') {
      tbody.innerHTML = `<tr><td colspan="5">Помилка завантаження: ${escape(err.message)}</td></tr>`;
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
    
    try {
      const res = await apiFetch('/shifts', {
        method: 'POST',
        body: JSON.stringify({ name, start_date, end_date })
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
