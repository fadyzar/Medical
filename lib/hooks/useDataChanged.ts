'use client'

import { useEffect, useRef } from 'react'

/** Fired after the AI assistant completes a confirmed action that changed data. */
export const DATA_CHANGED_EVENT = 'canna:data-changed'

export function announceDataChanged() {
  window.dispatchEvent(new Event(DATA_CHANGED_EVENT))
}

/**
 * Re-runs `reload` when data changed outside the page (e.g. the assistant
 * cancelled an appointment while this list was open behind its panel).
 */
export function useDataChanged(reload: () => void) {
  const ref = useRef(reload)
  useEffect(() => { ref.current = reload })
  useEffect(() => {
    const handler = () => ref.current()
    window.addEventListener(DATA_CHANGED_EVENT, handler)
    return () => window.removeEventListener(DATA_CHANGED_EVENT, handler)
  }, [])
}
