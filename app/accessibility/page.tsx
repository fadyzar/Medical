import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'הצהרת נגישות',
  description: 'הצהרת הנגישות של פלטפורמת CANNA — מחויבות לנגישות דיגיטלית לפי תקן ת"י 5568 ו-WCAG 2.1 AA.',
}

const FEATURES = [
  {
    title: 'ניווט מקלדת מלא',
    desc: 'כל פונקציה בפלטפורמה ניתנת להפעלה באמצעות מקלדת בלבד, ללא עכבר. סדר הפוקוס הגיוני ומסודר.',
    wcag: '2.1.1, 2.4.3',
  },
  {
    title: 'מחוון פוקוס גלוי',
    desc: 'כל אלמנט אינטראקטיבי (כפתור, קישור, שדה) מציג מסגרת כחולה ברורה בעת מיקוד המקלדת.',
    wcag: '2.4.7',
  },
  {
    title: 'דלג לתוכן הראשי',
    desc: 'קישור מוסתר בראש כל דף — מופיע בלחיצת Tab ומאפשר לדלג על תפריט הניווט ישירות לתוכן.',
    wcag: '2.4.1',
  },
  {
    title: 'ניגודיות צבעים תקנית',
    desc: 'יחס ניגודיות מינימלי 4.5:1 לטקסט רגיל ו-3:1 לטקסט גדול (18pt+). נבדק עם WebAIM Contrast Checker.',
    wcag: '1.4.3, 1.4.6',
  },
  {
    title: 'הגדלת טקסט עד 200%',
    desc: 'ניתן להגדיל את גודל הטקסט ב-widget הנגישות (עד 150%) ועד 400% עם זום הדפדפן — ללא אובדן תוכן.',
    wcag: '1.4.4, 1.4.10',
  },
  {
    title: 'Widget נגישות מובנה',
    desc: 'כפתור נגישות כחול בפינה השמאלית התחתונה. כולל: גודל טקסט, ניגודיות גבוהה, גווני אפור, הדגשת קישורים, פונט קריא, הפוך צבעים. ההגדרות נשמרות בין ביקורים.',
    wcag: '1.4.3, 1.4.4, 1.4.8',
  },
  {
    title: 'תמיכה בקורא מסך',
    desc: 'שימוש בתגיות HTML5 סמנטיות (main, nav, header, footer, article, section). ARIA labels, aria-live, aria-expanded, aria-controls על כל אלמנט אינטראקטיבי.',
    wcag: '1.3.1, 4.1.2',
  },
  {
    title: 'שפה מוצהרת',
    desc: 'תכונת lang="he" על תגית <html>. כל תוכן בשפה אחרת מסומן עם lang מתאים.',
    wcag: '3.1.1, 3.1.2',
  },
  {
    title: 'RTL מלא',
    desc: 'הממשק כולו מותאם לכיוון ימין-לשמאל עם dir="rtl". מרווחים, חיצים וסדר אלמנטים תואמים.',
    wcag: '1.3.2',
  },
  {
    title: 'טפסים נגישים',
    desc: 'כל שדה קלט כולל label מקושר, placeholder, הודעות שגיאה עם role="alert", ורמז (aria-describedby). אין שדה ללא תוויות.',
    wcag: '1.3.1, 3.3.1, 3.3.2',
  },
  {
    title: 'אין תוכן מהבהב',
    desc: 'אין אנימציות המהבהבות יותר מ-3 פעמים בשנייה. תמיכה ב-prefers-reduced-motion לביטול אנימציות.',
    wcag: '2.3.1, 2.3.3',
  },
  {
    title: 'מסמכים ואחסון',
    desc: 'מסמכים רפואיים מאוחסנים בצורה מאובטחת עם Signed URLs בלבד. גישה לפי הרשאה.',
    wcag: '—',
  },
]

const GAPS = [
  'כתוביות בזמן אמת (Live Captions) בשיחות וידאו — בתכנון לשלב הבא',
  'מסמכי PDF שהועלו על ידי משתמשים עשויים שלא להיות נגישים',
  'תוכן שנוצר על ידי משתמשים (הערות, ביקורות) עשוי שלא לעמוד בכל התקנים',
  'שיחות וידאו מחייבות מצלמה ומיקרופון — חלופת טקסט בשלבי פיתוח',
]

export default function AccessibilityPage() {
  const lastReview = 'יוני 2026'

  return (
    <div className="min-h-screen bg-white" dir="rtl">

      {/* ── Navbar ── */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100 shadow-sm" role="navigation" aria-label="ניווט ראשי">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="text-xl font-black text-blue-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 rounded" aria-label="CANNA — עמוד הבית">
            CANNA
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/" className="text-sm text-gray-600 hover:text-gray-900 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 rounded px-1">
              חזרה לאתר
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Main content ── */}
      <main className="max-w-4xl mx-auto px-6 py-12" aria-label="הצהרת נגישות">

        {/* Header */}
        <div className="mb-10">
          <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold px-3 py-1.5 rounded-full mb-5">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="4" r="1.5" fill="currentColor" stroke="none"/>
              <path d="M9 9h6M12 9v4M10 20l2-4 2 4"/>
              <path d="M8.5 20c-.8-1.5-1-3-1-4.5C7.5 14 9 13 12 13s4.5 1 4.5 2.5c0 1.5-.2 3-1 4.5"/>
            </svg>
            הצהרת נגישות
          </div>
          <h1 className="text-4xl font-black text-gray-900 mb-3">נגישות דיגיטלית לכולם</h1>
          <p className="text-gray-500 text-sm">עדכון אחרון: {lastReview} · תקן: ת&quot;י 5568 / WCAG 2.1 AA</p>
        </div>

        {/* Intro */}
        <section className="mb-10 bg-blue-50 border border-blue-200 rounded-2xl p-6" aria-labelledby="intro-heading">
          <h2 id="intro-heading" className="text-lg font-bold text-blue-900 mb-3">מחויבות לנגישות</h2>
          <p className="text-blue-800 text-sm leading-relaxed">
            CANNA מחויבת להנגשת הפלטפורמה לכלל האוכלוסייה, לרבות אנשים עם מוגבלויות שונות —
            לקויי ראייה, לקויי שמיעה, לקויי מוטוריקה ולקויי קוגניציה.
            אנו פועלים בהתאם ל<strong>חוק שוויון זכויות לאנשים עם מוגבלות, תשנ&quot;ח-1998</strong> ול<strong>תקנות הנגישות לשירותי אינטרנט</strong>
            {' '}המבוססות על תקן ת&quot;י 5568 / WCAG 2.1 ברמה AA.
          </p>
        </section>

        {/* Features */}
        <section className="mb-10" aria-labelledby="features-heading">
          <h2 id="features-heading" className="text-2xl font-black text-gray-900 mb-6">פעולות הנגשה שביצענו</h2>
          <div className="space-y-3">
            {FEATURES.map(f => (
              <div key={f.title} className="flex items-start gap-4 bg-gray-50 border border-gray-100 rounded-xl p-4 hover:border-blue-200 transition-colors">
                <div className="w-6 h-6 rounded-full bg-green-100 border border-green-200 flex items-center justify-center shrink-0 mt-0.5" aria-hidden="true">
                  <svg className="w-3.5 h-3.5 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-gray-900 text-sm">{f.title}</h3>
                    {f.wcag !== '—' && (
                      <span className="text-[10px] bg-blue-100 text-blue-700 font-mono px-1.5 py-0.5 rounded border border-blue-200">
                        WCAG {f.wcag}
                      </span>
                    )}
                  </div>
                  <p className="text-gray-600 text-xs mt-1 leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Supported tech */}
        <section className="mb-10" aria-labelledby="tech-heading">
          <h2 id="tech-heading" className="text-2xl font-black text-gray-900 mb-5">טכנולוגיות עזר נתמכות</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: 'קוראי מסך', items: ['NVDA (Windows)', 'JAWS (Windows)', 'VoiceOver (macOS/iOS)', 'TalkBack (Android)'] },
              { label: 'דפדפנים', items: ['Chrome 110+', 'Firefox 110+', 'Edge 110+', 'Safari 16+'] },
              { label: 'מכשירים', items: ['Windows 10/11', 'macOS 12+', 'iOS 16+', 'Android 12+'] },
            ].map(cat => (
              <div key={cat.label} className="bg-gray-50 rounded-xl border border-gray-100 p-4">
                <h3 className="font-bold text-gray-800 text-sm mb-3">{cat.label}</h3>
                <ul className="space-y-1" role="list">
                  {cat.items.map(item => (
                    <li key={item} className="text-gray-600 text-xs flex items-center gap-2">
                      <span className="w-1 h-1 rounded-full bg-blue-400 shrink-0" aria-hidden="true"/>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* Known gaps */}
        <section className="mb-10" aria-labelledby="gaps-heading">
          <h2 id="gaps-heading" className="text-2xl font-black text-gray-900 mb-5">מגבלות ידועות</h2>
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
            <ul className="space-y-2.5" role="list">
              {GAPS.map(g => (
                <li key={g} className="flex items-start gap-3 text-sm text-amber-800">
                  <svg className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  {g}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Contact */}
        <section className="mb-10" aria-labelledby="contact-heading">
          <h2 id="contact-heading" className="text-2xl font-black text-gray-900 mb-5">משוב ופניות נגישות</h2>
          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 space-y-4">
            <p className="text-gray-700 text-sm leading-relaxed">
              נתקלת בבעיית נגישות? יש לך הצעה לשיפור?
              אנו מתחייבים לטפל בכל פנייה תוך <strong>5 ימי עסקים</strong>.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { label: 'אימייל', value: 'accessibility@cannaforyou.net', href: 'mailto:accessibility@cannaforyou.net' },
                { label: 'טלפון', value: '*5500 (א׳–ה׳, 09:00–17:00)', href: 'tel:*5500' },
              ].map(c => (
                <div key={c.label} className="bg-white rounded-xl border border-gray-100 p-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{c.label}</p>
                  <a
                    href={c.href}
                    className="text-blue-600 hover:text-blue-800 font-medium text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 rounded"
                  >
                    {c.value}
                  </a>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Coordinator */}
        <section className="mb-10 bg-blue-50 border border-blue-200 rounded-2xl p-6" aria-labelledby="coordinator-heading">
          <h2 id="coordinator-heading" className="text-lg font-bold text-blue-900 mb-2">רכז נגישות</h2>
          <p className="text-blue-800 text-sm leading-relaxed">
            מונה רכז נגישות לפלטפורמה בהתאם לדרישות חוק שוויון זכויות לאנשים עם מוגבלות.
            לפניות בנושא נגישות:{' '}
            <a href="mailto:accessibility@cannaforyou.net" className="font-semibold underline hover:text-blue-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-600 rounded">
              accessibility@cannaforyou.net
            </a>
          </p>
        </section>

        {/* Standards */}
        <section className="mb-10" aria-labelledby="standards-heading">
          <h2 id="standards-heading" className="text-2xl font-black text-gray-900 mb-5">תקנים ובסיס חוקי</h2>
          <div className="space-y-2">
            {[
              { label: 'תקן ישראלי', value: 'ת"י 5568 — נגישות לאינטרנט (מבוסס WCAG 2.1)' },
              { label: 'רמת עמידה', value: 'AA (Level AA) — הרמה הנדרשת על פי החוק הישראלי' },
              { label: 'חוק בסיס', value: 'חוק שוויון זכויות לאנשים עם מוגבלות, תשנ"ח-1998' },
              { label: 'תקנות', value: 'תקנות שוויון זכויות לאנשים עם מוגבלות (התאמות נגישות לשירות), תשע"ג-2013' },
            ].map(s => (
              <div key={s.label} className="flex items-start gap-4 text-sm">
                <span className="text-gray-500 font-semibold shrink-0 w-28">{s.label}:</span>
                <span className="text-gray-800">{s.value}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Review date */}
        <div className="text-center py-6 border-t border-gray-100">
          <p className="text-gray-400 text-sm">הצהרה זו עודכנה לאחרונה ב-{lastReview}</p>
        </div>

      </main>

      {/* Footer */}
      <footer className="py-8 px-6 bg-gray-900 text-gray-400 text-sm" role="contentinfo">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© {new Date().getFullYear()} CANNA. כל הזכויות שמורות.</p>
          <nav aria-label="ניווט תחתון" className="flex items-center gap-5">
            <Link href="/terms" className="hover:text-white transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white rounded">תנאי שימוש</Link>
            <Link href="/privacy" className="hover:text-white transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white rounded">פרטיות</Link>
            <Link href="/accessibility" className="text-white font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white rounded" aria-current="page">נגישות</Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}
