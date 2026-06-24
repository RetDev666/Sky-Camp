const serverless = require('serverless-http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const xss = require('xss');
const { createClient } = require('@libsql/client/web');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();

app.use(cors());
app.use(helmet());
app.use(express.json());

// ── Database Setup (Turso) ──
function getDb() {
  if (!process.env.TURSO_URL || !process.env.TURSO_TOKEN) {
    throw new Error("Missing TURSO_URL or TURSO_TOKEN environment variables");
  }
  return createClient({
    url: process.env.TURSO_URL,
    authToken: process.env.TURSO_TOKEN,
  });
}

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-for-dev-only-change-in-prod';

// ── Middleware: Admin Auth ──
const adminAuth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ ok: false, error: 'Unauthorized' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'admin') throw new Error('Not admin');
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ ok: false, error: 'Invalid token' });
  }
};

// ── Telegram Helper ──
async function sendTelegramMessage(text) {
  const token = process.env.TG_BOT_TOKEN;
  const chatId = process.env.TG_CHAT_ID;
  if (!token || !chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' })
    });
  } catch (err) {
    console.error('Telegram error:', err);
  }
}

// ── Email Helper ──
async function sendEmail(to, subject, html) {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT || 465;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return false;
  
  try {
    const transporter = nodemailer.createTransport({
      host, port, secure: port == 465, auth: { user, pass }
    });
    await transporter.sendMail({
      from: `"Sky Camp" <${user}>`,
      to, subject, html
    });
    return true;
  } catch (err) {
    console.error('Email error:', err);
    return false;
  }
}

// ── Routes ──

app.get('/api/health', (req, res) => res.json({ ok: true, message: 'API is running' }));

// 1. Бронювання (Booking)
app.post('/api/booking', async (req, res) => {
  try {
    const d = req.body;
    // Basic validation
    const required = ['child_first', 'child_last', 'parent_name', 'parent_email', 'parent_phone', 'program'];
    for (const field of required) {
      if (!d[field]) return res.status(422).json({ ok: false, error: `Поле ${field} є обов'язковим` });
    }
    
    const db = getDb();
    const bookingId = 'SKY-2026-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    
    // Save to DB
    await db.execute({
      sql: "INSERT INTO bookings (child_name, child_age, parent_name, phone, email, program, date, status, booking_ref) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)",
      args: [`${d.child_first} ${d.child_last}`, d.child_age || 0, d.parent_name, d.parent_phone, d.parent_email, d.program, d.dates || '', bookingId]
    });

    // Notify Telegram
    await sendTelegramMessage(`🏕️ <b>НОВЕ БРОНЮВАННЯ</b>\n\n🆔 <b>${bookingId}</b>\n📋 <b>Програма:</b> ${d.program}\n👶 <b>Учасник:</b> ${d.child_first} ${d.child_last}\n👤 <b>Батьки:</b> ${d.parent_name}\n📞 <b>Телефон:</b> ${d.parent_phone}`);

    // Send confirmation email
    await sendEmail(d.parent_email, "🏕️ Ваша заявка до Sky Camp отримана", `<p>Вітаємо! Ваша заявка #${bookingId} на участь ${d.child_first} у таборі отримана.</p>`);

    res.json({ ok: true, bookingId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 2. Звернення (Contact)
app.post('/api/contact', async (req, res) => {
  try {
    const d = req.body;
    if (!d.name || !d.email || !d.message) return res.status(422).json({ ok: false, error: 'Заповніть всі обов\'язкові поля' });
    
    const db = getDb();
    await db.execute({
      sql: "INSERT INTO messages (name, email, message, status) VALUES (?, ?, ?, 'pending')",
      args: [d.name, d.email, xss(d.message)]
    });

    await sendTelegramMessage(`📩 <b>НОВЕ ЗВЕРНЕННЯ</b>\n\n👤 <b>Від:</b> ${d.name}\n📧 <b>Email:</b> ${d.email}\n💬 <b>Повідомлення:</b>\n${d.message}`);
    
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 3. Admin Login
app.post('/api/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const db = getDb();
    const result = await db.execute({
      sql: "SELECT * FROM users WHERE username = ?",
      args: [username]
    });
    
    if (result.rows.length === 0) {
      return res.status(401).json({ ok: false, error: 'Invalid credentials' });
    }
    
    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ ok: false, error: 'Invalid credentials' });
    
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '1d' });
    res.json({ ok: true, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 4. Admin Stats
app.get('/api/admin/stats', adminAuth, async (req, res) => {
  try {
    const db = getDb();
    // We execute queries in parallel to save time
    const [totalB, pending, paid, cancelled, unreadC, totalC, todayB] = await Promise.all([
      db.execute("SELECT COUNT(*) as n FROM bookings"),
      db.execute("SELECT COUNT(*) as n FROM bookings WHERE status='pending'"),
      db.execute("SELECT COUNT(*) as n FROM bookings WHERE status='paid'"),
      db.execute("SELECT COUNT(*) as n FROM bookings WHERE status='cancelled'"),
      db.execute("SELECT COUNT(*) as n FROM messages WHERE status='pending'"), // using messages as contacts
      db.execute("SELECT COUNT(*) as n FROM messages"),
      db.execute("SELECT COUNT(*) as n FROM bookings WHERE date(created_at)=date('now')")
    ]);
    
    res.json({
      ok: true,
      stats: {
        total_bookings: totalB.rows[0].n,
        pending: pending.rows[0].n,
        paid: paid.rows[0].n,
        cancelled: cancelled.rows[0].n,
        unread_contacts: unreadC.rows[0].n,
        total_contacts: totalC.rows[0].n,
        today_bookings: todayB.rows[0].n,
        total_revenue: 0 // Simplification for now, as price column might not exist or be empty
      }
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 5. Admin Bookings
app.get('/api/admin/bookings', adminAuth, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const db = getDb();
    let sql = "SELECT * FROM bookings ";
    let args = [];
    if (status && status !== 'all') {
      sql += "WHERE status = ? ";
      args.push(status);
    }
    sql += "ORDER BY created_at DESC LIMIT ? OFFSET ?";
    args.push(Number(limit), (Number(page) - 1) * Number(limit));
    
    const result = await db.execute({ sql, args });
    
    let countSql = "SELECT COUNT(*) as n FROM bookings";
    let countArgs = [];
    if (status && status !== 'all') {
      countSql += " WHERE status = ?";
      countArgs.push(status);
    }
    const countResult = await db.execute({ sql: countSql, args: countArgs });
    
    const bookings = result.rows.map(row => {
      const obj = {};
      result.columns.forEach((c, i) => obj[c] = row[i]);
      return obj;
    });
    
    res.json({ ok: true, bookings, total: countResult.rows[0].n });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 6. Admin Contacts
app.get('/api/admin/contacts', adminAuth, async (req, res) => {
  try {
    const { unread, page = 1, limit = 20 } = req.query;
    const db = getDb();
    let sql = "SELECT * FROM messages ";
    if (unread === '1') sql += "WHERE status = 'pending' ";
    sql += "ORDER BY created_at DESC LIMIT ? OFFSET ?";
    
    const result = await db.execute({
      sql,
      args: [Number(limit), (Number(page) - 1) * Number(limit)]
    });
    
    const contacts = result.rows.map(row => {
      const obj = {};
      result.columns.forEach((c, i) => obj[c] = row[i]);
      return obj;
    });
    
    res.json({ ok: true, contacts });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// =============================================
//  CMS & Users Endpoints
// =============================================

// --- DB SETUP ---
app.get('/api/admin/setup-db', async (req, res) => {
  try {
    const db = getDb();
    await db.execute("CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)");
    await db.execute("CREATE TABLE IF NOT EXISTS gallery (id INTEGER PRIMARY KEY AUTOINCREMENT, image_data TEXT)");
    await db.execute("CREATE TABLE IF NOT EXISTS shifts (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, start_date TEXT, end_date TEXT)");
    try { await db.execute("ALTER TABLE bookings ADD COLUMN notes TEXT"); } catch (e) {}
    res.json({ ok: true, message: "DB updated" });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// --- PUBLIC CONTENT ---
app.get('/api/public/content', async (req, res) => {
  try {
    const db = getDb();
    const [s, g, sh] = await Promise.all([
      db.execute("SELECT key, value FROM settings"),
      db.execute("SELECT image_data FROM gallery ORDER BY id DESC"),
      db.execute("SELECT id, name, start_date, end_date FROM shifts ORDER BY id ASC")
    ]);
    const settings = {};
    s.rows.forEach(r => { settings[r[0]] = r[1]; });
    const gallery = g.rows.map(r => r[0]);
    const shifts = sh.rows.map(r => {
      const obj = {};
      sh.columns.forEach((c, i) => obj[c] = r[i]);
      return obj;
    });
    res.json({ ok: true, settings, gallery, shifts });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// --- SETTINGS ---
app.get('/api/admin/settings', adminAuth, async (req, res) => {
  try {
    const db = getDb();
    const result = await db.execute("SELECT key, value FROM settings");
    const settings = {};
    result.rows.forEach(r => { settings[r[0]] = r[1]; });
    res.json({ ok: true, settings });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/admin/settings', adminAuth, async (req, res) => {
  try {
    const db = getDb();
    const { settings } = req.body;
    for (const [key, value] of Object.entries(settings)) {
      await db.execute({
        sql: "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        args: [key, value]
      });
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// --- GALLERY ---
app.get('/api/admin/gallery', adminAuth, async (req, res) => {
  try {
    const db = getDb();
    const result = await db.execute("SELECT id, image_data FROM gallery ORDER BY id DESC");
    const images = result.rows.map(row => {
      const obj = {};
      result.columns.forEach((c, i) => obj[c] = row[i]);
      return obj;
    });
    res.json({ ok: true, images });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/admin/gallery', adminAuth, async (req, res) => {
  try {
    const db = getDb();
    await db.execute({ sql: "INSERT INTO gallery (image_data) VALUES (?)", args: [req.body.image_data] });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.delete('/api/admin/gallery/:id', adminAuth, async (req, res) => {
  try {
    const db = getDb();
    await db.execute({ sql: "DELETE FROM gallery WHERE id = ?", args: [req.params.id] });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// --- SHIFTS ---
app.get('/api/admin/shifts', adminAuth, async (req, res) => {
  try {
    const db = getDb();
    const result = await db.execute("SELECT id, name, start_date, end_date FROM shifts ORDER BY id ASC");
    const shifts = result.rows.map(row => {
      const obj = {};
      result.columns.forEach((c, i) => obj[c] = row[i]);
      return obj;
    });
    res.json({ ok: true, shifts });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/admin/shifts', adminAuth, async (req, res) => {
  try {
    const db = getDb();
    const { name, start_date, end_date } = req.body;
    await db.execute({ 
      sql: "INSERT INTO shifts (name, start_date, end_date) VALUES (?, ?, ?)", 
      args: [name, start_date, end_date] 
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.delete('/api/admin/shifts/:id', adminAuth, async (req, res) => {
  try {
    const db = getDb();
    await db.execute({ sql: "DELETE FROM shifts WHERE id = ?", args: [req.params.id] });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// --- USERS ---
app.get('/api/admin/users', adminAuth, async (req, res) => {
  try {
    const db = getDb();
    const result = await db.execute("SELECT id, username, role, created_at FROM users");
    const users = result.rows.map(row => {
      const obj = {};
      result.columns.forEach((c, i) => obj[c] = row[i]);
      return obj;
    });
    res.json({ ok: true, users });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/admin/users', adminAuth, async (req, res) => {
  try {
    const db = getDb();
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ ok: false, error: "Логін та пароль обов'язкові" });
    const hash = await bcrypt.hash(password, 10);
    await db.execute({
      sql: "INSERT INTO users (username, password_hash) VALUES (?, ?)",
      args: [username, hash]
    });
    res.json({ ok: true });
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(400).json({ ok: false, error: 'Користувач вже існує' });
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.delete('/api/admin/users/:id', adminAuth, async (req, res) => {
  try {
    const db = getDb();
    const c = await db.execute("SELECT COUNT(*) as n FROM users");
    if (c.rows[0].n <= 1) return res.status(400).json({ ok: false, error: 'Не можна видалити останнього адміністратора' });
    await db.execute({ sql: "DELETE FROM users WHERE id = ?", args: [req.params.id] });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// --- NOTES ---
app.patch('/api/admin/bookings/:id/notes', adminAuth, async (req, res) => {
  try {
    const db = getDb();
    await db.execute({ sql: "UPDATE bookings SET notes = ? WHERE id = ?", args: [req.body.notes, req.params.id] });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports.handler = serverless(app);
