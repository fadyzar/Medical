-- Migration 028: consented consultation transcripts (prototype).
--
-- Off by default. A transcript is captured only when
--   1. the clinic enabled it (organizations.settings.transcription_enabled),
--   2. the server has a transcription service configured, and
--   3. BOTH the doctor and the patient consented for this consultation.
-- Either side can withdraw; withdrawal stops capture and deletes the transcript.
-- Audio is transient: deleted as soon as it is transcribed (audio_deleted_at).
-- The transcript is clinical working material: only the treating doctor can
-- read it (RLS). All writes go through the server (service role). Re-runnable.

create table if not exists public.consultation_transcripts (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references public.organizations(id) on delete cascade,
  appointment_id        uuid not null unique references public.appointments(id) on delete cascade,
  status                text not null default 'consent_pending'
                        check (status in ('consent_pending', 'recording', 'processing', 'completed', 'failed', 'withdrawn')),
  consent_text_version  text not null,
  doctor_consent_at     timestamptz,
  patient_consent_at    timestamptz,
  withdrawn_at          timestamptz,
  withdrawn_by          uuid references public.users(id) on delete set null,
  provider              text,
  language              text,
  model                 text,
  -- [{ "speaker": "doctor"|"patient", "start": seconds, "end": seconds, "text": "..." }]
  segments              jsonb,
  duration_seconds      integer,
  audio_deleted_at      timestamptz,
  error                 text,
  retention_until       timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  check (status not in ('recording', 'processing', 'completed') or (doctor_consent_at is not null and patient_consent_at is not null)),
  check (status <> 'withdrawn' or segments is null)
);

create index if not exists consultation_transcripts_org_idx on public.consultation_transcripts (organization_id, status);

alter table public.consultation_transcripts enable row level security;

drop policy if exists "ct_treating_doctor_select" on public.consultation_transcripts;
create policy "ct_treating_doctor_select" on public.consultation_transcripts for select using (
  exists (
    select 1 from public.appointments a
    where a.id = consultation_transcripts.appointment_id
      and a.doctor_id = auth.uid()
      and a.organization_id = consultation_transcripts.organization_id
  )
);

create or replace function public.consultation_transcripts_touch() returns trigger
language plpgsql as $$ begin new.updated_at := now(); return new; end $$;
drop trigger if exists consultation_transcripts_updated_at on public.consultation_transcripts;
create trigger consultation_transcripts_updated_at before update on public.consultation_transcripts
  for each row execute function public.consultation_transcripts_touch();

comment on table public.consultation_transcripts is
  'Consented consultation transcripts (doctor + patient consent required). Audio deleted after transcription. Treating doctor read-only; server writes.';
