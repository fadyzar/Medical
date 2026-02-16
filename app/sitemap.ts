import type { MetadataRoute } from 'next'
import { SPECIALTIES } from '@/lib/utils'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://your-domain.co.il'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: 'weekly', priority: 1.0 },
    { url: `${BASE_URL}/doctors`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.9 },
    { url: `${BASE_URL}/auth/login`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE_URL}/auth/register`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    ...SPECIALTIES.map(s => ({
      url: `${BASE_URL}/specialties/${s.id}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
  ]
}
