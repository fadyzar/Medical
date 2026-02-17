import type { Metadata } from 'next'
import Link from 'next/link'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://your-domain.co.il'

export const metadata: Metadata = {
  title: 'תנאי שימוש | טלמדיסן',
  description: 'תנאי השימוש של פלטפורמת טלמדיסן — ייעוץ רפואי אונליין.',
  alternates: { canonical: `${BASE_URL}/terms` },
}

export default function TermsPage() {
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
        <h1 className="text-3xl font-black text-gray-900 mb-2">תנאי שימוש</h1>
        <p className="text-sm text-gray-400 mb-8">עדכון אחרון: פברואר 2026</p>

        <h2>1. כללי</h2>
        <p>
          ברוכים הבאים לטלמדיסן (להלן: &quot;הפלטפורמה&quot;, &quot;האתר&quot; או &quot;השירות&quot;).
          השימוש בפלטפורמה כפוף לתנאי שימוש אלו. בעצם השימוש בפלטפורמה, אתה מסכים לתנאים אלו במלואם.
          אם אינך מסכים לתנאים, אנא הימנע משימוש בפלטפורמה.
        </p>

        <h2>2. תיאור השירות</h2>
        <p>
          טלמדיסן מספקת פלטפורמה טכנולוגית לייעוץ רפואי מרחוק באמצעות שיחות וידאו.
          הפלטפורמה מחברת בין מטופלים לרופאים מורשים ומאפשרת קביעת תורים, שיחות וידאו מאובטחות, קבלת סיכומי ייעוץ ומרשמים דיגיטליים.
        </p>

        <h2>3. תנאי הרשמה</h2>
        <ul>
          <li>השירות מיועד לבני 18 ומעלה. קטינים רשאים להשתמש בליווי הורה או אפוטרופוס.</li>
          <li>עליך לספק פרטים מדויקים ועדכניים בעת ההרשמה.</li>
          <li>אתה אחראי לשמור על סודיות פרטי הכניסה שלך.</li>
          <li>חשבון אחד לכל משתמש — אין לפתוח חשבונות כפולים.</li>
        </ul>

        <h2>4. שירות רפואי</h2>
        <ul>
          <li>הייעוץ הרפואי ניתן על ידי רופאים בעלי רישיון תקף ממשרד הבריאות בישראל.</li>
          <li>הפלטפורמה אינה מהווה תחליף לשירותי חירום. במצב חירום רפואי, יש לפנות למד&quot;א (101) או לחדר מיון.</li>
          <li>הייעוץ מוגבל ליכולות הטלרפואה — הרופא עשוי להפנות לבדיקה פיזית כשנדרש.</li>
          <li>מרשמים דיגיטליים ניתנים בהתאם לשיקול דעת רפואי ולתקנות משרד הבריאות.</li>
        </ul>

        <h2>5. תשלומים</h2>
        <ul>
          <li>מחירי הייעוץ מוצגים בשקלים חדשים (ILS) וכוללים מע&quot;מ.</li>
          <li>התשלום מתבצע לפני הייעוץ באמצעות כרטיס אשראי.</li>
          <li>עיבוד התשלומים מתבצע על ידי ספק תשלומים מאושר (Tranzila). פרטי כרטיס האשראי אינם נשמרים בשרתי הפלטפורמה.</li>
          <li>קבלה דיגיטלית תישלח לאימייל לאחר תשלום מוצלח.</li>
        </ul>

        <h2>6. ביטולים והחזרים</h2>
        <ul>
          <li>ביטול תור עד 24 שעות לפני מועד הייעוץ — ללא חיוב.</li>
          <li>ביטול תוך 24 שעות — חיוב מלא, אלא אם המרפאה מאשרת אחרת.</li>
          <li>במקרה של תקלה טכנית מצד הפלטפורמה — החזר מלא.</li>
          <li>אי-הגעה של המטופל ללא הודעה מראש — חיוב מלא.</li>
        </ul>

        <h2>7. פרטיות ואבטחה</h2>
        <p>
          המידע הרפואי שלך מוגן בהתאם לחוק הגנת הפרטיות, תשמ&quot;א-1981 ולתקנות אבטחת מידע.
          לפרטים מלאים, ראה את <Link href="/privacy" className="text-blue-600 hover:underline">מדיניות הפרטיות</Link> שלנו.
        </p>

        <h2>8. קניין רוחני</h2>
        <p>
          כל התוכן בפלטפורמה — לרבות עיצוב, לוגו, טקסטים, תמונות וקוד — הם קניינה של טלמדיסן או של בעלי הרישיון שלה.
          אין להעתיק, לשכפל, להפיץ או להשתמש בתוכן ללא אישור בכתב.
        </p>

        <h2>9. הגבלת אחריות</h2>
        <ul>
          <li>הפלטפורמה מספקת תשתית טכנולוגית בלבד — האחריות הרפואית היא של הרופא המטפל.</li>
          <li>הפלטפורמה אינה אחראית לתקלות תקשורת, אינטרנט או חומרה מצד המשתמש.</li>
          <li>הפלטפורמה אינה מתחייבת לזמינות 100% ועשויה לבצע תחזוקה מעת לעת.</li>
        </ul>

        <h2>10. שינויים בתנאים</h2>
        <p>
          טלמדיסן רשאית לעדכן תנאים אלו מעת לעת. שינויים מהותיים יפורסמו באתר ובהודעה למשתמשים רשומים.
          המשך שימוש בפלטפורמה לאחר עדכון התנאים מהווה הסכמה לתנאים המעודכנים.
        </p>

        <h2>11. דין חל וסמכות שיפוט</h2>
        <p>
          תנאי שימוש אלו כפופים לדיני מדינת ישראל. סמכות השיפוט הבלעדית נתונה לבתי המשפט בתל אביב-יפו.
        </p>

        <h2>12. יצירת קשר</h2>
        <p>
          לשאלות בנוגע לתנאי שימוש אלו, ניתן לפנות אלינו בכתובת: support@telemedsn.co.il
        </p>
      </article>

      {/* Footer */}
      <footer className="py-8 px-4 bg-gray-900 text-gray-400 text-center text-sm">
        <div className="max-w-6xl mx-auto flex flex-wrap justify-center gap-6 mb-4">
          <Link href="/terms" className="text-white font-medium">תנאי שימוש</Link>
          <Link href="/privacy" className="hover:text-white">מדיניות פרטיות</Link>
          <Link href="/accessibility" className="hover:text-white">נגישות</Link>
        </div>
        <p>&copy; {new Date().getFullYear()} טלמדיסן. כל הזכויות שמורות.</p>
      </footer>
    </div>
  )
}
