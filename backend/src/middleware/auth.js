// =============================================
//  Sky Camp — Admin Brute-Force Protection
// =============================================
import { timingSafeEqual as cryptoSafeEqual, createHmac } from 'crypto';

const attempts = new Map();
const MAX_FAILS = 10;
const LOCK_MS   = 15 * 60 * 1000;
const WINDOW_MS = 15 * 60 * 1000;

/* Constant-time string comparison ──────────── */
function safeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  // Pad both to same length with HMAC so timing is uniform
  const secret = Buffer.from(process.env.SESSION_SECRET || 'skycamp-secret');
  const ha = createHmac('sha256', secret).update(a).digest();
  const hb = createHmac('sha256', secret).update(b).digest();
  return cryptoSafeEqual(ha, hb);
}

export function adminAuth(req, res, next) {
  const ip  = req.ip;
  const now = Date.now();

  // Check lockout
  const state = attempts.get(ip);
  if (state?.lockedUntil && now < state.lockedUntil) {
    const wait = Math.ceil((state.lockedUntil - now) / 60000);
    return res.status(429)
      .set('Retry-After', String(Math.ceil((state.lockedUntil - now) / 1000)))
      .json({ ok: false, error: `Занадто багато спроб. Спробуйте через ${wait} хв.` });
  }

  // Parse Basic Auth
  const auth = req.headers.authorization || '';
  const [scheme, encoded] = auth.split(' ');

  if (scheme !== 'Basic' || !encoded) {
    return res.status(401)
      .set('WWW-Authenticate', 'Basic realm="Sky Camp Admin", charset="UTF-8"')
      .json({ ok: false, error: 'Потрібна аутентифікація' });
  }

  let user = '', pass = '';
  try {
    const decoded = Buffer.from(encoded, 'base64').toString('utf8');
    const sep = decoded.indexOf(':');
    user = decoded.slice(0, sep);
    pass = decoded.slice(sep + 1);
  } catch {
    return res.status(400).json({ ok: false, error: 'Невірний формат аутентифікації' });
  }

  const userOk = safeCompare(user, process.env.ADMIN_USER || 'admin');
  const passOk = safeCompare(pass, process.env.ADMIN_PASS || 'skycamp2026');

  if (!userOk || !passOk) {
    // Record failure
    let cur = attempts.get(ip) || { count: 0, firstFail: now };
    if (now - cur.firstFail > WINDOW_MS) cur = { count: 0, firstFail: now };
    cur.count++;
    if (cur.count >= MAX_FAILS) {
      cur.lockedUntil = now + LOCK_MS;
      console.warn(`[SECURITY] Admin lockout: ${ip} (${cur.count} fails)`);
    }
    attempts.set(ip, cur);
    console.warn(`[SECURITY] Failed admin login from ${ip} (attempt ${cur.count})`);
    return res.status(403).json({ ok: false, error: 'Невірні дані для входу' });
  }

  attempts.delete(ip);
  req.adminUser = user;
  next();
}
