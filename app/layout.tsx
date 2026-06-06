import type { Metadata, Viewport } from 'next'
import { Toaster } from 'sonner'
import AccessibilityWidget from '@/components/accessibility/AccessibilityWidget'
import './globals.css'

// CHECKLIST: SEO metadata
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://your-domain.co.il'),
  title: { default: 'טלמדיסן — ייעוץ רפואי אונליין', template: '%s | טלמדיסן' },
  description: 'פלטפורמת טלמדיסן מתקדמת — ייעוץ רפואי בוידאו עם רופאים מומחים, סיכומי AI, שאלונים דינמיים, תשלומים מאובטחים. הפלטפורמה המובילה בישראל.',
  keywords: ['טלמדיסן', 'ייעוץ רפואי אונליין', 'רופא אונליין', 'שיחת וידאו רופא', 'telemedicine israel'],
  authors: [{ name: 'Telemedicine Platform' }],
  openGraph: {
    type: 'website',
    locale: 'he_IL',
    siteName: 'טלמדיסן',
    title: 'טלמדיסן — ייעוץ רפואי אונליין',
    description: 'ייעוץ רפואי בוידאו עם רופאים מומחים. AI, שאלונים, תשלומים מאובטחים.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'טלמדיסן — ייעוץ רפואי אונליין',
    description: 'ייעוץ רפואי בוידאו עם רופאים מומחים. AI, שאלונים, תשלומים מאובטחים.',
  },
  robots: { index: true, follow: true },
  alternates: {
    canonical: 'https://your-domain.co.il',
    languages: { 'he': 'https://your-domain.co.il' },
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <head>
        {/* Structured Data for MedicalClinic */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "MedicalClinic",
          "name": "טלמדיסן",
          "url": "https://your-domain.co.il",
          "description": "פלטפורמת ייעוץ רפואי אונליין",
          "medicalSpecialty": "Telemedicine",
          "availableService": { "@type": "MedicalProcedure", "name": "ייעוץ רפואי בוידאו" },
          "areaServed": { "@type": "Country", "name": "Israel" },
          "address": { "@type": "PostalAddress", "addressCountry": "IL" },
          "inLanguage": "he",
        })}} />
      </head>
      <body className="font-sans antialiased bg-gray-50 text-gray-900 min-h-screen">
        {/* Skip to main content — WCAG 2.4.1, תקן ת"י 5568 */}
        <a href="#main-content" className="skip-to-content">
          דלג לתוכן הראשי
        </a>
        <div id="main-content" tabIndex={-1}>
          {children}
        </div>
        <Toaster position="top-center" toastOptions={{ style: { direction: 'rtl' } }} richColors />
        {/* Accessibility widget — נגישות */}
        <AccessibilityWidget />
      </body>
    </html>
  )
}
