'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { BlogPost } from '@/lib/blog/posts'
import { cn } from '@/lib/utils'

type Props = {
  posts: BlogPost[]
  categories: string[]
}

export default function BlogPostsGrid({ posts, categories }: Props) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null)

  const filtered = activeCategory
    ? posts.filter(p => p.category === activeCategory)
    : posts

  return (
    <>
      {/* Category Filter */}
      <section className="px-4 py-6 border-b">
        <div className="max-w-6xl mx-auto flex flex-wrap justify-center gap-3">
          <button
            onClick={() => setActiveCategory(null)}
            className={cn(
              'px-4 py-2 rounded-full text-sm font-medium transition-colors',
              !activeCategory
                ? 'bg-teal-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            )}
          >
            הכל
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={cn(
                'px-4 py-2 rounded-full text-sm font-medium transition-colors',
                activeCategory === cat
                  ? 'bg-teal-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </section>

      {/* Posts Grid */}
      <section className="py-12 px-4">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filtered.map(post => (
            <Link key={post.slug} href={`/blog/${post.slug}`} className="group">
              <article className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow p-6 h-full flex flex-col">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-4xl">{post.coverEmoji}</span>
                  <span className="text-xs font-medium bg-teal-50 text-teal-700 px-3 py-1 rounded-full">
                    {post.category}
                  </span>
                </div>
                <h2 className="text-lg font-bold text-slate-900 mb-2 group-hover:text-teal-600 transition-colors">
                  {post.title}
                </h2>
                <p className="text-sm text-slate-500 line-clamp-2 mb-4 flex-1">
                  {post.description}
                </p>
                <div className="flex items-center gap-3 text-xs text-slate-400 pt-3 border-t border-slate-50">
                  <span>{post.author.name}</span>
                  <span>·</span>
                  <span>{new Date(post.publishedAt).toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                  <span>·</span>
                  <span>{post.readingTimeMinutes} דק׳ קריאה</span>
                </div>
              </article>
            </Link>
          ))}
        </div>
        {filtered.length === 0 && (
          <p className="text-center text-slate-400 mt-8">לא נמצאו מאמרים בקטגוריה זו.</p>
        )}
      </section>
    </>
  )
}
