/* =============================================
   Sky Camp — API Client (Shared Hosting)
   Надсилає дані форм на form.php
   ============================================= */

const SkyAPI = (() => {
  async function post(endpoint, data) {
    const res = await fetch(endpoint, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(data),
    });

    const json = await res.json().catch(() => ({ ok: false, error: 'Помилка відповіді сервера' }));
    if (!res.ok) {
      throw Object.assign(new Error(json.error || 'Server error'), { status: res.status, data: json });
    }
    return json;
  }

  return { post };
})();

/* ── Booking submission ──────────────────── */
async function apiSendBooking(data) {
  return SkyAPI.post('/api/booking', {
    program:         data.program,
    dates:           data.dates,
    price:           data.price,
    child_first:     (data.childName || '').split(' ')[0] || data.childName,
    child_last:      (data.childName || '').split(' ').slice(1).join(' ') || '',
    child_dob:       data.childDob,
    child_age:       data.childAge,
    parent_name:     data.parentName,
    parent_email:    data.parentEmail,
    parent_phone:    data.parentPhone,
    parent_phone2:   data.parentPhone2 || '',
    med_allergies:   data.medAllergies   || 'Немає',
    med_conditions:  data.medConditions  || 'Немає',
    med_medications: data.medMedications || 'Немає',
    med_diet:        data.medDiet        || 'Немає',
  });
}

/* ── Contact form submission ─────────────── */
async function apiSendContact(data) {
  return SkyAPI.post('/api/contact', {
    name:    data.name,
    email:   data.email,
    subject: data.subject,
    message: data.message,
  });
}

/* ── Global namespace ────────────────────── */
window.SkyTelegram = {
  sendBooking: apiSendBooking,
  sendContact: apiSendContact,
};
