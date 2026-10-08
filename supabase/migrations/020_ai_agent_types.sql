-- Migration 020: record AI usage for every agent the app actually runs.
--
-- /api/ai-summary (action=brief) inserts agent_type 'brief' and /api/ai-document
-- inserts 'document_generator'. The CHECK constraint from 001 does not allow
-- either, so those inserts fail silently and the usage is never recorded —
-- AI briefs and generated documents are missing from billing and reports.
-- Additive and safe to run at any time.

alter table ai_conversations drop constraint if exists ai_conversations_agent_type_check;
alter table ai_conversations add constraint ai_conversations_agent_type_check
  check (agent_type in (
    'triage', 'intake', 'summary', 'prescription_draft', 'follow_up', 'general',
    'brief', 'document_generator'
  ));
