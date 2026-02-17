import type { Metadata } from 'next'
import Link from 'next/link'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://your-domain.co.il'

export const metadata: Metadata = {
  title: 'מדיניות פרטיות | טלמדיסן',
  description: 'מדיניות הפרטיות של פלטפורמת טלמדיסן — איך אנחנו שומרים על המידע שלך.',
  alternates: { canonical: `${BASE_URL}/privacy` },
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white" dir="rtl">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="text-2xl font-black text-blue-600">טלמדיסן</Link>
          <div className="flex items-center gap-4">
            <Link href="/doctors" className="text-sm text-gray-600 hover:text-gray-900">הרופאים שלנו</Link>
            <Link href="/blog" className="text-sm text-gray-600 hover:text-gray-900">בלוג</Link>
            <Link href="/auth/login" className="text-sm text-gray-600 hover:text-gray-900">התחברות</Link>
          </div>
        </div>
      </nav>

      {/* Content */}
      <article className="max-w-3xl mx-auto px-4 py-12 prose prose-lg prose-gray">
        <h1 className="text-3xl font-black text-gray-900 mb-2">מדיניות פרטיות</h1>
        <p className="text-sm text-gray-400 mb-8">עדכון אחרון: פברואר 2026</p>

        <h2>1. מבוא</h2>
        <p>
          טלמדיסן (להלן: &quot;אנחנו&quot;, &quot;הפלטפורמה&quot;) מחויבת להגנה על פרטיותך.
          מדיניות זו מסבירה אילו נתונים אנו אוספים, כיצד אנו משתמשים בהם ואיך אנו מגנים עליהם,
          בהתאם לחוק הגנת הפרטיות, תשמ&quot;א-1981 ולתקנות אבטחת מידע.
        </p>

        <h2>2. מידע שאנו אוספים</h2>

        <h3>2.1 מידע אישי</h3>
        <ul>
          <li>שם מלא, כתובת אימייל, מספר טלפון</li>
          <li>תאריך לידה ומגדר</li>
          <li>כתובת מגורים (אופציונלי)</li>
        </ul>

        <h3>2.2 מידע רפואי</h3>
        <ul>
          <li>תלונות ותסמינים שתיארת בשאלון המקדים</li>
          <li>מסמכים רפואיים שהעלית (תוצאות בדיקות, צילומים)</li>
          <li>סיכומי ייעוץ ומרשמים שנכתבו על ידי הרופא</li>
          <li>תוצאות מיון AI (דחיפות, המלצת התמחות)</li>
        </ul>

        <h3>2.3 מידע טכני</h3>
        <ul>
          <li>כתובת IP, סוג דפדפן ומערכת הפעלה</li>
          <li>נתוני שימוש (עמודים שנצפו, זמני שימוש)</li>
          <li>עוגיות (cookies) לניהול מפגש ואימות</li>
        </ul>

        <h3>2.4 מידע תשלום</h3>
        <ul>
          <li>4 ספרות אחרונות של כרטיס האשראי (לזיהוי בלבד)</li>
          <li>פרטי כרטיס מלאים אינם נשמרים אצלנו — הם מעובדים על ידי ספק התשלומים Tranzila</li>
        </ul>

        <h2>3. כיצד אנו משתמשים במידע</h2>
        <ul>
          <li><strong>מתן שירות רפואי</strong> — הצגת המידע לרופא המטפל לצורך הייעוץ</li>
          <li><strong>תקשורת</strong> — שליחת תזכורות לתורים, סיכומי ייעוץ וקבלות</li>
          <li><strong>שיפור השירות</strong> — ניתוח מגמות שימוש (ללא מידע מזהה אישית)</li>
          <li><strong>חובות חוקיות</strong> — שמירת רשומות רפואיות כנדרש בחוק</li>
          <li><strong>אבטחה</strong> — זיהוי ומניעת שימוש לרעה</li>
        </ul>

        <h2>4. שיתוף מידע עם צדדים שלישיים</h2>
        <p>איננו מוכרים או משכירים מידע אישי. מידע משותף רק במקרים הבאים:</p>
        <ul>
          <li><strong>רופאים מטפלים</strong> — המידע הרפואי שלך מוצג לרופא שנבחר לצורך הייעוץ</li>
          <li><strong>ספקי שירות</strong> — עיבוד תשלומים (Tranzila), שליחת הודעות (Resend, Infobip), אירוח (Supabase, Vercel) — כולם כפופים להסכמי סודיות</li>
          <li><strong>חובה חוקית</strong> — בהתאם לצו בית משפט או דרישה חוקית מחייבת</li>
        </ul>

        <h2>5. אבטחת מידע</h2>
        <p>אנו מיישמים אמצעי אבטחה מתקדמים:</p>
        <ul>
          <li><strong>הצפנה</strong> — כל התקשורת מוצפנת (TLS 1.3). מסמכים רפואיים מאוחסנים מוצפנים</li>
          <li><strong>הרשאות</strong> — גישה למידע רפואי מוגבלת לרופא המטפל בלבד (Row Level Security)</li>
          <li><strong>אימות</strong> — אימות דו-שלבי זמין לכל המשתמשים</li>
          <li><strong>ביקורת</strong> — כל גישה למידע רגיש נרשמת ביומן ביקורת (audit log)</li>
          <li><strong>שיחות וידאו</strong> — מוצפנות מקצה לקצה (E2EE)</li>
        </ul>

        <h2>6. שמירת מידע</h2>
        <ul>
          <li><strong>מידע רפואי</strong> — נשמר 7 שנים לפחות, בהתאם לתקנות משרד הבריאות</li>
          <li><strong>מידע חשבון</strong> — נשמר כל עוד החשבון פעיל. לאחר מחיקה — 90 יום לשחזור</li>
          <li><strong>נתוני תשלום</strong> — נשמרים 7 שנים לצרכי מס וחשבונאות</li>
        </ul>

        <h2>7. עוגיות (Cookies)</h2>
        <p>אנו משתמשים בעוגיות לצרכים הבאים:</p>
        <ul>
          <li><strong>עוגיות הכרחיות</strong> — אימות, ניהול מפגש (session), אבטחה</li>
          <li><strong>עוגיות ביצועים</strong> — ניטור שגיאות (Sentry)</li>
        </ul>
        <p>איננו משתמשים בעוגיות פרסומיות או עוגיות מעקב של צדדים שלישיים.</p>

        <h2>8. הזכויות שלך</h2>
        <p>בהתאם לחוק הגנת הפרטיות, יש לך את הזכויות הבאות:</p>
        <ul>
          <li><strong>עיון</strong> — לעיין במידע האישי שנשמר עליך</li>
          <li><strong>תיקון</strong> — לבקש תיקון מידע שגוי</li>
          <li><strong>מחיקה</strong> — לבקש מחיקת המידע (בכפוף לחובות חוקיות)</li>
          <li><strong>ניוד</strong> — לקבל עותק של המידע שלך בפורמט דיגיטלי</li>
          <li><strong>הסרה</strong> — להסיר הסכמה לקבלת דיוור שיווקי</li>
        </ul>
        <p>לממש את זכויותיך, פנה אלינו בכתובת: privacy@telemedsn.co.il</p>

        <h2>9. שימוש ב-AI</h2>
        <p>
          הפלטפורמה משתמשת בבינה מלאכותית (AI) לסיוע רפואי — מיון דחיפות, שאלון מקדים, סיכום ייעוץ וטיוטת מרשם.
        </p>
        <ul>
          <li>ה-AI מסייע לרופא בלבד — כל החלטה רפואית מתקבלת על ידי הרופא</li>
          <li>מידע רפואי מועבר ל-API של Anthropic (Claude) לצורך עיבוד בלבד ואינו נשמר שם</li>
          <li>מידע מזהה אישית (PII) אינו נרשם ביומני המערכת</li>
        </ul>

        <h2>10. ילדים וקטינים</h2>
        <p>
          השירות מיועד לבני 18 ומעלה. שימוש על ידי קטינים דורש הסכמת הורה או אפוטרופוס.
          אם נודע לנו שנאסף מידע על קטין ללא הסכמה, נמחק אותו.
        </p>

        <h2>11. שינויים במדיניות</h2>
        <p>
          אנו עשויים לעדכן מדיניות זו מעת לעת. שינויים מהותיים יפורסמו באתר ובהודעה במייל למשתמשים רשומים.
          תאריך העדכון האחרון מצוין בראש המסמך.
        </p>

        <h2>12. יצירת קשר</h2>
        <p>
          לשאלות בנושא פרטיות: privacy@telemedsn.co.il
        </p>
      </article>

      {/* Footer */}
      <footer className="py-8 px-4 bg-gray-900 text-gray-400 text-center text-sm">
        <div className="max-w-6xl mx-auto flex flex-wrap justify-center gap-6 mb-4">
          <Link href="/terms" className="hover:text-white">תנאי שימוש</Link>
          <Link href="/privacy" className="text-white font-medium">מדיניות פרטיות</Link>
          <Link href="/accessibility" className="hover:text-white">נגישות</Link>
        </div>
        <p>&copy; {new Date().getFullYear()} טלמדיסן. כל הזכויות שמורות.</p>
      </footer>
    </div>
  )
}
