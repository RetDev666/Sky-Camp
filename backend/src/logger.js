// =============================================
//  Sky Camp — Structured Logger (Pino-style)
//  Легкий логер без залежностей.
//  Для production замінити на `pino`.
// =============================================
import { appendFileSync, mkdirSync } from 'fs';
import { resolve, dirname }          from 'path';
import { fileURLToPath }             from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOG_DIR   = resolve(__dirname, '../../logs');
const IS_PROD   = process.env.NODE_ENV === 'production';

// Ensure log directory exists
try { mkdirSync(LOG_DIR, { recursive: true }); } catch {}

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const COLORS = {
  debug: '\x1b[36m',  // cyan
  info:  '\x1b[32m',  // green
  warn:  '\x1b[33m',  // yellow
  error: '\x1b[31m',  // red
  reset: '\x1b[0m',
};

function log(level, module, msg, data) {
  const ts      = new Date().toISOString();
  const numeric = LEVELS[level] || 20;
  const logObj  = {
    time:    ts,
    level:   numeric,
    levelName: level.toUpperCase(),
    module,
    msg,
    ...(data && { data }),
  };

  const json    = JSON.stringify(logObj);
  const logDate = ts.slice(0, 10);

  // Write to file (production always, dev if LOG_TO_FILE=1)
  if (IS_PROD || process.env.LOG_TO_FILE === '1') {
    try {
      appendFileSync(resolve(LOG_DIR, `app-${logDate}.log`), json + '\n');
      if (level === 'error' || level === 'warn') {
        appendFileSync(resolve(LOG_DIR, `error-${logDate}.log`), json + '\n');
      }
    } catch {}
  }

  // Pretty-print to console in development
  if (!IS_PROD) {
    const c = COLORS[level] || '';
    const r = COLORS.reset;
    const dataStr = data ? ' ' + JSON.stringify(data) : '';
    console.log(`${c}[${level.toUpperCase()}]${r} [${module}] ${msg}${dataStr}`);
  } else {
    // Production: structured JSON to stdout
    process.stdout.write(json + '\n');
  }
}

// ── Factory: create module-scoped logger ────
export function createLogger(module) {
  return {
    debug: (msg, data) => log('debug', module, msg, data),
    info:  (msg, data) => log('info',  module, msg, data),
    warn:  (msg, data) => log('warn',  module, msg, data),
    error: (msg, data) => log('error', module, msg, data),
  };
}

// ── Default app logger ──────────────────────
export const logger = createLogger('APP');

// ── Express request logger middleware ───────
export function requestLogger(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    const ms     = Date.now() - start;
    const level  = res.statusCode >= 500 ? 'error'
                 : res.statusCode >= 400 ? 'warn'
                 : 'info';
    log(level, 'HTTP', `${req.method} ${req.path} ${res.statusCode} ${ms}ms`, {
      ip: req.ip,
      ua: req.get('User-Agent')?.slice(0, 60),
    });
  });
  next();
}
