-- Rollback for 027_consultation_summary_review + 028_consultation_transcripts.
-- Run in one transaction (psql --single-transaction). Restores the pre-027 schema.
--
-- What is lost on rollback: everything created after 027 in the new tables
-- (summary drafts, versions, approvals, transcripts) and the release timestamp.
-- Released summaries stay readable in appointments.ai_summary.
-- Not reversible by design: 027 nulled appointments.ai_prescription_draft and moved
-- unreviewed legacy ai_summary values into consultation_summaries; take a backup of
-- consultation_summaries first if legacy rows must be put back
-- (status = 'legacy_unreviewed', content -> appointments.ai_summary).

-- 028
drop table if exists public.consultation_transcripts;
drop function if exists public.consultation_transcripts_touch();

-- 027
drop trigger if exists t_apt_protect_released_summary on public.appointments;
drop function if exists public.protect_released_summary();
drop table if exists public.consultation_summaries;
drop function if exists public.consultation_summaries_touch();
alter table public.appointments drop column if exists ai_summary_released_at;
