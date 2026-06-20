import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://cannaforyou.net'
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: ['/api/', '/dashboard/', '/video-call'] },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
