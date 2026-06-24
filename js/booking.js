/* =============================================
   Sky Camp — Booking Page Logic
   ============================================= */
(function () {
  'use strict';

  /* ─── Program Data ───────────────────────── */
  const PROGRAMS = {
    '1': { name: 'Літня пригода в дикій природі', dates: '5 черв — 19 черв', price: 28500, oldPrice: 31000 },
    '2': { name: 'Майстри вершин',                dates: '10 лип — 24 лип',  price: 31000, oldPrice: null  },
    '3': { name: 'Осіннє відкриття',              dates: '2 серп — 16 серп', price: 26000, oldPrice: 28000 },
  };

  let currentStep  = 0;
  let currentShift = '1';

  /* ─── Helpers ────────────────────────────── */
  const fmt = n  => '₴' + n.toLocaleString('uk-UA');
  const el  = id => document.getElementById(id);
  const val = id => { const e = el(id); return e ? e.value.trim() : ''; };

  function showError(input, msg) {
    input.classList.add('input-error');
    let err = input.parentElement.querySelector('.field-error');
    if (!err) {
      err = document.createElement('p');
      err.className = 'field-error';
      input.parentElement.appendChild(err);
    }
    err.textContent = msg;
  }

  function clearError(input) {
    input.classList.remove('input-error');
    input.parentElement.querySelector('.field-error')?.remove();
  }

  /* ─── Phone mask ─────────────────────────── */
  function applyPhoneMask(input) {
    input.addEventListener('input', function () {
      let v = this.value.replace(/\D/g, '');
      if (v.startsWith('38')) v = v.slice(2);
      if (!v.length) { this.value = ''; return; }
      let out = '(';
      if (v.length <= 3)      out += v;
      else if (v.length <= 6) out += v.slice(0,3) + ') ' + v.slice(3);
      else if (v.length <= 8) out += v.slice(0,3) + ') ' + v.slice(3,6) + '-' + v.slice(6);
      else                    out += v.slice(0,3) + ') ' + v.slice(3,6) + '-' + v.slice(6,8) + '-' + v.slice(8,10);
      this.value = out;
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Backspace' && (this.value.endsWith(') ') || this.value.endsWith('-'))) {
        this.value = this.value.slice(0, -1);
        e.preventDefault();
      }
    });
  }

  /* ─── Shift selection ────────────────────── */
  function selectShift(id) {
    currentShift = String(id);
    document.querySelectorAll('.shift-card').forEach(c => {
      c.classList.toggle('active', String(c.dataset.shift) === currentShift);
    });
    updateSidebar();
  }

  /* ─── Sidebar update ─────────────────────── */
  function updateSidebar() {
    const p = PROGRAMS[currentShift];
    if (!p) return;
    el('summary-program-name').textContent = p.name;
    el('summary-dates').textContent        = p.dates;
    el('summary-base').textContent         = fmt(p.price);
    const totalEl = el('summary-total');
    totalEl.textContent = fmt(p.price);
    totalEl.classList.remove('price-flash');
    void totalEl.offsetWidth; // reflow trigger
    totalEl.classList.add('price-flash');
  }

  /* ─── Stepper UI ─────────────────────────── */
  function updateStepper(idx) {
    document.querySelectorAll('.step-indicator').forEach((el, i) => {
      el.classList.toggle('active',    i === idx);
      el.classList.toggle('completed', i < idx);
    });
    el('line-1')?.classList.toggle('done', idx > 0);
    el('line-2')?.classList.toggle('done', idx > 1);
  }

  function goToStep(idx) {
    el('step-panel-' + currentStep).hidden = true;
    currentStep = idx;
    const panel = el('step-panel-' + currentStep);
    panel.hidden = false;
    // Re-trigger animations on newly shown panel
    panel.querySelectorAll('[data-animate]').forEach(e => {
      e.classList.remove('is-visible');
      requestAnimationFrame(() => e.classList.add('is-visible'));
    });
    updateStepper(idx);
    if (idx === 2) populateReview();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ─── Validation ─────────────────────────── */
  function validateStep2() {
    let ok = true;
    const required = {
      'child-first':  "Введіть ім'я дитини",
      'child-last':   'Введіть прізвище дитини',
      'child-dob':    'Оберіть дату народження',
      'parent-name':  'Введіть ПІБ батька/матері',
    };

    Object.entries(required).forEach(([id, msg]) => {
      const inp = el(id);
      if (!inp) return;
      clearError(inp);
      if (!inp.value.trim()) { showError(inp, msg); ok = false; }
    });

    const emailInp = el('parent-email');
    clearError(emailInp);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInp.value.trim())) {
      showError(emailInp, 'Введіть коректний email');
      ok = false;
    }

    const phoneInp = el('parent-phone');
    clearError(phoneInp);
    if (phoneInp.value.replace(/\D/g,'').length < 10) {
      showError(phoneInp, 'Введіть повний номер телефону');
      ok = false;
    }

    if (!ok) {
      // Scroll to first error
      el('step-panel-1').querySelector('.input-error')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    return ok;
  }

  /* ─── Gather all form data ───────────────── */
  function collectFormData(bookingId) {
    const p    = PROGRAMS[currentShift];
    const chip = document.querySelector('.age-chip.selected:not(#diet-chips .age-chip)');
    const diets = [...document.querySelectorAll('#diet-chips .age-chip.selected')]
      .map(b => b.textContent.trim()).join(', ') || 'Немає';

    return {
      bookingId,
      program:        p.name,
      dates:          p.dates,
      price:          fmt(p.price),
      childName:      [val('child-first'), val('child-last')].filter(Boolean).join(' '),
      childDob:       val('child-dob'),
      childAge:       chip ? chip.textContent.trim() : 'Не вказано',
      parentName:     val('parent-name'),
      parentEmail:    val('parent-email'),
      parentPhone:    el('parent-phone')?.value || '',
      parentPhone2:   el('parent-phone2')?.value || '',
      medAllergies:   val('med-allergies')   || 'Немає',
      medConditions:  val('med-conditions')  || 'Немає',
      medMedications: val('med-medications') || 'Немає',
      medDiet:        diets,
    };
  }

  /* ─── Populate Review step ───────────────── */
  function populateReview() {
    const data = collectFormData('—');
    el('review-program').textContent    = data.program;
    el('review-dates').textContent      = data.dates;
    el('review-name').textContent       = data.childName   || '—';
    el('review-dob').textContent        = data.childDob    || '—';
    el('review-age').textContent        = data.childAge;
    el('review-parent').textContent     = data.parentName  || '—';
    el('review-email').textContent      = data.parentEmail || '—';
    el('review-phone').textContent      = data.parentPhone || '—';
    el('review-price').textContent      = data.price;
    el('review-allergies')  && (el('review-allergies').textContent   = data.medAllergies);
    el('review-conditions') && (el('review-conditions').textContent  = data.medConditions);
    el('review-medications')&& (el('review-medications').textContent = data.medMedications);
    el('review-diet')       && (el('review-diet').textContent        = data.medDiet);
  }

  /* ─── Diet chips (multi-select) ─────────── */
  function toggleDiet(btn) {
    if (btn.textContent.trim() === 'Немає') {
      document.querySelectorAll('#diet-chips .age-chip').forEach(c => c.classList.remove('selected'));
      btn.classList.add('selected');
    } else {
      document.querySelectorAll('#diet-chips .age-chip')
        .forEach(b => { if (b.textContent.trim() === 'Немає') b.classList.remove('selected'); });
      btn.classList.toggle('selected');
    }
  }

  /* ─── Confirm & Send Booking ─────────────── */
  async function confirmBooking() {
    const btn = el('confirm-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="material-symbols-outlined" style="animation:spin 1s linear infinite">progress_activity</span> Відправляємо...';

    const num       = String(Math.floor(Math.random() * 9000) + 1000);
    const bookingId = '#SKY-2026-' + num;
    const data      = collectFormData(bookingId);

    try {
      // Send to Telegram
      if (window.SkyTelegram) {
        await window.SkyTelegram.sendBooking(data);
      }
    } catch (err) {
      console.warn('[Sky Camp] Telegram недоступний, продовжуємо без сповіщення:', err.message);
      // Do NOT block the user — show success regardless
    }

    // Show success screen
    const p = PROGRAMS[currentShift];
    el('success-booking-num').textContent = bookingId;
    el('success-program').textContent     = p.name;
    el('success-dates').textContent       = p.dates;
    el('success-name').textContent        = data.childName;

    el('booking-header').style.display  = 'none';
    el('summary-sidebar').style.display = 'none';
    el('step-panel-' + currentStep).hidden = true;
    currentStep = 3;
    el('step-panel-3').hidden = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ─── URL param: ?shift=2 ────────────────── */
  function applyURLParam() {
    const params = new URLSearchParams(window.location.search);
    const shift  = params.get('shift');
    if (shift && PROGRAMS[shift]) selectShift(Number(shift));
  }

  /* ─── Init ───────────────────────────────── */
  document.addEventListener('DOMContentLoaded', () => {
    applyURLParam();
    updateSidebar();

    // Phone masks
    ['parent-phone', 'parent-phone2'].forEach(id => {
      const inp = el(id);
      if (inp) applyPhoneMask(inp);
    });

    // Clear errors on input
    document.querySelectorAll('.input').forEach(inp => {
      inp.addEventListener('input', () => clearError(inp));
    });

    // Age chips (single select) — exclude diet chips
    document.querySelectorAll('.age-chips:not(#diet-chips) .age-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        btn.closest('.age-chips').querySelectorAll('.age-chip')
          .forEach(c => c.classList.remove('selected'));
        btn.classList.add('selected');
      });
    });

    // Expose globals for inline onclick
    window.goToStep        = goToStep;
    window.selectShift     = selectShift;
    window.toggleDiet      = toggleDiet;
    window.confirmBooking  = confirmBooking;
    window.validateAndNext = (toStep) => {
      let valid = true;
      if (currentStep === 1) valid = validateStep2();
      if (valid) goToStep(toStep);
    };
  });
})();
