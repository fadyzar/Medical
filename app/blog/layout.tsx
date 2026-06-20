import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: {
    template: '%s | בלוג CANNA',
    default: 'בלוג רפואי | CANNA',
  },
}

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return children
}
