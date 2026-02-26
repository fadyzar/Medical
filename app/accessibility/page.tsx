import type { Metadata } from 'next'
import Link from 'next/link'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://your-domain.co.il'

export const metadata: Metadata = {
  title: 'הצהרת נגישות | טלמדיסן',
  description: 'הצהרת הנגישות של פלטפורמת טלמדיסן — מחויבות לנגישות דיגיטלית לכולם.',
  alternates: { canonical: `${BASE_URL}/accessibility` },
}

export default function AccessibilityPage() {
  return (
    <div className="min-h-screen bg-white" dir="rtl">
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

      {/* Content */}
      <article className="max-w-3xl mx-auto px-4 py-12 prose prose-lg prose-gray">
        <h1 className="text-3xl font-black text-gray-900 mb-2">הצהרת נגישות</h1>
        <p className="text-sm text-gray-400 mb-8">עדכון אחרון: פברואר 2026</p>

        <h2>מחויבות לנגישות</h2>
        <p>
          טלמדיסן מחויבת להנגשת הפלטפורמה לכלל האוכלוסייה, לרבות אנשים עם מוגבלויות,
          בהתאם לחוק שוויון זכויות לאנשים עם מוגבלות, תשנ&quot;ח-1998 ולתקנות הנגישות לשירותי אינטרנט.
        </p>

        <h2>תקנים</h2>
        <p>
          אנו פועלים בהתאם לתקן הנגישות הישראלי (ת&quot;י 5568) ולהנחיות WCAG 2.1 ברמה AA.
        </p>

        <h2>פעולות הנגשה שביצענו</h2>
        <ul>
          <li><strong>מבנה סמנטי</strong> — שימוש בתגיות HTML סמנטיות (header, nav, main, footer, article) לניווט מסודר</li>
          <li><strong>ניווט מקלדת</strong> — כל הפונקציות בפלטפורמה ניתנות להפעלה באמצעות מקלדת בלבד</li>
          <li><strong>תאימות קורא מסך</strong> — שימוש ב-ARIA labels, aria-live ו-alt text על כל תמונה</li>
          <li><strong>ניגודיות צבעים</strong> — יחס ניגודיות מינימלי של 4.5:1 לטקסט רגיל ו-3:1 לטקסט גדול</li>
          <li><strong>גודל טקסט</strong> — אפשרות להגדלת טקסט ללא פגיעה בתצוגה</li>
          <li><strong>תמיכה ב-RTL</strong> — הממשק כולו מותאם לכיוון ימין-לשמאל</li>
          <li><strong>מצב פוקוס</strong> — אינדיקציה ויזואלית ברורה (focus-visible) בכל אלמנט אינטראקטיבי</li>
          <li><strong>טפסים נגישים</strong> — כל שדה קלט כולל תווית (label) מקושרת והודעות שגיאה ברורות</li>
          <li><strong>שיחות וידאו</strong> — כפתורי שליטה גדולים ונגישים במקלדת</li>
          <li><strong>רספונסיביות</strong> — הממשק מותאם לכל גודל מסך, כולל מכשירים ניידים</li>
        </ul>

        <h2>טכנולוגיות נגישות נתמכות</h2>
        <ul>
          <li>קוראי מסך: NVDA, JAWS, VoiceOver</li>
          <li>דפדפנים: Chrome, Firefox, Edge, Safari (גרסאות עדכניות)</li>
          <li>מערכות הפעלה: Windows, macOS, iOS, Android</li>
        </ul>

        <h2>מגבלות ידועות</h2>
        <ul>
          <li>תוכן שנוצר על ידי משתמשים (ביקורות, הודעות) עשוי שלא לעמוד בכל תקני הנגישות</li>
          <li>מסמכי PDF שהועלו על ידי משתמשים עשויים שלא להיות נגישים</li>
          <li>שיחות וידאו דורשות מצלמה ומיקרופון — כתוביות בזמן אמת אינן נתמכות כרגע</li>
        </ul>

        <h2>משוב ודיווח על בעיות</h2>
        <p>
          אם נתקלת בבעיית נגישות או שיש לך הצעות לשיפור, נשמח לשמוע ממך.
          אנו מתחייבים לטפל בכל פנייה תוך 5 ימי עסקים.
        </p>
        <ul>
          <li><strong>אימייל:</strong> accessibility@telemedsn.co.il</li>
          <li><strong>טלפון:</strong> *5500 (ימים א׳-ה׳, 9:00-17:00)</li>
        </ul>

        <h2>רכז נגישות</h2>
        <p>
          מונה רכז נגישות לפלטפורמה. לפניות בנושא נגישות:
          accessibility@telemedsn.co.il
        </p>
      </article>

      {/* Footer */}
      <footer className="py-8 px-4 bg-gray-900 text-gray-400 text-center text-sm">
        <div className="max-w-6xl mx-auto flex flex-wrap justify-center gap-6 mb-4">
          <Link href="/terms" className="hover:text-white">תנאי שימוש</Link>
          <Link href="/privacy" className="hover:text-white">מדיניות פרטיות</Link>
          <Link href="/accessibility" className="text-white font-medium">נגישות</Link>
        </div>
        <p>&copy; {new Date().getFullYear()} טלמדיסן. כל הזכויות שמורות.</p>
      </footer>
    </div>
  )
}
