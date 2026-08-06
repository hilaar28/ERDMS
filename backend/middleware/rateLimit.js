import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

/*
 * General rate limiter — applies to every API route.
 * Limits each IP to 300 requests per 5-minute window.
 */
export const generalRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: ipKeyGenerator,
  message: { error: 'Too many requests, please try again later.' },
});

/*
 * Login rate limiter — IP-based, very strict.
 * 10 attempts per 15-minute window per IP.
 */
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: ipKeyGenerator,
  message: { error: 'Too many login attempts from this IP. Please try again later.' },
});

/*
 * Username-based brute-force protection.
 * Tracks failed login attempts per username and applies progressive
 * delays / temporary lockout.
 */
export const failedAttempts = new Map();
const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000;

export function getClientIp(req) {
  const rawIp = req.ip || req.connection?.remoteAddress || req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
  if (rawIp.startsWith('::ffff:')) return rawIp.slice(7);
  if (rawIp === '::1') return '127.0.0.1';
  return rawIp;
}

export function progressiveDelay(req, res, next) {
  const username = req.body?.username;
  if (!username) return next();

  const record = failedAttempts.get(username);
  const now = Date.now();

  if (record && record.lockedUntil && record.lockedUntil > now) {
    const retryAfter = Math.ceil((record.lockedUntil - now) / 1000);
    res.set('Retry-After', String(retryAfter));
    return res.status(429).json({
      error: `Too many failed login attempts for this username. Account temporarily locked. Try again in ${retryAfter} seconds.`,
    });
  }

  if (record && record.delayUntil && record.delayUntil > now) {
    const delayMs = record.delayUntil - now;
    const delaySeconds = Math.ceil(delayMs / 1000);
    res.set('Retry-After', String(delaySeconds));
    return res.status(429).json({
      error: `Too many failed login attempts. Please wait ${delaySeconds} second(s) before retrying.`,
    });
  }

  next();
}

export function recordFailedLogin(username, ip) {
  const record = failedAttempts.get(username) || {
    attempts: 0,
    delayUntil: null,
    lockedUntil: null,
    firstAttempt: Date.now(),
    lastAttempt: Date.now(),
  };

  record.attempts++;
  record.lastAttempt = Date.now();

  if (record.attempts === LOCKOUT_THRESHOLD) {
    record.lockedUntil = Date.now() + LOCKOUT_DURATION;
    record.delayUntil = null;
    console.warn(`Account locked: username="${username}", ip="${ip}"`);
  } else if (record.attempts > LOCKOUT_THRESHOLD) {
    record.lockedUntil = Date.now() + LOCKOUT_DURATION;
  } else {
    record.delayUntil = Date.now() + Math.pow(2, record.attempts - 1) * 1000;
  }

  failedAttempts.set(username, record);
}

export function clearFailedLogins(username) {
  if (username) {
    failedAttempts.delete(username);
  }
}

/*
 * Middleware to reset failed attempts on successful login.
 */
export function resetOnSuccess(req, res, next) {
  const originalSend = res.send;
  res.send = function(body) {
    if (res.statusCode === 200 && req.body?.username) {
      clearFailedLogins(req.body.username);
    }
    return originalSend.call(this, body);
  };
  next();
}
