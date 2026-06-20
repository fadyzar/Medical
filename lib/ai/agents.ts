// CHECKLIST: No PHI in console.log, try/catch on all, timeout configured
import Anthropic from '@anthropic-ai/sdk'

let _client: Anthropic | null = null
function getAI() {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY!, timeout: 30_000 })
  return _client
}

export interface AIResult {
  success: boolean
  content: string
  parsed?: Record<string, unknown>
  tokens?: { input: number; output: number }
}

async function callClaude(system: string, user: string, maxTokens = 2048): Promise<AIResult> {
  try {
    const res = await getAI().messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      temperature: 0.3,
      system,
      messages: [{ role: 'user', content: user }],
    })
    const text = res.content.find(b => b.type === 'text')?.text || ''
    let parsed: Record<string, unknown> | undefined
    try { parsed = JSON.parse(text) } catch { /* not JSON */ }
    return { success: true, content: text, parsed, tokens: { input: res.usage.input_tokens, output: res.usage.output_tokens } }
  } catch (err: unknown) {
    // CHECKLIST: No PHI logged
    const message = err instanceof Error ? err.message : 'AI call failed'
    console.error('[AI Agent Error]', message)
    return { success: false, content: message }
  }
}

// ---- TRIAGE ----
export async function triageAgent(input: { complaint: string; description?: string; age?: number; gender?: string }) {
  return callClaude(
    `אתה סוכן מיון רפואי במערכת CANNA ישראלית. ענה JSON בלבד:
{"urgency_score":<1-10>,"category":"<קטגוריה>","recommended_specialty":"<התמחות>","reasoning":"<הסבר בעברית>","red_flags":[],"suggested_questions":[]}
1-3=לא דחוף, 4-6=בינוני, 7-8=דחוף, 9-10=חירום`,
    `תלונה: ${input.complaint}${input.description ? `\nתיאור: ${input.description}` : ''}${input.age ? `\nגיל: ${input.age}` : ''}`,
    1024
  )
}

// ---- SUMMARY ----
export async function summaryAgent(input: { complaint: string; notes?: string; assessment?: string; plan?: string; duration?: number }) {
  return callClaude(
    `אתה מסכם ייעוצים רפואיים בפורמט SOAP. ענה JSON בלבד:
{"summary":"<סיכום>","soap":{"subjective":"","objective":"","assessment":"","plan":""},"key_findings":[],"follow_up":[],"icd_suggestions":[]}`,
    `תלונה: ${input.complaint}${input.notes ? `\nהערות רופא: ${input.notes}` : ''}${input.assessment ? `\nהערכה: ${input.assessment}` : ''}${input.plan ? `\nתוכנית: ${input.plan}` : ''}`,
    3000
  )
}

// ---- PRESCRIPTION DRAFT ----
export async function prescriptionAgent(input: { diagnosis: string; age?: number; allergies?: string[]; medications?: string[] }) {
  return callClaude(
    `אתה עוזר לרופאים לנסח טיוטת מרשם. ענה JSON:
{"medications":[{"name":"","dosage":"","frequency":"","duration":"","notes":""}],"warnings":[],"interactions":"","disclaimer":"טיוטה בלבד - נדרש אישור רופא"}
בדוק אלרגיות ואינטראקציות!`,
    `אבחנה: ${input.diagnosis}${input.age ? `\nגיל: ${input.age}` : ''}${input.allergies?.length ? `\nאלרגיות: ${input.allergies.join(', ')}` : ''}${input.medications?.length ? `\nתרופות נוכחיות: ${input.medications.join(', ')}` : ''}`,
    2000
  )
}

// ---- INTAKE QUESTIONS ----
export async function intakeAgent(input: { complaint: string; specialty?: string; previousAnswers?: Record<string, string> }) {
  return callClaude(
    `אתה יוצר שאלון קליטה דינמי. ענה JSON:
{"questions":[{"id":"","text":"<שאלה בעברית>","type":"text|choice|scale|yes_no","options":[],"required":true}],"is_complete":false,"notes":""}
שאל 3-5 שאלות, שפה פשוטה.`,
    `תלונה: ${input.complaint}${input.specialty ? `\nהתמחות: ${input.specialty}` : ''}${input.previousAnswers ? `\nתשובות קודמות: ${JSON.stringify(input.previousAnswers)}` : ''}`,
    1500
  )
}
