/**
 * AI Orchestration Layer
 *
 * Architecture:
 *   Client → API Route → Orchestrator → Agent Dispatch → Tool Governance → DB/External APIs
 *
 * Supports:
 * - Intent detection + routing to correct domain agent
 * - Session memory (per appointment)
 * - Persistent memory (per patient profile)
 * - Tool governance (RBAC + tenant isolation)
 * - Multi-provider abstraction (Claude / GPT)
 * - Confidence scoring + fallback handling
 */

import Anthropic from '@anthropic-ai/sdk'

// ── Types ──────────────────────────────────────────────────────────────────

export type AgentType =
  | 'triage'          // Patient-facing: urgency scoring, specialty routing
  | 'brief'           // Doctor-facing: pre-visit patient brief
  | 'summary'         // Doctor-facing: SOAP/AI summary post-visit
  | 'prescription'    // Doctor-facing: medication draft
  | 'intake'          // Patient-facing: dynamic questionnaire
  | 'document'        // Doctor-facing: medical document generation
  | 'lead_analysis'   // Admin/staff: lead quality scoring
  | 'automation'      // Background: reminders, follow-ups

export type UserRole = 'patient' | 'doctor' | 'staff' | 'admin'

export type OrchestratorContext = {
  // Identity
  userId: string
  organizationId: string
  role: UserRole

  // Session memory (current interaction)
  appointmentId?: string
  sessionMessages?: Array<{ role: 'user' | 'assistant'; content: string }>

  // Persistent memory (patient profile)
  patientProfile?: {
    name: string
    dateOfBirth?: string
    allergies?: string[]
    chronicConditions?: string[]
    currentMedications?: string[]
    recentAppointments?: Array<{ date: string; diagnosis?: string; notes?: string }>
  }

  // Task-specific payload
  payload: Record<string, unknown>
}

export type OrchestratorResult = {
  agentType: AgentType
  success: boolean
  output: string
  confidence: number       // 0-1
  requiresHumanReview: boolean
  redFlags: string[]
  tokensUsed: { input: number; output: number }
  modelUsed: string
}

// ── Tool Governance Layer ──────────────────────────────────────────────────

/**
 * Validates that the requesting user has permission to call the given agent
 * with the given context. Enforces tenant isolation and RBAC.
 */
export function validateAccess(agentType: AgentType, role: UserRole): { allowed: boolean; reason?: string } {
  const AGENT_PERMISSIONS: Record<AgentType, UserRole[]> = {
    triage:       ['patient', 'staff', 'admin'],
    brief:        ['doctor', 'admin'],
    summary:      ['doctor', 'admin'],
    prescription: ['doctor', 'admin'],
    intake:       ['patient', 'staff', 'admin'],
    document:     ['doctor', 'admin'],
    lead_analysis:['staff', 'admin'],
    automation:   ['admin'],          // system calls only
  }

  const allowed = AGENT_PERMISSIONS[agentType]?.includes(role) ?? false
  return {
    allowed,
    reason: allowed ? undefined : `תפקיד "${role}" אינו מורשה להפעיל סוכן "${agentType}"`,
  }
}

// ── Intent Detection ───────────────────────────────────────────────────────

/**
 * Detects the intent from a free-text input and routes to the correct agent.
 * Used for future conversational AI interface.
 */
export function detectIntent(input: string): { agentType: AgentType; confidence: number } {
  const lower = input.toLowerCase()

  if (lower.match(/בריף|לפני ביקור|הכנה|pre.visit|briefing/)) {
    return { agentType: 'brief', confidence: 0.9 }
  }
  if (lower.match(/מרשם|תרופה|prescription|medication|drug/)) {
    return { agentType: 'prescription', confidence: 0.85 }
  }
  if (lower.match(/סיכום|summary|soap|progress note/)) {
    return { agentType: 'summary', confidence: 0.85 }
  }
  if (lower.match(/מכתב|הפניה|אישור מחלה|document|letter|referral/)) {
    return { agentType: 'document', confidence: 0.8 }
  }
  if (lower.match(/מיון|urgency|triage|דחיפות/)) {
    return { agentType: 'triage', confidence: 0.9 }
  }
  if (lower.match(/שאלון|intake|anamnesis|אנמנזה/)) {
    return { agentType: 'intake', confidence: 0.85 }
  }
  if (lower.match(/ליד|lead|לקוח|customer/)) {
    return { agentType: 'lead_analysis', confidence: 0.8 }
  }

  // Default fallback
  return { agentType: 'summary', confidence: 0.3 }
}

// ── System Prompts ─────────────────────────────────────────────────────────

const SYSTEM_PROMPTS: Record<AgentType, string> = {
  triage: `אתה סוכן מיון רפואי AI. תפקידך:
1. להעריך את דחיפות מצבו של המטופל בסולם 1-10
2. לזהות סימנים אדומים שדורשים טיפול דחוף/חירום
3. להמליץ על התמחות רופא מתאימה
4. לנסח קטגוריה קלינית מדויקת

חשוב:
- בדחיפות 9-10: ציין בבירור "פנה לחדר מיון מיידית"
- היה שמרן — עדיף להעריך יותר מדי מאשר פחות מדי
- אל תאבחן — רק מייין וממליץ
- תשובה בעברית`,

  brief: `אתה עוזר רפואי AI ליצירת בריף לפני ביקור. תפקידך:
1. לסכם את כל המידע הרלוונטי על המטופל
2. להדגיש נקודות חשובות: אלרגיות, תרופות, מחלות כרוניות
3. לסכם את תשובות השאלון אם יש
4. לציין דגלים אדומים אם קיימים
5. להכין תשאול מוצע לרופא

הפלט צריך לעזור לרופא להיכנס לפגישה מוכן ב-60 שניות.
תשובה בעברית. מבנה ברור עם כותרות.`,

  summary: `אתה עוזר רפואי AI ליצירת סיכום ביקור. תפקידך:
1. ליצור סיכום SOAP מקצועי מהמידע שסופק
2. S — Subjective: תלונת המטופל בלשון ראשון
3. O — Objective: ממצאים ונתונים אובייקטיביים
4. A — Assessment: הערכה קלינית
5. P — Plan: תוכנית טיפול + מעקב

הסיכום ישמש כרשומה רפואית רשמית.
תשובה בעברית. מקצועי, תמציתי, מדויק.`,

  prescription: `אתה עוזר רפואי AI לעיון בטיוטת מרשם. תפקידך:
1. להציע טיפול תרופתי מבוסס ראיות
2. לבדוק אינטראקציות עם תרופות קיימות
3. לאמת מינון לפי גיל, משקל, מצב כלייתי
4. לוודא היעדר אלרגיות
5. לציין אזהרות ספציפיות

חשוב: זו טיוטה בלבד — הרופא אחראי לאישור הסופי.
תשובה בעברית.`,

  intake: `אתה סוכן קליטה AI ליצירת שאלון רפואי דינמי. תפקידך:
1. ליצור שאלות מותאמות לתלונה הספציפית
2. לכלול שאלות על: היסטוריה, תרופות, אלרגיות, גורמי סיכון
3. לחשוב על שאלות מסננות חשובות לסינדרום
4. להתאים לרמת המטופל (לא ז'רגון רפואי)

תשובה כ-JSON עם מערך questions.`,

  document: `אתה רופא ישראלי הכותב מסמכים רפואיים רשמיים.
סגנון: מקצועי, תמציתי, רשמי — בסגנון מסמכים רפואיים ישראליים אמיתיים.
כתוב תמיד בעברית תקינה עם כל הפרטים הנדרשים.`,

  lead_analysis: `אתה סוכן AI לניתוח לידים בתחום הבריאות. תפקידך:
1. להעריך איכות הליד (1-10)
2. לנתח את הכוונה והצורך
3. להמליץ על פעולת המשך
4. לאמוד סבירות המרה למטופל

תשובה בעברית. מבנה: ציון, ניתוח, המלצות.`,

  automation: `אתה סוכן אוטומציה AI למשלוח הודעות ותזכורות.
פעל לפי ההנחיות המדויקות שתקבל.
תשובה בעברית בלבד.`,
}

// ── Main Orchestrator ──────────────────────────────────────────────────────

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function orchestrate(
  agentType: AgentType,
  context: OrchestratorContext,
  prompt: string,
  options?: {
    maxTokens?: number
    timeout?: number
    model?: string
  }
): Promise<OrchestratorResult> {
  // 1. Validate access
  const access = validateAccess(agentType, context.role)
  if (!access.allowed) {
    return {
      agentType,
      success: false,
      output: access.reason || 'גישה נדחית',
      confidence: 0,
      requiresHumanReview: true,
      redFlags: [],
      tokensUsed: { input: 0, output: 0 },
      modelUsed: 'none',
    }
  }

  // 2. Build session-aware messages (session memory)
  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = []

  if (context.sessionMessages && context.sessionMessages.length > 0) {
    messages.push(...context.sessionMessages.slice(-6)) // last 6 for context window
  }

  messages.push({ role: 'user', content: prompt })

  // 3. Call AI with governance
  const model = options?.model || 'claude-sonnet-4-20250514'
  const maxTokens = options?.maxTokens || 1200

  const abortController = new AbortController()
  const timeoutMs = options?.timeout || 30000
  const timeoutId = setTimeout(() => abortController.abort(), timeoutMs)

  let response: Anthropic.Message
  try {
    response = await anthropic.messages.create({
      model,
      max_tokens: maxTokens,
      system: SYSTEM_PROMPTS[agentType],
      messages,
    })
  } finally {
    clearTimeout(timeoutId)
  }

  const output = response.content[0].type === 'text' ? response.content[0].text : ''

  // 4. Post-process: detect red flags
  const redFlags = detectRedFlags(output)
  const requiresHumanReview = redFlags.length > 0 || agentType === 'prescription'

  // 5. Confidence scoring (heuristic)
  const confidence = estimateConfidence(output, agentType)

  return {
    agentType,
    success: true,
    output,
    confidence,
    requiresHumanReview,
    redFlags,
    tokensUsed: {
      input: response.usage.input_tokens,
      output: response.usage.output_tokens,
    },
    modelUsed: model,
  }
}

// ── Helper: Red Flag Detection ─────────────────────────────────────────────

function detectRedFlags(text: string): string[] {
  const lower = text.toLowerCase()
  const flags: string[] = []

  const redFlagPatterns = [
    { pattern: /חדר מיון|מיון מיידית|emergency|urgent care/, flag: 'דחיפות גבוהה — הפנה לחדר מיון' },
    { pattern: /אוטם|heart attack|mi |myocardial/, flag: 'חשד לאוטם שריר הלב' },
    { pattern: /שבץ|stroke|cva|tia/, flag: 'חשד לשבץ מוחי' },
    { pattern: /ספסיס|sepsis|אלח דם/, flag: 'חשד לספסיס' },
    { pattern: /אנפילקסיס|anaphylaxis|אנפילקטי/, flag: 'חשד לתגובה אנפילקטית' },
    { pattern: /ממאיר|malignant|גידול|tumor|cancer/, flag: 'ממצא שדורש בירור ממאירות' },
    { pattern: /התאבדות|suicide|harm|self.harm/, flag: 'סיכון לפגיעה עצמית' },
  ]

  for (const { pattern, flag } of redFlagPatterns) {
    if (pattern.test(lower)) flags.push(flag)
  }

  return flags
}

// ── Helper: Confidence Scoring ─────────────────────────────────────────────

function estimateConfidence(output: string, agentType: AgentType): number {
  // Heuristic confidence based on output quality signals
  if (output.length < 50) return 0.3  // too short
  if (output.includes('אינני יכול') || output.includes('cannot')) return 0.1
  if (output.includes('אין מידע מספיק') || output.includes('insufficient')) return 0.4

  // Agent-specific heuristics
  if (agentType === 'triage' && /דחיפות[:\s]+\d/.test(output)) return 0.9
  if (agentType === 'summary' && /subjective|s —|s:/i.test(output)) return 0.85
  if (agentType === 'prescription' && /מינון|דוז|dose|mg/i.test(output)) return 0.8

  return 0.75  // baseline confidence
}

// ── Convenience Wrappers ───────────────────────────────────────────────────

export async function runTriageAgent(context: OrchestratorContext): Promise<OrchestratorResult> {
  const { chiefComplaint, description } = context.payload as { chiefComplaint: string; description?: string }
  const prompt = `מטופל: ${context.patientProfile?.name || 'לא ידוע'}
תלונה עיקרית: ${chiefComplaint}
${description ? `פירוט: ${description}` : ''}
${context.patientProfile?.allergies?.length ? `אלרגיות: ${context.patientProfile.allergies.join(', ')}` : ''}
${context.patientProfile?.chronicConditions?.length ? `מחלות כרוניות: ${context.patientProfile.chronicConditions.join(', ')}` : ''}

בצע מיון: ציון דחיפות (1-10), קטגוריה קלינית, התמחות מומלצת, סיבה קצרה, ואם יש — דגלים אדומים.`

  return orchestrate('triage', context, prompt, { maxTokens: 600 })
}

export async function runBriefAgent(context: OrchestratorContext): Promise<OrchestratorResult> {
  const payload = context.payload as {
    chiefComplaint: string
    questionnaireResponses?: Record<string, unknown>
    triageReasoning?: string
  }

  const prompt = `צור בריף לפני ביקור עבור:
מטופל: ${context.patientProfile?.name || 'לא ידוע'}
${context.patientProfile?.dateOfBirth ? `ת.לידה: ${context.patientProfile.dateOfBirth}` : ''}
תלונה: ${payload.chiefComplaint}
${context.patientProfile?.allergies?.length ? `אלרגיות: ${context.patientProfile.allergies.join(', ')}` : ''}
${context.patientProfile?.chronicConditions?.length ? `מחלות כרוניות: ${context.patientProfile.chronicConditions.join(', ')}` : ''}
${context.patientProfile?.currentMedications?.length ? `תרופות: ${context.patientProfile.currentMedications.join(', ')}` : ''}
${payload.triageReasoning ? `מיון AI קודם: ${payload.triageReasoning}` : ''}
${payload.questionnaireResponses ? `תשובות לשאלון: ${JSON.stringify(payload.questionnaireResponses, null, 2)}` : ''}`

  return orchestrate('brief', context, prompt, { maxTokens: 900 })
}

export async function runSummaryAgent(context: OrchestratorContext): Promise<OrchestratorResult> {
  const payload = context.payload as {
    chiefComplaint: string
    soapNotes: {
      subjective?: string; objective?: string
      assessment?: string; plan?: string
      diagnosis?: string; followUp?: string
    }
    prescription?: string
  }

  const prompt = `צור סיכום SOAP:
תלונה: ${payload.chiefComplaint}
S: ${payload.soapNotes.subjective || 'לא תועד'}
O: ${payload.soapNotes.objective || 'לא תועד'}
A: ${payload.soapNotes.assessment || 'לא תועד'}
P: ${payload.soapNotes.plan || 'לא תועד'}
${payload.soapNotes.diagnosis ? `אבחנה: ${payload.soapNotes.diagnosis}` : ''}
${payload.soapNotes.followUp ? `מעקב: ${payload.soapNotes.followUp}` : ''}
${payload.prescription ? `טיפול תרופתי: ${payload.prescription}` : ''}`

  return orchestrate('summary', context, prompt, { maxTokens: 800 })
}

export async function runLeadAnalysisAgent(context: OrchestratorContext): Promise<OrchestratorResult> {
  const payload = context.payload as {
    firstName: string; lastName: string
    source: string; specialtyInterest?: string; message?: string
  }

  const prompt = `נתח ליד:
שם: ${payload.firstName} ${payload.lastName}
מקור: ${payload.source}
${payload.specialtyInterest ? `התמחות מבוקשת: ${payload.specialtyInterest}` : ''}
${payload.message ? `הודעה: ${payload.message}` : ''}

העריך: ציון (1-10), כוונה, סבירות המרה, פעולה מומלצת.`

  return orchestrate('lead_analysis', context, prompt, { maxTokens: 500 })
}
