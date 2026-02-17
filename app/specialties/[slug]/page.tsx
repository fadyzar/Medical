import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServiceRole } from '@/lib/supabase/server'
import { SPECIALTIES, formatPrice } from '@/lib/utils'

// ── Specialty SEO Content ────────────────────────────

type SpecialtyContent = {
  title: string
  metaDescription: string
  heroDescription: string
  aboutTitle: string
  aboutText: string
  commonConditions: string[]
  whenToConsult: string[]
  icon: string
  schemaSpecialty: string
}

const SPECIALTY_CONTENT: Record<string, SpecialtyContent> = {
  general: {
    title: 'רפואה כללית',
    metaDescription: 'ייעוץ רפואי כללי אונליין עם רופאים מומחים. קבל חוות דעת רפואית בוידאו מהבית — מהיר, מאובטח ונוח.',
    heroDescription: 'רופא משפחה זמין לך מכל מקום. ייעוץ רפואי כללי בשיחת וידאו — ללא תורים ארוכים, ללא המתנה.',
    aboutTitle: 'רפואה כללית אונליין',
    aboutText: 'רופא משפחה הוא הכתובת הראשונה לכל בעיה רפואית. בטלמדיסן, אתה יכול להתייעץ עם רופא כללי מומחה בשיחת וידאו — לקבל אבחנה, מרשם, הפניה לבדיקות או לרופא מומחה.',
    commonConditions: ['שפעת והצטננות', 'כאבי ראש', 'כאבי גרון', 'חום', 'כאבי בטן', 'בעיות שינה', 'עייפות כרונית', 'לחץ דם'],
    whenToConsult: ['כשאתה מרגיש לא טוב ולא בטוח מה הסיבה', 'כשאתה צריך חידוש מרשם', 'כשאתה צריך הפניה לרופא מומחה', 'כשאתה צריך אישור מחלה'],
    icon: '🏥',
    schemaSpecialty: 'GeneralPractice',
  },
  dermatology: {
    title: 'עור ומין',
    metaDescription: 'ייעוץ רופא עור אונליין — אבחון בעיות עור, פריחה, אקנה, שומות ועוד. רופא דרמטולוג בשיחת וידאו.',
    heroDescription: 'רופא עור מומחה בשיחת וידאו. שלח תמונה של הבעיה וקבל אבחנה מקצועית ותוכנית טיפול.',
    aboutTitle: 'דרמטולוגיה אונליין',
    aboutText: 'דרמטולוגיה היא אחת ההתמחויות המתאימות ביותר לטלרפואה. רופא העור יכול לבחון תמונות ולאבחן מגוון רחב של מצבים — מפריחה פשוטה ועד שומות חשודות.',
    commonConditions: ['אקנה', 'פסוריאזיס', 'אקזמה', 'פריחות עור', 'שומות חשודות', 'פטריות', 'דלקות עור', 'נשירת שיער'],
    whenToConsult: ['כשהופיעה פריחה חדשה או שינוי בעור', 'כשיש שומה שהשתנתה', 'כשאקנה לא מגיב לטיפול ביתי', 'כשיש גירוד מתמשך'],
    icon: '🔬',
    schemaSpecialty: 'Dermatology',
  },
  orthopedics: {
    title: 'אורתופדיה',
    metaDescription: 'ייעוץ אורתופד אונליין — כאבי גב, ברכיים, מפרקים, פציעות ספורט. רופא אורתופד בשיחת וידאו.',
    heroDescription: 'רופא אורתופד מומחה בשיחת וידאו. ייעוץ ראשוני, חוות דעת שנייה והכוונה לטיפול.',
    aboutTitle: 'אורתופדיה אונליין',
    aboutText: 'ייעוץ אורתופדי אונליין מאפשר לך לקבל הערכה ראשונית, חוות דעת שנייה על צילומי רנטגן או MRI, ותוכנית טיפול — ללא צורך להגיע פיזית למרפאה.',
    commonConditions: ['כאבי גב', 'כאבי ברכיים', 'כאבי כתף', 'פציעות ספורט', 'שחיקת מפרקים', 'תסמונת התעלה הקרפלית', 'בקע דיסק', 'שברים'],
    whenToConsult: ['כשיש כאב מתמשך בגב או במפרק', 'כשצריך חוות דעת על צילום רנטגן', 'אחרי פציעת ספורט', 'כשיש הגבלה בתנועה'],
    icon: '🦴',
    schemaSpecialty: 'Orthopedic',
  },
  cardiology: {
    title: 'קרדיולוגיה',
    metaDescription: 'ייעוץ קרדיולוג אונליין — בעיות לב, לחץ דם, כולסטרול, קוצר נשימה. רופא לב בשיחת וידאו.',
    heroDescription: 'קרדיולוג מומחה בשיחת וידאו. ייעוץ לגבי בריאות הלב, פענוח בדיקות ומעקב.',
    aboutTitle: 'קרדיולוגיה אונליין',
    aboutText: 'ייעוץ קרדיולוגי אונליין מאפשר מעקב שוטף, פענוח תוצאות בדיקות, התאמת טיפול תרופתי וחוות דעת שנייה — מהנוחות של הבית.',
    commonConditions: ['לחץ דם גבוה', 'כולסטרול גבוה', 'הפרעות קצב', 'קוצר נשימה', 'כאבים בחזה', 'אי ספיקת לב', 'מחלת לב כלילית', 'מומי לב'],
    whenToConsult: ['כשתוצאות בדיקת דם מראות כולסטרול גבוה', 'כשלחץ הדם לא מאוזן', 'כשיש קוצר נשימה במאמץ', 'כשצריך פענוח בדיקת מאמץ או הולטר'],
    icon: '❤️',
    schemaSpecialty: 'Cardiovascular',
  },
  ent: {
    title: 'אף אוזן גרון',
    metaDescription: 'ייעוץ רופא א.א.ג אונליין — כאבי אוזניים, סחרחורת, בעיות שמיעה, נחירות. רופא אף אוזן גרון בשיחת וידאו.',
    heroDescription: 'רופא א.א.ג מומחה בשיחת וידאו. ייעוץ לכאבי אוזניים, סחרחורת, נחירות ובעיות שמיעה.',
    aboutTitle: 'א.א.ג אונליין',
    aboutText: 'ייעוץ אונליין עם רופא אף אוזן גרון מאפשר הערכה ראשונית של תלונות נפוצות, המלצות טיפול והפנייה לבדיקות כשצריך.',
    commonConditions: ['דלקת אוזניים', 'סחרחורת', 'נחירות', 'דום נשימה בשינה', 'סינוסיטיס', 'טינטון', 'ירידה בשמיעה', 'כאבי גרון חוזרים'],
    whenToConsult: ['כשיש כאב אוזניים מתמשך', 'כשיש סחרחורת חוזרת', 'כשיש בעיית נחירות', 'כשיש ירידה בשמיעה'],
    icon: '👂',
    schemaSpecialty: 'Otolaryngology',
  },
  neurology: {
    title: 'נוירולוגיה',
    metaDescription: 'ייעוץ נוירולוג אונליין — כאבי ראש, מיגרנה, נימול, סחרחורת, בעיות זיכרון. רופא נוירולוג בשיחת וידאו.',
    heroDescription: 'נוירולוג מומחה בשיחת וידאו. ייעוץ לכאבי ראש, מיגרנות, נימול וסחרחורת.',
    aboutTitle: 'נוירולוגיה אונליין',
    aboutText: 'ייעוץ נוירולוגי אונליין מתאים למעקב שוטף, התאמת טיפול, חוות דעת שנייה ופענוח בדיקות הדמיה — ללא המתנה ארוכה.',
    commonConditions: ['מיגרנה', 'כאבי ראש כרוניים', 'נימול בידיים או ברגליים', 'סחרחורת', 'בעיות זיכרון', 'אפילפסיה', 'טרשת נפוצה', 'כאבי עצבים'],
    whenToConsult: ['כשיש כאבי ראש חדשים או שונים מהרגיל', 'כשיש נימול או חולשה', 'כשיש סחרחורת חוזרת', 'כשצריך פענוח MRI מוח'],
    icon: '🧠',
    schemaSpecialty: 'Neurologic',
  },
  gastro: {
    title: 'גסטרואנטרולוגיה',
    metaDescription: 'ייעוץ גסטרואנטרולוג אונליין — כאבי בטן, צרבת, בעיות עיכול, IBS. רופא גסטרו בשיחת וידאו.',
    heroDescription: 'גסטרואנטרולוג מומחה בשיחת וידאו. ייעוץ לבעיות עיכול, כאבי בטן וצרבת.',
    aboutTitle: 'גסטרואנטרולוגיה אונליין',
    aboutText: 'ייעוץ גסטרו אונליין מאפשר הערכה של בעיות עיכול, התאמת טיפול, פענוח תוצאות בדיקות ומעקב שוטף.',
    commonConditions: ['צרבת ורפלוקס', 'כאבי בטן', 'תסמונת המעי הרגיז (IBS)', 'עצירות', 'שלשולים', 'מחלת קרוהן', 'קוליטיס כיבית', 'בעיות כבד'],
    whenToConsult: ['כשיש כאבי בטן מתמשכים', 'כשיש צרבת שלא עוברת', 'כשיש שינוי בהרגלי היציאות', 'כשצריך פענוח תוצאות גסטרוסקופיה'],
    icon: '🫁',
    schemaSpecialty: 'Gastroenterologic',
  },
  urology: {
    title: 'אורולוגיה',
    metaDescription: 'ייעוץ אורולוג אונליין — בעיות במערכת השתן, דלקות, אבנים בכליות. רופא אורולוג בשיחת וידאו.',
    heroDescription: 'אורולוג מומחה בשיחת וידאו. ייעוץ לבעיות במערכת השתן בסביבה פרטית ונוחה.',
    aboutTitle: 'אורולוגיה אונליין',
    aboutText: 'ייעוץ אורולוגי אונליין מאפשר דיון פרטי ומקצועי בבעיות רגישות, ללא מבוכה — ישירות מהבית.',
    commonConditions: ['דלקות בדרכי השתן', 'אבנים בכליות', 'בעיות בערמונית', 'בריחת שתן', 'הפרעות בזקפה', 'דם בשתן', 'כאבים באזור המפשעה', 'בעיות פוריות'],
    whenToConsult: ['כשיש כאבים או צריבה בזמן מתן שתן', 'כשיש בעיות ערמונית', 'כשיש דם בשתן', 'כשצריך פענוח תוצאות בדיקות'],
    icon: '🔬',
    schemaSpecialty: 'Urologic',
  },
  gynecology: {
    title: 'גינקולוגיה',
    metaDescription: 'ייעוץ גינקולוג אונליין — בעיות מחזור, הריון, גיל המעבר, זיהומים. רופאת נשים בשיחת וידאו.',
    heroDescription: 'גינקולוגית מומחית בשיחת וידאו. ייעוץ פרטי ומקצועי בנושאי בריאות האישה.',
    aboutTitle: 'גינקולוגיה אונליין',
    aboutText: 'ייעוץ גינקולוגי אונליין מאפשר דיון פרטי ונוח בנושאי בריאות האישה — ללא מבוכה, ללא המתנה.',
    commonConditions: ['הפרעות במחזור', 'כאבי מחזור', 'זיהומים נרתיקיים', 'מעקב הריון', 'תסמיני גיל המעבר', 'אמצעי מניעה', 'כאבי אגן', 'בעיות פוריות'],
    whenToConsult: ['כשיש שינוי בדפוס המחזור', 'כשיש הפרשה חריגה', 'כשצריך ייעוץ לגבי אמצעי מניעה', 'כשיש תסמיני גיל המעבר'],
    icon: '👩‍⚕️',
    schemaSpecialty: 'Gynecologic',
  },
  ophthalmology: {
    title: 'רפואת עיניים',
    metaDescription: 'ייעוץ רופא עיניים אונליין — בעיות ראייה, עיניים יבשות, אדמומיות, גלאוקומה. רופא עיניים בשיחת וידאו.',
    heroDescription: 'רופא עיניים מומחה בשיחת וידאו. ייעוץ ראשוני, חוות דעת שנייה ומעקב.',
    aboutTitle: 'רפואת עיניים אונליין',
    aboutText: 'ייעוץ עיניים אונליין מתאים להערכה ראשונית, דיון בתוצאות בדיקות, מעקב אחרי טיפול וחוות דעת שנייה.',
    commonConditions: ['עיניים יבשות', 'אדמומיות בעין', 'טשטוש ראייה', 'גלאוקומה', 'קטרקט', 'דלקת עיניים', 'רגישות לאור', 'ציפי עיניים'],
    whenToConsult: ['כשיש שינוי פתאומי בראייה', 'כשיש אדמומיות או כאב בעין', 'כשצריך פענוח בדיקת עיניים', 'כשיש בעיית עיניים יבשות'],
    icon: '👁️',
    schemaSpecialty: 'Optometric',
  },
  psychiatry: {
    title: 'פסיכיאטריה',
    metaDescription: 'ייעוץ פסיכיאטר אונליין — חרדה, דיכאון, הפרעות שינה, ADHD. פסיכיאטר בשיחת וידאו.',
    heroDescription: 'פסיכיאטר מומחה בשיחת וידאו. ייעוץ פרטי ומקצועי בנושאי בריאות הנפש.',
    aboutTitle: 'פסיכיאטריה אונליין',
    aboutText: 'ייעוץ פסיכיאטרי אונליין מאפשר טיפול נפשי נגיש ופרטי. שוחח עם פסיכיאטר מומחה מהנוחות של הבית — ללא סטיגמה.',
    commonConditions: ['חרדה', 'דיכאון', 'הפרעות שינה', 'ADHD', 'הפרעות אכילה', 'OCD', 'הפרעה דו-קוטבית', 'התקפי פאניקה'],
    whenToConsult: ['כשמרגישים חרדה או דיכאון מתמשכים', 'כשיש בעיות שינה כרוניות', 'כשצריך התאמה או שינוי תרופתי', 'כשצריך אבחון ADHD'],
    icon: '🧠',
    schemaSpecialty: 'Psychiatric',
  },
  endocrinology: {
    title: 'אנדוקרינולוגיה',
    metaDescription: 'ייעוץ אנדוקרינולוג אונליין — סוכרת, בלוטת תריס, הורמונים. רופא אנדוקרינולוג בשיחת וידאו.',
    heroDescription: 'אנדוקרינולוג מומחה בשיחת וידאו. ייעוץ וניהול סוכרת, תריס והפרעות הורמונליות.',
    aboutTitle: 'אנדוקרינולוגיה אונליין',
    aboutText: 'ייעוץ אנדוקרינולוגי אונליין מתאים למעקב סוכרת, בעיות תריס, הפרעות הורמונליות ופענוח תוצאות בדיקות דם.',
    commonConditions: ['סוכרת סוג 1 ו-2', 'תת/יתר פעילות תריס', 'הפרעות הורמונליות', 'אוסטאופורוזיס', 'תסמונת השחלות הפוליציסטיות', 'בעיות בלוטת יותרת הכליה', 'עודף משקל הורמונלי', 'גדילה והתבגרות'],
    whenToConsult: ['כשסוכרת לא מאוזנת', 'כשיש שינוי בתפקודי התריס', 'כשצריך פענוח תוצאות הורמונליות', 'כשיש עודף משקל שלא מגיב לדיאטה'],
    icon: '⚕️',
    schemaSpecialty: 'Endocrine',
  },
  pulmonology: {
    title: 'רפואת ריאות',
    metaDescription: 'ייעוץ רופא ריאות אונליין — אסתמה, קוצר נשימה, שיעול כרוני, COPD. רופא ריאות בשיחת וידאו.',
    heroDescription: 'רופא ריאות מומחה בשיחת וידאו. ייעוץ לאסתמה, קוצר נשימה ובעיות נשימה.',
    aboutTitle: 'רפואת ריאות אונליין',
    aboutText: 'ייעוץ ריאות אונליין מתאים למעקב אסתמה, COPD, שיעול כרוני ופענוח בדיקות תפקודי ריאות.',
    commonConditions: ['אסתמה', 'COPD', 'שיעול כרוני', 'קוצר נשימה', 'דלקת ריאות', 'דום נשימה בשינה', 'ברונכיטיס', 'אלרגיות נשימתיות'],
    whenToConsult: ['כשיש שיעול שלא עובר', 'כשיש קוצר נשימה', 'כשאסתמה לא מאוזנת', 'כשצריך פענוח בדיקת ספירומטריה'],
    icon: '🫁',
    schemaSpecialty: 'Pulmonary',
  },
  pediatrics: {
    title: 'רפואת ילדים',
    metaDescription: 'ייעוץ רופא ילדים אונליין — חום, שיעול, פריחה, בעיות התנהגות. רופא ילדים בשיחת וידאו.',
    heroDescription: 'רופא ילדים מומחה בשיחת וידאו. ייעוץ מהיר ומקצועי כשהילד לא מרגיש טוב.',
    aboutTitle: 'רפואת ילדים אונליין',
    aboutText: 'ייעוץ ילדים אונליין מאפשר להתייעץ עם רופא ילדים מהבית — במיוחד שימושי כשהילד חולה ויש קושי להגיע למרפאה.',
    commonConditions: ['חום גבוה', 'שיעול והצטננות', 'דלקות אוזניים', 'פריחות עור', 'כאבי בטן', 'בעיות אכילה', 'בעיות שינה', 'בעיות התנהגות'],
    whenToConsult: ['כשלילד יש חום ואתה לא בטוח מה לעשות', 'כשיש פריחה חדשה', 'כשיש שיעול שלא עובר', 'כשצריך ייעוץ לגבי חיסונים'],
    icon: '👶',
    schemaSpecialty: 'Pediatric',
  },
  pain: {
    title: 'רפואת כאב',
    metaDescription: 'ייעוץ רופא כאב אונליין — כאב כרוני, פיברומיאלגיה, כאבי עצבים. מומחה כאב בשיחת וידאו.',
    heroDescription: 'מומחה כאב בשיחת וידאו. ייעוץ מקצועי לניהול כאב כרוני ושיפור איכות החיים.',
    aboutTitle: 'רפואת כאב אונליין',
    aboutText: 'ייעוץ כאב אונליין מאפשר הערכה מקצועית של כאב כרוני, התאמת טיפול תרופתי ותכנית ניהול כאב מותאמת אישית.',
    commonConditions: ['כאב כרוני', 'פיברומיאלגיה', 'כאבי עצבים (נוירופתיה)', 'כאבי גב כרוניים', 'כאבי ראש כרוניים', 'כאב אחרי ניתוח', 'כאב סרטני', 'כאב מפרקים'],
    whenToConsult: ['כשיש כאב שלא עובר עם טיפול רגיל', 'כשצריך התאמת טיפול תרופתי לכאב', 'כשכאב פוגע באיכות החיים', 'כשצריך חוות דעת שנייה'],
    icon: '💊',
    schemaSpecialty: 'PainMedicine',
  },
  oncology: {
    title: 'אונקולוגיה',
    metaDescription: 'ייעוץ אונקולוג אונליין — חוות דעת שנייה, מעקב אחרי טיפול, פענוח בדיקות. אונקולוג בשיחת וידאו.',
    heroDescription: 'אונקולוג מומחה בשיחת וידאו. חוות דעת שנייה, מעקב ופענוח תוצאות בדיקות.',
    aboutTitle: 'אונקולוגיה אונליין',
    aboutText: 'ייעוץ אונקולוגי אונליין מאפשר חוות דעת שנייה, דיון באפשרויות טיפול, מעקב אחרי טיפולים ופענוח תוצאות — בנוחות ובפרטיות.',
    commonConditions: ['חוות דעת שנייה', 'מעקב אחרי טיפול', 'פענוח ביופסיה', 'תופעות לוואי של טיפולים', 'שאלות לגבי אפשרויות טיפול', 'בדיקות סקר', 'מעקב תקופתי', 'תמיכה ושיקום'],
    whenToConsult: ['כשצריך חוות דעת שנייה', 'כשיש תופעות לוואי של טיפול', 'כשצריך פענוח תוצאות בדיקות', 'כשרוצים לדון באפשרויות טיפול'],
    icon: '🔬',
    schemaSpecialty: 'Oncologic',
  },
}

// ── Static Params ────────────────────────────────────

export function generateStaticParams() {
  return SPECIALTIES.map(s => ({ slug: s.id }))
}

// ── Metadata ─────────────────────────────────────────

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://your-domain.co.il'

export function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  return params.then(({ slug }) => {
    const content = SPECIALTY_CONTENT[slug]
    if (!content) return { title: 'התמחות לא נמצאה' }

    return {
      title: `${content.title} — ייעוץ אונליין`,
      description: content.metaDescription,
      keywords: [content.title, 'ייעוץ אונליין', 'רופא אונליין', 'טלמדיסן', 'שיחת וידאו'],
      openGraph: {
        title: `${content.title} — ייעוץ רפואי אונליין | טלמדיסן`,
        description: content.metaDescription,
        type: 'website',
        locale: 'he_IL',
        url: `${BASE_URL}/specialties/${slug}`,
      },
      alternates: { canonical: `${BASE_URL}/specialties/${slug}` },
    }
  })
}

// ── Page Component ───────────────────────────────────

export default async function SpecialtyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const content = SPECIALTY_CONTENT[slug]
  const specialty = SPECIALTIES.find(s => s.id === slug)

  if (!content || !specialty) notFound()

  // Fetch doctors for this specialty (SSR)
  const supabase = createServiceRole()
  const { data: doctors } = await supabase.from('users')
    .select('id, first_name, last_name, specialties, bio, consultation_price, average_rating, total_ratings, avatar_url, languages')
    .eq('role', 'doctor')
    .eq('is_active', true)
    .contains('specialties', [slug])
    .order('average_rating', { ascending: false, nullsFirst: false })
    .limit(12)

  const typedDoctors = (doctors || []) as unknown as Array<{
    id: string; first_name: string; last_name: string
    specialties: string[] | null; bio: string | null
    consultation_price: number | null; average_rating: number | null
    total_ratings: number; avatar_url: string | null; languages: string[]
  }>

  // Schema.org JSON-LD
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'MedicalWebPage',
    name: `${content.title} — ייעוץ אונליין`,
    description: content.metaDescription,
    url: `${BASE_URL}/specialties/${slug}`,
    inLanguage: 'he',
    specialty: {
      '@type': 'MedicalSpecialty',
      name: content.schemaSpecialty,
    },
    provider: {
      '@type': 'MedicalClinic',
      name: 'טלמדיסן',
      availableService: {
        '@type': 'MedicalProcedure',
        name: `ייעוץ ${content.title} בוידאו`,
        procedureType: 'http://schema.org/NoninvasiveProcedure',
      },
      areaServed: { '@type': 'Country', name: 'Israel' },
    },
    ...(typedDoctors.length > 0 && {
      mentions: typedDoctors.slice(0, 5).map(doc => ({
        '@type': 'Physician',
        name: `ד"ר ${doc.first_name} ${doc.last_name}`,
        medicalSpecialty: content.schemaSpecialty,
      })),
    }),
  }

  return (
    <div className="min-h-screen bg-white" dir="rtl">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="text-2xl font-black text-blue-600">טלמדיסן</Link>
          <div className="flex items-center gap-4">
            <Link href="/doctors" className="text-sm text-gray-600 hover:text-gray-900">הרופאים שלנו</Link>
            <Link href="/blog" className="text-sm text-gray-600 hover:text-gray-900">בלוג</Link>
            <Link href="/auth/login" className="text-sm text-gray-600 hover:text-gray-900">התחברות</Link>
            <Link href="/auth/register" className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">הרשמה חינם</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="py-16 px-4 bg-gradient-to-b from-blue-50 to-white">
        <div className="max-w-4xl mx-auto text-center">
          <div className="text-6xl mb-6">{content.icon}</div>
          <h1 className="text-4xl md:text-5xl font-black text-gray-900 mb-4">
            {content.title}
            <br />
            <span className="text-blue-600">ייעוץ אונליין</span>
          </h1>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto">{content.heroDescription}</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
            <Link href="/auth/register" className="bg-blue-600 text-white px-8 py-4 rounded-xl text-lg font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/25">
              קבע תור עכשיו
            </Link>
            <Link href="/doctors" className="border-2 border-gray-300 text-gray-700 px-8 py-4 rounded-xl text-lg font-bold hover:border-gray-400 transition-colors">
              ראה רופאים זמינים
            </Link>
          </div>
        </div>
      </section>

      {/* About */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-black mb-6">{content.aboutTitle}</h2>
          <p className="text-gray-600 text-lg leading-relaxed">{content.aboutText}</p>
        </div>
      </section>

      {/* Common Conditions */}
      <section className="py-16 px-4 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-black mb-8 text-center">מצבים נפוצים</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {content.commonConditions.map(condition => (
              <div key={condition} className="bg-white rounded-xl p-4 text-center border border-gray-100 shadow-sm">
                <p className="font-medium text-gray-800">{condition}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* When to consult */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-black mb-8 text-center">מתי כדאי להתייעץ?</h2>
          <div className="space-y-4 max-w-2xl mx-auto">
            {content.whenToConsult.map((item, i) => (
              <div key={i} className="flex items-start gap-3 bg-blue-50 rounded-xl p-4">
                <span className="text-blue-600 font-bold text-lg mt-0.5">✓</span>
                <p className="text-gray-700">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Doctors for this specialty */}
      {typedDoctors.length > 0 && (
        <section className="py-16 px-4 bg-gray-50">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-black mb-8 text-center">הרופאים שלנו ב{content.title}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {typedDoctors.map(doc => (
                <div key={doc.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center text-xl font-bold text-blue-700 shrink-0">
                      {doc.first_name.charAt(0)}{doc.last_name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">ד&quot;ר {doc.first_name} {doc.last_name}</h3>
                      <p className="text-sm text-gray-500">{content.title}</p>
                    </div>
                  </div>
                  {doc.bio && <p className="text-sm text-gray-600 mb-4 line-clamp-2">{doc.bio}</p>}
                  <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                    <div className="flex items-center gap-3">
                      {doc.average_rating && (
                        <span className="text-sm text-yellow-700 bg-yellow-50 px-2 py-1 rounded-lg font-medium">
                          ⭐ {doc.average_rating.toFixed(1)} ({doc.total_ratings})
                        </span>
                      )}
                    </div>
                    {doc.consultation_price && (
                      <span className="text-sm font-bold text-green-700">{formatPrice(doc.consultation_price)}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="text-center mt-8">
              <Link href="/auth/register" className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-blue-700 transition-colors inline-block">
                קבע תור עכשיו
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* How it works */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-black text-center mb-12">איך זה עובד?</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {[
              { num: '1', title: 'הרשמה', desc: 'צור חשבון חינם תוך דקה' },
              { num: '2', title: 'תאר את הבעיה', desc: 'ספר מה מטריד אותך והעלה מסמכים' },
              { num: '3', title: 'בחר רופא', desc: `בחר ${content.title === 'רפואה כללית' ? 'רופא כללי' : `רופא ${content.title}`} ושלם` },
              { num: '4', title: 'ייעוץ בוידאו', desc: 'שוחח עם הרופא בשיחת וידאו' },
            ].map(s => (
              <div key={s.num} className="text-center">
                <div className="w-12 h-12 rounded-full bg-blue-600 text-white text-xl font-bold flex items-center justify-center mx-auto">{s.num}</div>
                <h3 className="font-bold mt-3">{s.title}</h3>
                <p className="text-gray-500 text-sm mt-1">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* All specialties */}
      <section className="py-16 px-4 bg-gray-50">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl font-black mb-6">כל ההתמחויות</h2>
          <div className="flex flex-wrap justify-center gap-3">
            {SPECIALTIES.map(s => (
              <Link key={s.id} href={`/specialties/${s.id}`}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  s.id === slug
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 border border-gray-200 hover:border-blue-400 hover:text-blue-600'
                }`}>
                {s.label}
              </Link>
            ))}
          </div>
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
