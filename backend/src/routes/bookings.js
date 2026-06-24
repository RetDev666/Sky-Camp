// =============================================
//  Sky Camp — Bookings Router
//  POST /api/bookings   — Create booking
//  GET  /api/bookings/:ref — Get by reference (for confirmation page)
// =============================================
import { Router } from 'express';
import { getDb } from '../db.js';
import { notifyBooking } from '../telegram.js';
import { sendBookingConfirmation } from '../email.js';
import { createLogger } from '../logger.js';

const log = createLogger('BOOKINGS');
const router = Router();

/* ── Validation ─────────────────────────────── */
function validate(body) {
  const errors = [];
  const req = (field, label) => {
    if (!body[field]?.toString().trim()) errors.push(`${label} є обов'язковим`);
  };

  req('program',      'Програма');
  req('dates',        'Дати');
  req('price',        'Вартість');
  req('child_first',  "Ім'я дитини");
  req('child_last',   'Прізвище дитини');
  req('child_dob',    'Дата народження');
  req('child_age',    'Вікова група');
  req('parent_name',  'ПІБ батьків');
  req('parent_phone', 'Телефон');

  if (!body.parent_email?.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
    errors.push('Невірний формат email');
  }
  if (body.price && (isNaN(body.price) || body.price < 1000)) {
    errors.push('Невірна вартість');
  }

  return errors;
}

/* ── Generate unique reference ──────────────── */
function genRef(db) {
  for (let i = 0; i < 10; i++) {
    const num = Math.floor(Math.random() * 90000) + 10000;
    const ref = `SKY-2026-${num}`;
    const exists = db.prepare('SELECT id FROM bookings WHERE booking_ref = ?').get(ref);
    if (!exists) return ref;
  }
  throw new Error('Cannot generate unique booking reference');
}

/* ── POST /api/bookings ─────────────────────── */
router.post('/', async (req, res) => {
  try {
    const errors = validate(req.body);
    if (errors.length) {
      return res.status(400).json({ ok: false, errors });
    }

    const db  = getDb();
    const ref = genRef(db);
    const b   = req.body;

    const stmt = db.prepare(`
      INSERT INTO bookings (
        booking_ref, program, dates, price,
        child_first, child_last, child_dob, child_age,
        parent_name, parent_email, parent_phone, parent_phone2,
        med_allergies, med_conditions, med_medications, med_diet,
        ip_address, user_agent
      ) VALUES (
        @booking_ref, @program, @dates, @price,
        @child_first, @child_last, @child_dob, @child_age,
        @parent_name, @parent_email, @parent_phone, @parent_phone2,
        @med_allergies, @med_conditions, @med_medications, @med_diet,
        @ip_address, @user_agent
      )
    `);

    const result = stmt.run({
      booking_ref:     ref,
      program:         b.program,
      dates:           b.dates,
      price:           Number(b.price),
      child_first:     b.child_first.trim(),
      child_last:      b.child_last.trim(),
      child_dob:       b.child_dob,
      child_age:       b.child_age,
      parent_name:     b.parent_name.trim(),
      parent_email:    b.parent_email.trim().toLowerCase(),
      parent_phone:    b.parent_phone,
      parent_phone2:   b.parent_phone2 || null,
      med_allergies:   b.med_allergies   || 'Немає',
      med_conditions:  b.med_conditions  || 'Немає',
      med_medications: b.med_medications || 'Немає',
      med_diet:        b.med_diet        || 'Немає',
      ip_address:      req.ip,
      user_agent:      req.get('User-Agent')?.slice(0, 200) || null,
    });

    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(result.lastInsertRowid);

    // Non-blocking: Telegram + Email
    notifyBooking(booking).catch(err =>
      log.error('Telegram notify failed', { error: err.message })
    );
    sendBookingConfirmation(booking).catch(err =>
      log.error('Email confirmation failed', { error: err.message })
    );

    log.info('Booking created', { ref, email: booking.parent_email });

    res.status(201).json({
      ok:          true,
      booking_ref: ref,
      id:          result.lastInsertRowid,
      message:     'Бронювання успішно створено',
    });

  } catch (err) {
    console.error('[BOOKING] Error:', err);
    res.status(500).json({ ok: false, error: 'Помилка сервера. Спробуйте пізніше.' });
  }
});

/* ── GET /api/bookings/:ref ──────────────────── */
router.get('/:ref', (req, res) => {
  try {
    const booking = getDb()
      .prepare('SELECT booking_ref, program, dates, price, child_first, child_last, status, created_at FROM bookings WHERE booking_ref = ?')
      .get(req.params.ref.toUpperCase());

    if (!booking) return res.status(404).json({ ok: false, error: 'Бронювання не знайдено' });
    res.json({ ok: true, booking });
  } catch (err) {
    res.status(500).json({ ok: false, error: 'Помилка сервера' });
  }
});

export default router;
