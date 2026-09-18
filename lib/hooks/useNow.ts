'use client'

import { useEffect, useState } from 'react'

/**
 * Current timestamp that re-renders on an interval.
 *
 * Reading `Date.now()` directly during render is impure: the value is frozen at the
 * last render, so time-dependent UI (e.g. "the video call opens 15 minutes before the
 * appointment") never appears until some unrelated state change forces a re-render.
 *
 * Starts at 0 so server and first client render agree, then updates after mount —
 * callers should treat 0 as "time not known yet".
 *
 * @param intervalMs how often to tick. Default 30s — fine for minute-grained UI.
 */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(0)

  useEffect(() => {
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs])

  return now
}
