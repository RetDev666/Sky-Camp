// =============================================
//  Sky Camp — Contact Router
//  POST /api/contact — Save message + notify
// =============================================
import { Router } from 'express';
import { getDb } from '../db.js';
import { notifyContact } from '../telegram.js';

const router = Router();

/* ── POST /api/contact ──────────────────────── */
router.post('/', async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;
    const errors = [];

    if (!name?.trim())    errors.push("Ім'я є обов'язковим");
    if (!email?.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) errors.push('Невірний формат email');
    if (!subject?.trim()) errors.push('Тема є обов\'язковою');
    if (!message?.trim() || message.trim().length < 10) errors.push('Повідомлення має містити щонайменше 10 символів');

    if (errors.length) {
      return res.status(400).json({ ok: false, errors });
    }

    const contact = getDb().prepare(`
      INSERT INTO contacts (name, email, subject, message, ip_address)
      VALUES (@name, @email, @subject, @message, @ip_address)
    `).run({
      name:       name.trim(),
      email:      email.trim().toLowerCase(),
      subject:    subject.trim(),
      message:    message.trim(),
      ip_address: req.ip,
    });

    // Non-blocking Telegram
    notifyContact({ name, email, subject, message }).catch(err =>
      console.error('[CONTACT] Telegram failed:', err.message)
    );

    console.log(`[CONTACT] From: ${email} — ${subject}`);

    res.status(201).json({
      ok:      true,
      id:      contact.lastInsertRowid,
      message: 'Ваше повідомлення надіслано! Ми відповімо протягом 24 годин.',
    });

  } catch (err) {
    console.error('[CONTACT] Error:', err);
    res.status(500).json({ ok: false, error: 'Помилка сервера. Спробуйте пізніше.' });
  }
});

export default router;
