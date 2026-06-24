// =============================================
//  Sky Camp — Email Service (nodemailer)
//  Налаштуйте SMTP_* змінні в .env
// =============================================
import { createLogger } from './logger.js';

const log = createLogger('EMAIL');

/* ── Lazy-load nodemailer (optional dep) ──── */
let transporter = null;

async function getTransporter() {
  if (transporter) return transporter;

  const { HOST, PORT, USER, PASS, FROM } = getSmtpConfig();
  if (!HOST || !USER) {
    log.warn('SMTP not configured — email sending disabled');
    return null;
  }

  try {
    const nodemailer = await import('nodemailer');
    transporter = nodemailer.default.createTransport({
      host:   HOST,
      port:   Number(PORT) || 587,
      secure: Number(PORT) === 465,
      auth:   { user: USER, pass: PASS },
    });
    await transporter.verify();
    log.info('SMTP connected', { host: HOST, port: PORT });
  } catch (err) {
    log.error('SMTP connection failed', { error: err.message });
    transporter = null;
  }
  return transporter;
}

function getSmtpConfig() {
  return {
    HOST: process.env.SMTP_HOST,
    PORT: process.env.SMTP_PORT || '587',
    USER: process.env.SMTP_USER,
    PASS: process.env.SMTP_PASS,
    FROM: process.env.SMTP_FROM || `Sky Camp <noreply@sky-camp.pp.ua>`,
  };
}

async function sendMail(options) {
  const t = await getTransporter();
  if (!t) {
    log.warn('Email skipped (no SMTP)', { to: options.to, subject: options.subject });
    return false;
  }
  try {
    const info = await t.sendMail({ from: getSmtpConfig().FROM, ...options });
    log.info('Email sent', { to: options.to, subject: options.subject, id: info.messageId });
    return true;
  } catch (err) {
    log.error('Email send failed', { to: options.to, error: err.message });
    return false;
  }
}

/* ── Booking confirmation ──────────────────── */
export async function sendBookingConfirmation(booking) {
  const html = `
    <!DOCTYPE html>
    <html lang="uk">
    <head><meta charset="utf-8"><style>
      body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1e293b; margin: 0; padding: 0; background: #f0f4f8; }
      .wrap { max-width: 560px; margin: 32px auto; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,.1); }
      .header { background: #005daa; color: #fff; padding: 32px; text-align: center; }
      .header h1 { margin: 0; font-size: 26px; }
      .header p  { margin: 8px 0 0; opacity: .8; font-size: 14px; }
      .body { padding: 32px; }
      .ref-box { background: #e8f1ff; border-radius: 10px; padding: 16px 20px; margin-bottom: 24px; text-align: center; }
      .ref-box strong { display: block; font-size: 22px; color: #005daa; letter-spacing: .08em; }
      .ref-box span { font-size: 13px; color: #64748b; }
      table { width: 100%; border-collapse: collapse; margin: 0 0 24px; }
      td { padding: 10px 0; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
      td:first-child { color: #64748b; width: 140px; }
      .section-title { font-size: 11px; font-weight: 700; color: #005daa; letter-spacing: .1em; text-transform: uppercase; margin: 24px 0 8px; }
      .footer { background: #f8fafc; padding: 20px 32px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
      .btn { display: inline-block; background: #005daa; color: #fff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; margin-top: 20px; }
    </style></head>
    <body>
    <div class="wrap">
      <div class="header">
        <h1>🏕️ Sky Camp</h1>
        <p>Підтвердження бронювання</p>
      </div>
      <div class="body">
        <p>Вітаємо, <strong>${booking.parent_name}</strong>!</p>
        <p>Ваше бронювання успішно прийнято. Ось ваш номер референсу:</p>

        <div class="ref-box">
          <strong>${booking.booking_ref}</strong>
          <span>Збережіть цей номер для перевірки статусу</span>
        </div>

        <p class="section-title">Деталі програми</p>
        <table>
          <tr><td>Зміна</td><td>${booking.program}</td></tr>
          <tr><td>Дати</td><td>${booking.dates}</td></tr>
          <tr><td>Вартість</td><td>₴${Number(booking.price).toLocaleString('uk-UA')}</td></tr>
        </table>

        <p class="section-title">Учасник</p>
        <table>
          <tr><td>Дитина</td><td>${booking.child_first} ${booking.child_last}</td></tr>
          <tr><td>Дата нар.</td><td>${booking.child_dob}</td></tr>
        </table>

        <p>Наш менеджер зв'яжеться з вами протягом <strong>24 годин</strong> для підтвердження та уточнення деталей оплати.</p>

        <center>
          <a href="https://sky-camp.pp.ua/status?ref=${booking.booking_ref}" class="btn">
            Перевірити статус онлайн →
          </a>
        </center>
      </div>
      <div class="footer">
        Sky Camp · Карпати, Україна · <a href="mailto:hello@sky-camp.pp.ua">hello@sky-camp.pp.ua</a><br/>
        © 2026 Sky Camp. Усі права захищено.
      </div>
    </div>
    </body></html>
  `;

  return sendMail({
    to:      booking.parent_email,
    subject: `✅ Бронювання #${booking.booking_ref} — Sky Camp підтверджено`,
    html,
    text:    `Бронювання ${booking.booking_ref} прийнято. Програма: ${booking.program}, Дати: ${booking.dates}. Менеджер зв'яжеться протягом 24 годин.`,
  });
}

/* ── Contact auto-reply ────────────────────── */
export async function sendContactAutoReply(contact) {
  const html = `
    <!DOCTYPE html><html lang="uk"><head><meta charset="utf-8"><style>
      body { font-family: Arial, sans-serif; color: #1e293b; }
      .wrap { max-width: 480px; margin: 32px auto; background: #fff; border-radius: 12px; overflow: hidden; }
      .header { background: #005daa; color: #fff; padding: 24px 32px; }
      .body { padding: 32px; }
      .footer { background: #f8fafc; padding: 16px 32px; font-size: 12px; color: #94a3b8; }
    </style></head>
    <body><div class="wrap">
      <div class="header"><h2 style="margin:0">🏕️ Sky Camp</h2></div>
      <div class="body">
        <p>Вітаємо, <strong>${contact.name}</strong>!</p>
        <p>Дякуємо за ваше звернення. Ми отримали ваше повідомлення і відповімо протягом <strong>24 годин</strong>.</p>
        <p><em>Тема: ${contact.subject}</em></p>
        <p>Якщо ваше питання термінове, зателефонуйте нам: <strong>+380 44 123 4567</strong></p>
      </div>
      <div class="footer">© 2026 Sky Camp · <a href="https://sky-camp.pp.ua">sky-camp.pp.ua</a></div>
    </div></body></html>
  `;

  return sendMail({
    to:      contact.email,
    subject: 'Ми отримали ваше звернення — Sky Camp',
    html,
    text: `Дякуємо, ${contact.name}! Ми відповімо протягом 24 годин.`,
  });
}
