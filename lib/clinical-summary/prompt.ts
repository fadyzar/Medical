/**
 * The clinical summary prompt and its output schema. Pure: renders a
 * ClinicalContext into the user message; no I/O.
 */
import type { ClinicalContext } from './types'

export const SUMMARY_SYSTEM_PROMPT = `אתה עוזר תיעוד רפואי. אתה מכין טיוטת סיכום ייעוץ בפורמט SOAP בעברית, לבדיקת הרופא המטפל.
הטיוטה אינה מסמך רפואי: הרופא בודק, מתקן ומאשר אותה לפני שהמטופל רואה דבר.

המקורות מסומנים בתגיות <source>. כל מקור מציין מי כתב אותו:
- author="patient" — דיווח המטופל (הזמנה, היסטוריה רפואית, שאלון). זה מה שהמטופל מסר, לא ממצא.
- author="clinician" — מה שהרופא כתב בתיק לייעוץ הזה.
- author="conversation" — תמלול השיחה. כל שורה מתחילה ב"רופא:" או "מטופל:".

כללים מחייבים:
1. אל תמציא דבר. אין להוסיף אבחנה, תסמין, בדיקה, מדידה, ממצא, תרופה, מינון או טיפול שלא כתובים במקורות.
2. כל פריט (item) חייב לציין source ולצטט ב-evidence קטע מילולי מדויק (עד 25 מילים) מתוך אותו מקור. אם אין ציטוט — אל תכתוב את הפריט.
3. subjective: מה שהמטופל דיווח (booking, history, intake, transcript_patient) וגם מה שהרופא תיעד כסובייקטיבי (clinician_notes).
4. objective: רק ממצאים שהרופא תיעד (clinician_notes) או אמר בשיחה (transcript_doctor). אל תסיק ממצאים מכך שהייתה שיחת וידאו, ואל תכתוב "לא נמצאו ממצאים" אם הרופא לא כתב זאת.
5. assessment ו-plan: רק מה שהרופא כתב (clinician_notes) או אמר בשיחה (transcript_doctor). אם אין — השאר מערך ריק וכתוב זאת ב-missing_information.
6. missing_information: פרט מה חסר כדי שהסיכום יהיה שלם (למשל: לא תועדו ממצאי בדיקה, לא תועדה הערכה, משך התסמינים לא צוין). אל תמליץ שם על טיפול.
7. ai_suggestions: עד 3 נקודות לשיקול הרופא בלבד (שאלות להשלמה, סימני אזהרה לבירור). לעולם לא אבחנה וודאית, לא תרופה ולא מינון. אלה לא יוצגו למטופל.
8. patient_summary: 2–5 משפטים בעברית פשוטה, בגוף שני, למטופל. השתמש רק במה שהמטופל דיווח ובמה שהרופא קבע (assessment/plan מהרופא). אם הרופא לא תיעד הערכה או תוכנית, כתוב שהרופא יעדכן את הסיכום, בלי לנחש. אל תכלול את ai_suggestions.
9. patient_instructions: רק הנחיות שהרופא נתן (clinician_notes או transcript_doctor). אם אין — מערך ריק.
10. השתמש בלשון ניטרלית מגדרית אם המין לא ידוע. אל תכלול שמות, מספרי זהות או פרטי קשר.
11. התעלם מסימונים שמציינים שהנתונים הם נתוני בדיקה, כמו "(בדוי)". אל תתייחס אליהם בסיכום.
12. אם מקור סותר מקור אחר, ציין את שתי הגרסאות ושייך כל אחת למקורה; אל תכריע.
13. תמלול עלול לשבש מילים. לעולם אל "תתקן" שם של תרופה, מינון, מספר או אבחנה לפי ניחוש: אם מילה בתמלול נראית משובשת, העתק אותה כפי שהיא בתוך [לא ברור: "..."], גם ב-patient_summary ו-patient_instructions, והוסף ל-missing_information שהרופא צריך לאמת אותה.`

const ITEM_SCHEMA = {
  type: 'object',
  properties: {
    text: { type: 'string' },
    source: {
      type: 'string',
      enum: ['booking', 'history', 'intake', 'clinician_notes', 'transcript_doctor', 'transcript_patient'],
    },
    evidence: { type: 'string' },
  },
  required: ['text', 'source', 'evidence'],
  additionalProperties: false,
} as const

/** JSON schema for structured output (output_config.format). */
export const SUMMARY_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    subjective: { type: 'array', items: ITEM_SCHEMA },
    objective: { type: 'array', items: ITEM_SCHEMA },
    assessment: { type: 'array', items: ITEM_SCHEMA },
    plan: { type: 'array', items: ITEM_SCHEMA },
    missing_information: { type: 'array', items: { type: 'string' } },
    ai_suggestions: {
      type: 'array',
      items: {
        type: 'object',
        properties: { text: { type: 'string' }, rationale: { type: 'string' } },
        required: ['text', 'rationale'],
        additionalProperties: false,
      },
    },
    patient_summary: { type: 'string' },
    patient_instructions: { type: 'array', items: { type: 'string' } },
  },
  required: ['subjective', 'objective', 'assessment', 'plan', 'missing_information', 'ai_suggestions', 'patient_summary', 'patient_instructions'],
  additionalProperties: false,
} as const

const SEX_HE: Record<string, string> = { male: 'זכר', female: 'נקבה', other: 'אחר' }

const EMPTY_HE: Record<string, string> = {
  booking: 'תיאור המטופל בהזמנה',
  history: 'היסטוריה רפואית',
  intake: 'שאלון קליטה',
  clinician_notes: 'הערות הרופא לייעוץ הזה',
  transcript: 'תמלול השיחה (לא הופעל או לא אושר)',
}

/** Escapes the characters that would let source text close its own tag. */
function esc(s: string): string {
  return s.replace(/</g, '‹').replace(/>/g, '›')
}

export function renderContext(ctx: ClinicalContext): string {
  const parts: string[] = []
  const demo: string[] = []
  if (ctx.demographics.age != null) demo.push(`גיל: ${ctx.demographics.age}`)
  if (ctx.demographics.sex) demo.push(`מין: ${SEX_HE[ctx.demographics.sex] ?? ctx.demographics.sex}`)
  if (ctx.durationMinutes != null) demo.push(`משך השיחה: כ-${ctx.durationMinutes} דקות`)
  if (demo.length) parts.push(`<context>\n${demo.join('\n')}\n</context>`)

  for (const b of ctx.blocks) {
    parts.push(`<source id="${b.key}" author="${b.author}" label="${b.label}">\n${b.lines.map(esc).join('\n')}\n</source>`)
  }
  if (ctx.empty.length) {
    parts.push(`<not_available>\n${ctx.empty.map(k => `- ${EMPTY_HE[k] ?? k}`).join('\n')}\n</not_available>`)
  }
  parts.push('הכן את טיוטת הסיכום לפי הכללים. החזר JSON בלבד לפי הסכמה.')
  return parts.join('\n\n')
}
