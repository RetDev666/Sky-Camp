import { apiFetch, showToast } from './app.js';

export async function loadUsers() {
  const tbody = document.getElementById('users-tbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="5">Завантаження...</td></tr>';
  
  try {
    const { users } = await apiFetch('/users');
    if (!users || !users.length) {
      tbody.innerHTML = '<tr><td colspan="5">Адміністраторів не знайдено</td></tr>';
      return;
    }
    
    tbody.innerHTML = users.map(u => `
      <tr>
        <td>${u.id}</td>
        <td><strong>${escape(u.username)}</strong></td>
        <td><span class="badge badge-paid">${escape(u.role)}</span></td>
        <td>${u.created_at.slice(0, 16)}</td>
        <td>
          <button class="btn btn-danger btn-sm" onclick="deleteUser(${u.id})">
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

export async function deleteUser(id) {
  if (!confirm('Ви дійсно хочете видалити цього адміністратора?')) return;
  try {
    const res = await apiFetch(`/users/${id}`, { method: 'DELETE' });
    if (res.ok) {
      showToast('Користувача видалено', 'success');
      loadUsers();
    }
  } catch (err) {
    if (err.message !== 'Unauthorized') showToast(err.message, 'error');
  }
}

const form = document.getElementById('new-user-form');
if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = document.getElementById('new-user-username').value;
    const pass = document.getElementById('new-user-password').value;
    try {
      const res = await apiFetch('/users', {
        method: 'POST',
        body: JSON.stringify({ username: user, password: pass })
      });
      if (res.ok) {
        showToast('Адміністратора створено', 'success');
        document.getElementById('user-modal').classList.add('hidden');
        form.reset();
        loadUsers();
      }
    } catch (err) {
      if (err.message !== 'Unauthorized') showToast(err.message, 'error');
    }
  });
}

function escape(str) {
  return String(str || '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\\'':'&#39;','"':'&quot;'}[c]));
}
