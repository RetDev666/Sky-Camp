import { apiFetch, showToast } from './app.js';

export async function loadSettings() {
  try {
    const { settings } = await apiFetch('/settings');
    if (settings) {
      const form = document.getElementById('settings-form');
      Object.keys(settings).forEach(key => {
        if (form.elements[key]) {
          form.elements[key].value = settings[key];
        }
      });
    }
  } catch (err) {
    if (err.message !== 'Unauthorized') showToast('Помилка завантаження налаштувань', 'error');
  }
}

export async function saveSettings() {
  const form = document.getElementById('settings-form');
  const formData = new FormData(form);
  const settings = {};
  formData.forEach((val, key) => settings[key] = val);

  try {
    const res = await apiFetch('/settings', {
      method: 'POST',
      body: JSON.stringify({ settings })
    });
    if (res.ok) showToast('Налаштування збережено', 'success');
  } catch (err) {
    if (err.message !== 'Unauthorized') showToast('Помилка збереження', 'error');
  }
}
