/**
 * In-memory sliding-window rate limiter for Next.js API routes.
 *
 * Designed for single-instance deployments (Vercel serverless has natural
 * isolation per function). For multi-instance, swap to Redis-backed store.
 */

interface RateLimitEntry {
  timestamps: number[]
}

const store = new Map<string, RateLimitEntry>()

// Periodically clean up expired entries to prevent memory leaks
const CLEANUP_INTERVAL = 60_000 // 1 minute
let lastCleanup = Date.now()

function cleanup(windowMs: number) {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL) return
  lastCleanup = now

  const cutoff = now - windowMs
  for (const [key, entry] of store) {
    entry.timestamps = entry.timestamps.filter(t => t > cutoff)
    if (entry.timestamps.length === 0) store.delete(key)
  }
}

interface RateLimitOptions {
  /** Maximum number of requests in the window */
  maxRequests: number
  /** Time window in milliseconds */
  windowMs: number
}

interface RateLimitResult {
  allowed: boolean
  remaining: number
  retryAfterMs: number | null
}

/**
 * Check whether a request from `key` (typically IP or userId) is within limits.
 */
export function rateLimit(key: string, opts: RateLimitOptions): RateLimitResult {
  const now = Date.now()
  const cutoff = now - opts.windowMs

  cleanup(opts.windowMs)

  let entry = store.get(key)
  if (!entry) {
    entry = { timestamps: [] }
    store.set(key, entry)
  }

  // Remove timestamps outside the window
  entry.timestamps = entry.timestamps.filter(t => t > cutoff)

  if (entry.timestamps.length >= opts.maxRequests) {
    const oldestInWindow = entry.timestamps[0]
    const retryAfterMs = oldestInWindow + opts.windowMs - now
    return { allowed: false, remaining: 0, retryAfterMs }
  }

  entry.timestamps.push(now)
  return {
    allowed: true,
    remaining: opts.maxRequests - entry.timestamps.length,
    retryAfterMs: null,
  }
}

// ── Pre-configured limiters for common use cases ─────

/** Onboarding: 5 per 15 minutes per IP */
export const onboardingLimiter = (ip: string) =>
  rateLimit(`onboarding:${ip}`, { maxRequests: 5, windowMs: 15 * 60 * 1000 })

/** Auth (login/register): 10 per 15 minutes per IP */
export const authLimiter = (ip: string) =>
  rateLimit(`auth:${ip}`, { maxRequests: 10, windowMs: 15 * 60 * 1000 })

/** General API: 60 per minute per user */
export const apiLimiter = (userId: string) =>
  rateLimit(`api:${userId}`, { maxRequests: 60, windowMs: 60 * 1000 })
