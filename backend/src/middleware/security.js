// =============================================
//  Sky Camp — Security Middleware
// =============================================
import { rateLimit } from 'express-rate-limit';
import { randomBytes } from 'crypto';
import xss from 'xss';

/* ── 1. CSRF Token ───────────────────────────
   Simple double-submit cookie pattern
   ─────────────────────────────────────────── */
export function csrfToken(req, res, next) {
  // Only enforce on state-changing methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    // Issue token if not present
    if (!req.cookies?.csrf_token) {
      const token = randomBytes(32).toString('hex');
      res.cookie('csrf_token', token, {
        httpOnly: false,   // must be readable by JS
        sameSite: 'strict',
        secure:   process.env.NODE_ENV === 'production',
        maxAge:   4 * 60 * 60 * 1000, // 4h
      });
    }
    return next();
  }

  const cookieToken  = req.cookies?.csrf_token;
  const headerToken  = req.headers['x-csrf-token'];

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return res.status(403).json({ ok: false, error: 'Invalid CSRF token' });
  }
  next();
}

/* ── 2. Input sanitization ──────────────────
   Strips XSS from all string body fields
   ─────────────────────────────────────────── */
export function sanitizeBody(req, _res, next) {
  if (req.body && typeof req.body === 'object') {
    req.body = deepSanitize(req.body);
  }
  next();
}

function deepSanitize(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'string') {
      out[k] = xss(v.trim(), {
        whiteList: {},           // no HTML tags allowed
        stripIgnoreTag: true,
        stripIgnoreTagBody: ['script', 'style'],
      });
    } else if (typeof v === 'number' || typeof v === 'boolean') {
      out[k] = v;
    } else if (v && typeof v === 'object' && !Array.isArray(v)) {
      out[k] = deepSanitize(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

/* ── 3. Rate limiters ────────────────────────*/

// General API
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Забагато запитів. Спробуйте через 15 хвилин.' },
  skip: (req) => req.path.startsWith('/api/admin'), // admin has own limiter
});

// Booking creation
export const bookingLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,  // 1 hour
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Забагато спроб бронювання. Спробуйте через годину.' },
  keyGenerator: (req) => req.ip,
});

// Contact form
export const contactLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,  // 10 minutes
  max: 5,
  message: { ok: false, error: 'Забагато повідомлень. Спробуйте через 10 хвилин.' },
});

// Admin — strict brute-force protection
export const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { ok: false, error: 'Заблоковано. Спробуйте через 15 хвилин.' },
});

// Admin login — very strict
export const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { ok: false, error: 'Занадто багато невдалих спроб. Зачекайте 15 хвилин.' },
  skipSuccessfulRequests: true,  // only count failures
});

/* ── 4. Validate Content-Type ────────────── */
export function requireJson(req, res, next) {
  if (['POST', 'PATCH', 'PUT'].includes(req.method)) {
    if (!req.is('application/json')) {
      return res.status(415).json({ ok: false, error: 'Content-Type must be application/json' });
    }
  }
  next();
}

/* ── 5. Security audit logger ─────────────── */
export function auditLog(req, _res, next) {
  const suspicious = [
    /<script/i, /javascript:/i, /on\w+\s*=/i,
    /union\s+select/i, /drop\s+table/i, /exec\s*\(/i,
    /\.\.\//,  // path traversal
  ];

  const body = JSON.stringify(req.body || '');
  const url  = req.originalUrl;

  const isSuspicious = suspicious.some(rx => rx.test(body) || rx.test(url));
  if (isSuspicious) {
    console.warn(`[SECURITY] Suspicious request from ${req.ip}: ${req.method} ${url}`);
    return res.status(400).json({ ok: false, error: 'Invalid request' });
  }

  next();
}

/* ── 6. Prevent parameter pollution ─────── */
export function noParamPollution(req, _res, next) {
  // Convert arrays to single values in query
  if (req.query) {
    for (const key of Object.keys(req.query)) {
      if (Array.isArray(req.query[key])) {
        req.query[key] = req.query[key][0];
      }
    }
  }
  next();
}
