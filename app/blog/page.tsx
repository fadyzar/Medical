import type { Metadata } from 'next'
import Link from 'next/link'
import { getAllPosts, getCategories } from '@/lib/blog/posts'
import { SPECIALTIES } from '@/lib/utils'
import BlogPostsGrid from './BlogPostsGrid'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://your-domain.co.il'

export const metadata: Metadata = {
  title: 'בלוג רפואי | טלמדיסן',
  description: 'מאמרים רפואיים, מדריכים וטיפים בנושאי בריאות וטלרפואה. כתוב בעברית על ידי צוות מומחים.',
  openGraph: {
    title: 'בלוג רפואי | טלמדיסן',
    description: 'מאמרים רפואיים, מדריכים וטיפים בנושאי בריאות וטלרפואה.',
    type: 'website',
    locale: 'he_IL',
    url: `${BASE_URL}/blog`,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'בלוג רפואי | טלמדיסן',
    description: 'מאמרים רפואיים, מדריכים וטיפים בנושאי בריאות וטלרפואה.',
  },
  alternates: { canonical: `${BASE_URL}/blog` },
}

export default function BlogPage() {
  const posts = getAllPosts()
  const categories = getCategories()

  // Schema.org Blog
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: 'בלוג טלמדיסן',
    description: 'מאמרים רפואיים, מדריכים וטיפים בנושאי בריאות וטלרפואה.',
    url: `${BASE_URL}/blog`,
    inLanguage: 'he',
    publisher: {
      '@type': 'Organization',
      name: 'טלמדיסן',
      url: BASE_URL,
    },
    blogPost: posts.map(post => ({
      '@type': 'BlogPosting',
      headline: post.title,
      description: post.description,
      url: `${BASE_URL}/blog/${post.slug}`,
      datePublished: post.publishedAt,
      ...(post.updatedAt && { dateModified: post.updatedAt }),
      author: { '@type': 'Person', name: post.author.name },
      inLanguage: 'he',
    })),
  }

  return (
    <div className="min-h-screen bg-white" dir="rtl">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="text-2xl font-black text-blue-600">טלמדיסן</Link>
          <div className="flex items-center gap-4">
            <Link href="/specialties" className="text-sm text-gray-600 hover:text-gray-900">התמחויות</Link>
            <Link href="/doctors" className="text-sm text-gray-600 hover:text-gray-900">הרופאים שלנו</Link>
            <Link href="/blog" className="text-sm text-gray-900 font-medium">בלוג</Link>
            <Link href="/auth/login" className="text-sm text-gray-600 hover:text-gray-900">התחברות</Link>
            <Link href="/auth/register" className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">הרשמה חינם</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="py-16 px-4 bg-gradient-to-b from-blue-50 to-white">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-black text-gray-900 mb-4">
            בלוג <span className="text-blue-600">טלמדיסן</span>
          </h1>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto">
            מאמרים רפואיים, מדריכים מעשיים וטיפים בנושאי בריאות וטלרפואה — הכל בעברית, הכל מבוסס מקצועי.
          </p>
        </div>
      </section>

      {/* Category Filter + Posts Grid */}
      <BlogPostsGrid posts={posts} categories={categories} />

      {/* Specialties */}
      <section className="py-12 px-4 bg-gray-50">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl font-black mb-6">התמחויות</h2>
          <div className="flex flex-wrap justify-center gap-3">
            {SPECIALTIES.map(s => (
              <Link key={s.id} href={`/specialties/${s.id}`} className="px-4 py-2 bg-white text-gray-700 border border-gray-200 rounded-full text-sm font-medium hover:border-blue-400 hover:text-blue-600 transition-colors">
                {s.label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-4 bg-blue-600 text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-black mb-4">מוכנים להתחיל?</h2>
          <p className="text-xl text-blue-100 mb-8">קבעו ייעוץ רפואי אונליין עם רופא מומחה — מהיר, נוח ומאובטח.</p>
          <Link href="/auth/register" className="bg-white text-blue-600 px-8 py-4 rounded-xl text-lg font-bold hover:bg-blue-50 transition-colors inline-block">
            הירשמו חינם
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 bg-gray-900 text-gray-400">
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-sm">
          <div>
            <h5 className="font-bold text-white mb-3">טלמדיסן</h5>
            <p>פלטפורמת ייעוץ רפואי אונליין מתקדמת</p>
          </div>
          <div>
            <h5 className="font-bold text-white mb-3">התמחויות</h5>
            {SPECIALTIES.slice(0, 5).map(s => (
              <p key={s.id}><Link href={`/specialties/${s.id}`} className="hover:text-white">{s.label}</Link></p>
            ))}
          </div>
          <div>
            <h5 className="font-bold text-white mb-3">קישורים</h5>
            <p><Link href="/doctors" className="hover:text-white">הרופאים שלנו</Link></p>
            <p><Link href="/blog" className="hover:text-white">בלוג</Link></p>
            <p><Link href="/auth/register" className="hover:text-white">הרשמה</Link></p>
            <p><Link href="/auth/login" className="hover:text-white">התחברות</Link></p>
          </div>
          <div>
            <h5 className="font-bold text-white mb-3">משפטי</h5>
            <p><Link href="/terms" className="hover:text-white">תנאי שימוש</Link></p>
            <p><Link href="/privacy" className="hover:text-white">מדיניות פרטיות</Link></p>
            <p><Link href="/accessibility" className="hover:text-white">נגישות</Link></p>
          </div>
        </div>
        <div className="max-w-6xl mx-auto mt-8 pt-8 border-t border-gray-800 text-center text-xs">
          &copy; {new Date().getFullYear()} טלמדיסן. כל הזכויות שמורות.
        </div>
      </footer>
    </div>
  )
}
