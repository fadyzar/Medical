import type { Metadata } from 'next'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import { notFound } from 'next/navigation'
import { getAllPosts, getPostBySlug, getRelatedPosts } from '@/lib/blog/posts'
import type { Components } from 'react-markdown'
import { Breadcrumb } from '@/components/ui'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://your-domain.co.il'

// ── Static Params ─────────────────────────────────────

export function generateStaticParams() {
  return getAllPosts().map(post => ({ slug: post.slug }))
}

// ── Metadata ──────────────────────────────────────────

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const post = getPostBySlug(slug)
  if (!post) return { title: 'מאמר לא נמצא' }

  return {
    title: post.seoTitle,
    description: post.seoDescription,
    openGraph: {
      title: post.seoTitle,
      description: post.seoDescription,
      type: 'article',
      locale: 'he_IL',
      url: `${BASE_URL}/blog/${post.slug}`,
      publishedTime: post.publishedAt,
      ...(post.updatedAt && { modifiedTime: post.updatedAt }),
      authors: [post.author.name],
    },
    twitter: {
      card: 'summary_large_image',
      title: post.seoTitle,
      description: post.seoDescription,
    },
    alternates: { canonical: `${BASE_URL}/blog/${post.slug}` },
  }
}

// ── Markdown Components ───────────────────────────────

const markdownComponents: Components = {
  h2: (props) => <h2 className="text-2xl font-bold mt-8 mb-4 text-gray-900" {...props} />,
  h3: (props) => <h3 className="text-xl font-bold mt-6 mb-3 text-gray-900" {...props} />,
  p: (props) => <p className="text-gray-700 leading-relaxed mb-4" {...props} />,
  ul: (props) => <ul className="list-disc list-inside space-y-2 mb-4 text-gray-700" {...props} />,
  ol: (props) => <ol className="list-decimal list-inside space-y-2 mb-4 text-gray-700" {...props} />,
  li: (props) => <li className="leading-relaxed" {...props} />,
  strong: (props) => <strong className="font-bold text-gray-900" {...props} />,
  a: (props) => <a className="text-blue-600 hover:underline" {...props} />,
  blockquote: (props) => <blockquote className="border-r-4 border-blue-500 pr-4 my-4 text-gray-600 italic" {...props} />,
}

// ── Page Component ────────────────────────────────────

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post = getPostBySlug(slug)

  if (!post) notFound()

  const related = getRelatedPosts(slug, 3)

  // Schema.org BlogPosting
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.seoDescription,
    url: `${BASE_URL}/blog/${post.slug}`,
    datePublished: post.publishedAt,
    ...(post.updatedAt && { dateModified: post.updatedAt }),
    author: {
      '@type': 'Person',
      name: post.author.name,
    },
    publisher: {
      '@type': 'Organization',
      name: 'טלמדיסן',
      url: BASE_URL,
    },
    inLanguage: 'he',
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${BASE_URL}/blog/${post.slug}`,
    },
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
            <Link href="/blog" className="text-sm text-gray-600 hover:text-gray-900">בלוג</Link>
            <Link href="/auth/login" className="text-sm text-gray-600 hover:text-gray-900">התחברות</Link>
            <Link href="/auth/register" className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">הרשמה חינם</Link>
          </div>
        </div>
      </nav>

      {/* Article */}
      <article className="py-12 px-4">
        <div className="max-w-3xl mx-auto">
          {/* Breadcrumb */}
          <Breadcrumb items={[
            { label: 'דף הבית', href: '/' },
            { label: 'בלוג', href: '/blog' },
            { label: post.title },
          ]} />
          {/* Back link */}
          <Link href="/blog" className="text-sm text-blue-600 hover:underline mb-8 inline-flex items-center gap-1">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>
            חזרה לבלוג
          </Link>

          {/* Meta */}
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xs font-medium bg-blue-50 text-blue-700 px-3 py-1 rounded-full">
              {post.category}
            </span>
            <span className="text-xs text-gray-400">
              {new Date(post.publishedAt).toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
            <span className="text-xs text-gray-400">
              {post.readingTimeMinutes} דק׳ קריאה
            </span>
          </div>

          {/* Title */}
          <h1 className="text-3xl md:text-4xl font-black text-gray-900 mb-6 leading-tight">
            {post.title}
          </h1>

          {/* Author */}
          <div className="flex items-center gap-3 mb-8 pb-8 border-b">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-lg">
              {post.coverEmoji}
            </div>
            <div>
              <p className="font-medium text-gray-900 text-sm">{post.author.name}</p>
              <p className="text-xs text-gray-500">{post.author.role}</p>
            </div>
          </div>

          {/* Content */}
          <div className="prose-rtl">
            <ReactMarkdown components={markdownComponents}>
              {post.content}
            </ReactMarkdown>
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-2 mt-8 pt-8 border-t">
            {post.tags.map(tag => (
              <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-3 py-1 rounded-full">
                {tag}
              </span>
            ))}
          </div>
        </div>
      </article>

      {/* Related Posts */}
      {related.length > 0 && (
        <section className="py-12 px-4 bg-gray-50">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-black text-center mb-8">מאמרים נוספים</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {related.map(r => (
                <Link key={r.slug} href={`/blog/${r.slug}`} className="group">
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow p-6">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-3xl">{r.coverEmoji}</span>
                      <span className="text-xs font-medium bg-blue-50 text-blue-700 px-3 py-1 rounded-full">
                        {r.category}
                      </span>
                    </div>
                    <h3 className="font-bold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                      {r.title}
                    </h3>
                    <p className="text-sm text-gray-500 line-clamp-2">{r.description}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="py-16 px-4 bg-blue-600 text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-black mb-4">מעוניינים בייעוץ רפואי?</h2>
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
            <h5 className="font-bold text-white mb-3">קישורים</h5>
            <p><Link href="/doctors" className="hover:text-white">הרופאים שלנו</Link></p>
            <p><Link href="/blog" className="hover:text-white">בלוג</Link></p>
            <p><Link href="/auth/register" className="hover:text-white">הרשמה</Link></p>
          </div>
          <div>
            <h5 className="font-bold text-white mb-3">משפטי</h5>
            <p><Link href="/terms" className="hover:text-white">תנאי שימוש</Link></p>
            <p><Link href="/privacy" className="hover:text-white">מדיניות פרטיות</Link></p>
            <p><Link href="/accessibility" className="hover:text-white">נגישות</Link></p>
          </div>
          <div>
            <h5 className="font-bold text-white mb-3">צרו קשר</h5>
            <p>support@telemed.co.il</p>
          </div>
        </div>
        <div className="max-w-6xl mx-auto mt-8 pt-8 border-t border-gray-800 text-center text-xs">
          &copy; {new Date().getFullYear()} טלמדיסן. כל הזכויות שמורות.
        </div>
      </footer>
    </div>
  )
}
