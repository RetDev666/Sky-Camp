import { Router }      from 'express';
import { getDb }       from '../db.js';
import { notifyStatusChange } from '../telegram.js';
import { adminAuth }   from '../middleware/auth.js';
import { createLogger } from '../logger.js';

const log = createLogger('ADMIN');

const router = Router();

/* ── Brute-force protected auth ──────────── */
router.use(adminAuth);

/* ── GET /api/admin/stats ───────────────────── */
router.get('/stats', (req, res) => {
  const db = getDb();
  const stats = {
    total_bookings:   db.prepare("SELECT COUNT(*) as n FROM bookings").get().n,
    pending:          db.prepare("SELECT COUNT(*) as n FROM bookings WHERE status='pending'").get().n,
    paid:             db.prepare("SELECT COUNT(*) as n FROM bookings WHERE status='paid'").get().n,
    cancelled:        db.prepare("SELECT COUNT(*) as n FROM bookings WHERE status='cancelled'").get().n,
    total_revenue:    db.prepare("SELECT COALESCE(SUM(price),0) as n FROM bookings WHERE status='paid'").get().n,
    unread_contacts:  db.prepare("SELECT COUNT(*) as n FROM contacts WHERE is_read=0").get().n,
    total_contacts:   db.prepare("SELECT COUNT(*) as n FROM contacts").get().n,
    today_bookings:   db.prepare("SELECT COUNT(*) as n FROM bookings WHERE date(created_at)=date('now','localtime')").get().n,
  };
  res.json({ ok: true, stats });
});

/* ── GET /api/admin/bookings/export ──────────
   Must be BEFORE /bookings/:id to avoid 'export' being treated as id
   ?format=csv&status=paid&from=2026-01-01
   ─────────────────────────────────────────── */
router.get('/bookings/export', (req, res) => {
  const { status, from, to } = req.query;
  const db = getDb();

  let where = '1=1';
  const params = [];
  if (status && status !== 'all') { where += ' AND status = ?'; params.push(status); }
  if (from) { where += ' AND date(created_at) >= ?'; params.push(from); }
  if (to)   { where += ' AND date(created_at) <= ?'; params.push(to); }

  const rows = db.prepare(
    `SELECT booking_ref, status, program, dates, price,
            child_first, child_last, child_dob, child_age,
            parent_name, parent_email, parent_phone,
            med_allergies, med_conditions, med_diet, created_at
     FROM bookings WHERE ${where} ORDER BY created_at DESC`
  ).all(...params);

  const headers = [
    'Референс','Статус','Програма','Дати','Ціна',
    "Ім'я дитини",'Прізвище','Дата нар.','Вік',
    'Батьки','Email','Телефон',
    'Алергії','Захворювання','Дієта','Дата заявки'
  ];
  const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = '\uFEFF' + [
    headers.map(esc).join(','),
    ...rows.map(r => [
      r.booking_ref, r.status, r.program, r.dates, r.price,
      r.child_first, r.child_last, r.child_dob, r.child_age,
      r.parent_name, r.parent_email, r.parent_phone,
      r.med_allergies, r.med_conditions, r.med_diet, r.created_at
    ].map(esc).join(','))
  ].join('\r\n');

  const filename = `skycamp-${new Date().toISOString().slice(0,10)}.csv`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  log.info('CSV export', { rows: rows.length, status: status || 'all' });
  res.send(csv);
});

/* ── GET /api/admin/bookings ────────────────── */
router.get('/bookings', (req, res) => {
  const { status, search, page = 1, limit = 20 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);
  const db = getDb();

  let where = '1=1';
  const params = [];

  if (status && status !== 'all') {
    where += ' AND status = ?'; params.push(status);
  }
  if (search) {
    where += ' AND (booking_ref LIKE ? OR parent_email LIKE ? OR child_first LIKE ? OR child_last LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s, s, s);
  }

  const total = db.prepare(`SELECT COUNT(*) as n FROM bookings WHERE ${where}`).get(...params).n;
  const rows  = db.prepare(
    `SELECT id, booking_ref, status, program, dates, price,
            child_first, child_last, parent_email, parent_phone, created_at
     FROM bookings WHERE ${where}
     ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).all(...params, Number(limit), offset);

  res.json({ ok: true, total, page: Number(page), pages: Math.ceil(total / Number(limit)), bookings: rows });
});

/* ── GET /api/admin/bookings/:id ─────────────── */
router.get('/bookings/:id', (req, res) => {
  const booking = getDb().prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
  if (!booking) return res.status(404).json({ ok: false, error: 'Not found' });
  res.json({ ok: true, booking });
});

/* ── PATCH /api/admin/bookings/:id/status ─────── */
router.patch('/bookings/:id/status', async (req, res) => {
  const { status } = req.body;
  const allowed = ['pending', 'paid', 'cancelled'];
  if (!allowed.includes(status)) {
    return res.status(400).json({ ok: false, error: `Status must be one of: ${allowed.join(', ')}` });
  }

  const db = getDb();
  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
  if (!booking) return res.status(404).json({ ok: false, error: 'Not found' });

  db.prepare("UPDATE bookings SET status = ?, updated_at = datetime('now','localtime') WHERE id = ?")
    .run(status, req.params.id);

  notifyStatusChange(booking, status).catch(err =>
    console.error('[ADMIN] Status notify failed:', err.message)
  );

  console.log(`[ADMIN] Booking ${booking.booking_ref} → ${status}`);
  res.json({ ok: true, message: 'Статус оновлено' });
});

/* ── GET /api/admin/contacts ─────────────────── */
router.get('/contacts', (req, res) => {
  const { unread, page = 1, limit = 20 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);
  const db = getDb();

  const where = unread === '1' ? 'WHERE is_read = 0' : '';
  const total  = db.prepare(`SELECT COUNT(*) as n FROM contacts ${where}`).get().n;
  const rows   = db.prepare(
    `SELECT * FROM contacts ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).all(Number(limit), offset);

  res.json({ ok: true, total, page: Number(page), contacts: rows });
});

/* ── PATCH /api/admin/contacts/:id/read ──────── */
router.patch('/contacts/:id/read', (req, res) => {
  const db = getDb();
  const contact = db.prepare('SELECT id FROM contacts WHERE id = ?').get(req.params.id);
  if (!contact) return res.status(404).json({ ok: false, error: 'Not found' });

  db.prepare('UPDATE contacts SET is_read = 1 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

/* ── GET /api/admin/bookings/export ──────────
   ?format=csv&status=all&from=2026-01-01
   ─────────────────────────────────────────── */
router.get('/bookings/export', (req, res) => {
  const { status, from, to, format = 'csv' } = req.query;
  const db = getDb();

  let where = '1=1';
  const params = [];
  if (status && status !== 'all') { where += ' AND status = ?'; params.push(status); }
  if (from) { where += ' AND date(created_at) >= ?'; params.push(from); }
  if (to)   { where += ' AND date(created_at) <= ?'; params.push(to); }

  const rows = db.prepare(
    `SELECT booking_ref, status, program, dates, price,
            child_first, child_last, child_dob, child_age,
            parent_name, parent_email, parent_phone,
            med_allergies, med_conditions, med_diet,
            created_at
     FROM bookings WHERE ${where} ORDER BY created_at DESC`
  ).all(...params);

  if (format === 'csv') {
    const headers = [
      'Референс','Статус','Програма','Дати','Ціна',
      'Ім\'я дитини','Прізвище дитини','Дата нар.','Вік',
      'Батьки','Email','Телефон',
      'Алергії','Захворювання','Дієта','Дата заявки'
    ];
    const escape = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csvRows = rows.map(r => [
      r.booking_ref, r.status, r.program, r.dates, r.price,
      r.child_first, r.child_last, r.child_dob, r.child_age,
      r.parent_name, r.parent_email, r.parent_phone,
      r.med_allergies, r.med_conditions, r.med_diet, r.created_at
    ].map(escape).join(','));

    const csv = '\uFEFF' + [headers.map(escape).join(','), ...csvRows].join('\r\n');
    const filename = `skycamp-bookings-${new Date().toISOString().slice(0,10)}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    log.info('CSV export', { rows: rows.length, status });
    return res.send(csv);
  }

  res.json({ ok: true, bookings: rows, total: rows.length });
});

export default router;
