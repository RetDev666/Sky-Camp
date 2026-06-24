// =============================================
//  Sky Camp — Telegram Notification Service
// =============================================

const BASE = () => `https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}`;
const CHAT  = () => process.env.TELEGRAM_CHAT_ID;

async function send(text) {
  if (!process.env.TELEGRAM_TOKEN || process.env.TELEGRAM_TOKEN === 'YOUR_BOT_TOKEN_HERE') {
    console.warn('[TG] Token not configured — skipping Telegram notification');
    return;
  }

  const res = await fetch(`${BASE()}/sendMessage`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id:    CHAT(),
      text,
      parse_mode: 'HTML',
    }),
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.error('[TG] API error:', err.description || res.status);
    throw new Error(err.description || `Telegram error ${res.status}`);
  }
}

function line(label, value) {
  if (!value || value === '—' || value === 'Не вказано') return '';
  return `\n<b>${label}:</b> ${value}`;
}

function section(title) {
  return `\n\n<b>── ${title} ──</b>`;
}

// ── Booking notification ──────────────────────
export async function notifyBooking(booking) {
  const now = new Date().toLocaleString('uk-UA', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Kyiv',
  });

  const text = [
    `🏕️ <b>НОВЕ БРОНЮВАННЯ — Sky Camp</b>`,
    `📅 ${now}`,
    `🆔 <b>${booking.booking_ref}</b>`,

    section('Програма'),
    line('Зміна',    booking.program),
    line('Дати',     booking.dates),
    line('Вартість', `₴${Number(booking.price).toLocaleString('uk-UA')}`),

    section('Учасник'),
    line("Ім'я",             `${booking.child_first} ${booking.child_last}`),
    line('Дата народження',  booking.child_dob),
    line('Вікова група',     booking.child_age),

    section('Контакти батьків'),
    line('ПІБ',       booking.parent_name),
    line('Email',     booking.parent_email),
    line('Телефон',   booking.parent_phone),
    booking.parent_phone2 ? line('Телефон 2', booking.parent_phone2) : '',

    section('Медична інформація'),
    line('Алергії',              booking.med_allergies),
    line('Захворювання',         booking.med_conditions),
    line('Ліки',                 booking.med_medications),
    line('Дієта',                booking.med_diet),

    `\n\n✅ <i>Підтверджено онлайн. ID: ${booking.id}</i>`,
    `\n🔗 <a href="http://localhost:${process.env.PORT || 3000}/admin">Адмін-панель</a>`,
  ].join('');

  await send(text);
}

// ── Contact notification ──────────────────────
export async function notifyContact(contact) {
  const now = new Date().toLocaleString('uk-UA', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Kyiv',
  });

  const text = [
    `📩 <b>НОВЕ ЗВЕРНЕННЯ — Sky Camp</b>`,
    `📅 ${now}`,

    section('Відправник'),
    line("Ім'я",  contact.name),
    line('Email', contact.email),
    line('Тема',  contact.subject),

    section('Повідомлення'),
    `\n${contact.message}`,
  ].join('');

  await send(text);
}

// ── Status change notification ────────────────
export async function notifyStatusChange(booking, newStatus) {
  const emoji = { paid: '💳', cancelled: '❌', pending: '⏳' }[newStatus] || '📋';
  const label = { paid: 'ОПЛАЧЕНО', cancelled: 'СКАСОВАНО', pending: 'В ОБРОБЦІ' }[newStatus] || newStatus;

  await send(
    `${emoji} <b>Статус змінено: ${label}</b>\n` +
    `🆔 ${booking.booking_ref} — ${booking.child_first} ${booking.child_last}\n` +
    `📋 ${booking.program}`
  );
}
