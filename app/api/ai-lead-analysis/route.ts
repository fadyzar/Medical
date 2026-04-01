import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceRole } from '@/lib/supabase/server'
import { orchestrate } from '@/lib/ai/orchestrator'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const admin = createServiceRole()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase.from('users')
      .select('role, organization_id')
      .eq('id', user.id).single()

    if (!profile || !['admin', 'staff'].includes(profile.role)) {
      return NextResponse.json({ error: 'גישה נדחית' }, { status: 403 })
    }

    const { leadId } = await req.json()
    if (!leadId) return NextResponse.json({ error: 'leadId נדרש' }, { status: 400 })

    const orgId = (profile as unknown as { organization_id: string }).organization_id

    const { data: lead, error: leadErr } = await admin
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .eq('organization_id', orgId)
      .single()

    if (leadErr || !lead) return NextResponse.json({ error: 'ליד לא נמצא' }, { status: 404 })

    const result = await orchestrate(
      'lead_analysis',
      {
        userId: user.id,
        organizationId: orgId,
        role: profile.role as 'admin' | 'staff',
        payload: {
          firstName: lead.first_name,
          lastName: lead.last_name,
          source: lead.source,
          specialtyInterest: lead.specialty_interest,
          message: lead.message,
        },
      },
      `נתח ליד: ${lead.first_name} ${lead.last_name}, מקור: ${lead.source}${lead.specialty_interest ? `, מעוניין ב: ${lead.specialty_interest}` : ''}${lead.message ? `, הודעה: ${lead.message}` : ''}`,
      { maxTokens: 500 }
    )

    if (!result.success) {
      return NextResponse.json({ error: result.output }, { status: 500 })
    }

    // Parse score from output
    const scoreMatch = result.output.match(/ציון[:\s]+(\d+)/i) || result.output.match(/(\d+)\s*\/\s*10/)
    const score = scoreMatch ? Math.min(10, Math.max(1, parseInt(scoreMatch[1]))) : 5

    // Split analysis from recommendations (rough parse)
    const lines = result.output.split('\n').filter(Boolean)
    const analysis = lines.slice(0, Math.ceil(lines.length * 0.6)).join('\n')
    const recommendations = lines.slice(Math.ceil(lines.length * 0.6)).join('\n')

    // Save to AI conversations
    await admin.from('ai_conversations').insert({
      organization_id: orgId,
      user_id: user.id,
      agent_type: 'lead_analysis',
      messages: [{ role: 'user', content: `lead ${leadId}` }],
      result: { score, preview: result.output.substring(0, 100) },
      is_complete: true,
      input_tokens: result.tokensUsed.input,
      output_tokens: result.tokensUsed.output,
      model_used: result.modelUsed,
    })

    return NextResponse.json({ score, analysis, recommendations, full: result.output })
  } catch (err) {
    console.error('[ai-lead-analysis]', err)
    return NextResponse.json({ error: 'שגיאה בניתוח' }, { status: 500 })
  }
}
