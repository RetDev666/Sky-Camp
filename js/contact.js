/* =============================================
   Sky Camp — Contact Form Logic
   ============================================= */
(function () {
  'use strict';

  const form    = document.querySelector('.contact-form');
  const submitBtn = document.getElementById('contact-submit');
  if (!form || !submitBtn) return;

  /* ─── Helpers ───────────────────────────── */
  function setLoading(on) {
    submitBtn.disabled = on;
    submitBtn.innerHTML = on
      ? '<span class="material-symbols-outlined" style="animation:spin 1s linear infinite">progress_activity</span> Відправляємо...'
      : 'Надіслати повідомлення <span class="material-symbols-outlined">send</span>';
  }

  function showField(id, msg) {
    const inp = document.getElementById(id);
    if (!inp) return;
    inp.classList.add('input-error');
    let err = inp.parentElement.querySelector('.field-error');
    if (!err) { err = document.createElement('p'); err.className = 'field-error'; inp.parentElement.appendChild(err); }
    err.textContent = msg;
  }

  function clearFields() {
    form.querySelectorAll('.input-error').forEach(i => i.classList.remove('input-error'));
    form.querySelectorAll('.field-error').forEach(e => e.remove());
  }

  function showToast(msg, type = 'success') {
    const toast = document.createElement('div');
    toast.className = 'contact-toast contact-toast--' + type;
    toast.innerHTML = `
      <span class="material-symbols-outlined fill">${type === 'success' ? 'check_circle' : 'error'}</span>
      <span>${msg}</span>
    `;
    document.body.appendChild(toast);
    // Animate in
    requestAnimationFrame(() => toast.classList.add('contact-toast--visible'));
    setTimeout(() => {
      toast.classList.remove('contact-toast--visible');
      setTimeout(() => toast.remove(), 400);
    }, 4000);
  }

  /* ─── Validation ────────────────────────── */
  function validate() {
    clearFields();
    let ok = true;

    const name = document.getElementById('contact-name');
    if (!name?.value.trim()) { showField('contact-name', "Введіть ім'я"); ok = false; }

    const email = document.getElementById('contact-email');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email?.value.trim() || '')) {
      showField('contact-email', 'Введіть коректний email'); ok = false;
    }

    const msg = document.getElementById('contact-message');
    if (!msg?.value.trim() || msg.value.trim().length < 10) {
      showField('contact-message', 'Повідомлення має містити щонайменше 10 символів'); ok = false;
    }

    return ok;
  }

  /* ─── Submit ────────────────────────────── */
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);

    const data = {
      name:    document.getElementById('contact-name')?.value.trim(),
      email:   document.getElementById('contact-email')?.value.trim(),
      subject: document.getElementById('contact-subject')?.value || 'Загальний запит',
      message: document.getElementById('contact-message')?.value.trim(),
    };

    try {
      if (window.SkyTelegram) {
        await window.SkyTelegram.sendContact(data);
      } else {
        // SkyTelegram not loaded yet — wait a tick and retry once
        await new Promise(r => setTimeout(r, 500));
        await window.SkyTelegram?.sendContact(data);
      }

      form.reset();
      clearFields();
      showToast('✅ Ваше повідомлення надіслано! Ми відповімо протягом 24 годин.');
    } catch (err) {
      console.error('[Sky Camp Contact] Помилка відправки:', err);
      showToast('Не вдалося надіслати. Спробуйте пізніше або зателефонуйте нам.', 'error');
    } finally {
      setLoading(false);
    }
  });

  // Clear errors on input
  form.querySelectorAll('.input').forEach(inp => {
    inp.addEventListener('input', () => {
      inp.classList.remove('input-error');
      inp.parentElement.querySelector('.field-error')?.remove();
    });
  });

})();
