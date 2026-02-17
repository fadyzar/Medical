import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: {
    template: '%s | בלוג טלמדיסן',
    default: 'בלוג רפואי | טלמדיסן',
  },
}

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return children
}
