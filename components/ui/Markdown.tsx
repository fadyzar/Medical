'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '@/lib/utils'

/**
 * Markdown for AI-written text (assistant replies, pre-visit briefs).
 * No raw HTML; only in-app links are clickable; tables scroll inside their box
 * instead of widening the page on mobile.
 */
export function Markdown({ text, className }: { text: string; className?: string }) {
  return (
    <div className={cn('text-sm leading-relaxed break-words', className)}>
      <ReactMarkdown
        skipHtml
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h3 className="text-base font-bold text-slate-900 mt-3 mb-2 first:mt-0">{children}</h3>,
          h2: ({ children }) => <h4 className="text-sm font-bold text-slate-900 mt-3 mb-1.5 first:mt-0">{children}</h4>,
          h3: ({ children }) => <h5 className="text-sm font-semibold text-slate-800 mt-2 mb-1 first:mt-0">{children}</h5>,
          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="list-disc ps-5 mb-2 last:mb-0 space-y-0.5">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal ps-5 mb-2 last:mb-0 space-y-0.5">{children}</ol>,
          strong: ({ children }) => <strong className="font-semibold text-slate-900">{children}</strong>,
          blockquote: ({ children }) => <blockquote className="border-s-4 border-amber-300 bg-amber-50 ps-3 py-1.5 my-2 text-amber-900 rounded-e">{children}</blockquote>,
          hr: () => <hr className="my-3 border-slate-200" />,
          table: ({ children }) => (
            <div className="overflow-x-auto my-2 rounded-lg border border-slate-200">
              <table className="w-full text-xs">{children}</table>
            </div>
          ),
          th: ({ children }) => <th className="bg-slate-50 px-2.5 py-1.5 text-right font-semibold text-slate-700 border-b border-slate-200">{children}</th>,
          td: ({ children }) => <td className="px-2.5 py-1.5 border-b border-slate-100 align-top">{children}</td>,
          a: ({ children, href }) => (href?.startsWith('/')
            ? <a href={href} className="text-teal-700 underline">{children}</a>
            : <span>{children}</span>),
          code: ({ children }) => <code className="px-1 rounded bg-slate-200 text-[12px]">{children}</code>,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  )
}
