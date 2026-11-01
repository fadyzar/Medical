-- Migration 027: clinician review before an AI consultation summary reaches the patient.
--
-- Until now the AI summary was written to appointments.ai_summary, which the
-- patient can read (apt_patient_select), was emailed to the patient seconds
-- after the call, and its SOAP text was copied into the doctor's own empty
-- fields — so patient messages presented AI text as the doctor's assessment.
--
-- New lifecycle, one row per generated version:
--   draft → approved → released          (superseded when replaced)
-- * Drafts live in consultation_summaries. Patients have no access to it.
-- * Only the treating doctor can read it (RLS); every write goes through the
--   server (service role), which enforces the lifecycle and writes audit_logs.
-- * appointments.ai_summary now holds only the patient-facing text of the
--   released version; ai_summary_released_at says when it was released.
--
-- Existing AI summaries are preserved as version 1 with status
-- 'legacy_unreviewed' and removed from the patient-readable column. Doctor
-- fields that are an exact copy of the AI text (written by the old code) are
-- cleared and the cleared field names recorded on the legacy row.
-- Re-runnable.

create table if not exists public.consultation_summaries (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  appointment_id   uuid not null references public.appointments(id) on delete cascade,
  version          integer not null check (version > 0),
  status           text not null check (status in ('draft', 'approved', 'released', 'superseded', 'legacy_unreviewed')),
  -- exactly what the model returned (never edited)
  ai_output        jsonb,
  -- the current text: the AI draft, then the doctor's edits
  content          jsonb not null,
  -- which source categories went into the prompt, with counts (no clinical text)
  sources          jsonb not null default '{}'::jsonb,
  -- grounding check results: items whose quoted evidence was not found in the sources
  warnings         jsonb not null default '[]'::jsonb,
  model_used       text,
  input_tokens     integer,
  output_tokens    integer,
  generated_by     uuid references public.users(id) on delete set null,
  generated_at     timestamptz not null default now(),
  edited_by        uuid references public.users(id) on delete set null,
  edited_at        timestamptz,
  edit_count       integer not null default 0,
  approved_by      uuid references public.users(id) on delete set null,
  approved_at      timestamptz,
  released_by      uuid references public.users(id) on delete set null,
  released_at      timestamptz,
  superseded_at    timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (appointment_id, version),
  check (status <> 'approved' or (approved_by is not null and approved_at is not null)),
  check (status <> 'released' or (approved_at is not null and released_at is not null))
);

create index if not exists consultation_summaries_apt_idx on public.consultation_summaries (appointment_id, version desc);
create index if not exists consultation_summaries_org_idx on public.consultation_summaries (organization_id, status);

-- At most one live draft/approved version and one released version per appointment.
create unique index if not exists consultation_summaries_one_open
  on public.consultation_summaries (appointment_id) where status in ('draft', 'approved');
create unique index if not exists consultation_summaries_one_released
  on public.consultation_summaries (appointment_id) where status = 'released';

alter table public.consultation_summaries enable row level security;

drop policy if exists "cs_treating_doctor_select" on public.consultation_summaries;
create policy "cs_treating_doctor_select" on public.consultation_summaries for select using (
  exists (
    select 1 from public.appointments a
    where a.id = consultation_summaries.appointment_id
      and a.doctor_id = auth.uid()
      and a.organization_id = consultation_summaries.organization_id
  )
);
-- No insert/update/delete policies: only the server (service role) writes.

drop trigger if exists consultation_summaries_updated_at on public.consultation_summaries;
create or replace function public.consultation_summaries_touch() returns trigger
language plpgsql as $$ begin new.updated_at := now(); return new; end $$;
create trigger consultation_summaries_updated_at before update on public.consultation_summaries
  for each row execute function public.consultation_summaries_touch();

alter table public.appointments add column if not exists ai_summary_released_at timestamptz;

-- Doctors, staff and patients can update appointment rows from the browser
-- (apt_*_update). The released summary must only be set by the server's
-- release step, so browser sessions may not write these two columns.
create or replace function public.protect_released_summary() returns trigger
language plpgsql as $$
begin
  if coalesce(auth.role(), '') in ('authenticated', 'anon') and (
       (tg_op = 'INSERT' and (new.ai_summary is not null or new.ai_summary_released_at is not null))
    or (tg_op = 'UPDATE' and (new.ai_summary is distinct from old.ai_summary
                              or new.ai_summary_released_at is distinct from old.ai_summary_released_at))
  ) then
    raise exception 'ai_summary is released only through the clinician review workflow'
      using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists t_apt_protect_released_summary on public.appointments;
create trigger t_apt_protect_released_summary before insert or update on public.appointments
  for each row execute function public.protect_released_summary();

-- ── preserve existing AI summaries as unreviewed legacy versions ─────
do $$
declare
  r record;
  parsed jsonb;
  cleared text[];
begin
  for r in
    select a.id, a.organization_id, a.doctor_id, a.ai_summary, a.ai_summary_generated_at,
           a.subjective_notes, a.assessment, a.plan
    from public.appointments a
    where a.ai_summary is not null and a.ai_summary_released_at is null
      and not exists (select 1 from public.consultation_summaries s where s.appointment_id = a.id)
  loop
    begin
      parsed := regexp_replace(regexp_replace(btrim(r.ai_summary), '^```(json)?\s*', ''), '\s*```$', '')::jsonb;
    exception when others then
      parsed := null;
    end;

    cleared := '{}';
    if parsed is not null and jsonb_typeof(parsed -> 'soap') = 'object' then
      if r.subjective_notes is not null and r.subjective_notes = parsed #>> '{soap,subjective}' then
        update public.appointments set subjective_notes = null where id = r.id;
        cleared := cleared || 'subjective_notes'::text;
      end if;
      if r.assessment is not null and r.assessment = parsed #>> '{soap,assessment}' then
        update public.appointments set assessment = null where id = r.id;
        cleared := cleared || 'assessment'::text;
      end if;
      if r.plan is not null and r.plan = parsed #>> '{soap,plan}' then
        update public.appointments set plan = null where id = r.id;
        cleared := cleared || 'plan'::text;
      end if;
    end if;

    insert into public.consultation_summaries
      (organization_id, appointment_id, version, status, ai_output, content, sources, generated_by, generated_at)
    values
      (r.organization_id, r.id, 1, 'legacy_unreviewed',
       coalesce(parsed, jsonb_build_object('raw', r.ai_summary)),
       coalesce(parsed, jsonb_build_object('raw', r.ai_summary)),
       jsonb_build_object('legacy', true, 'cleared_doctor_fields', to_jsonb(cleared)),
       r.doctor_id, coalesce(r.ai_summary_generated_at, now()));

    update public.appointments set ai_summary = null where id = r.id;
  end loop;
end $$;

-- The prescription draft is AI text on a patient-readable row; the doctor
-- already gets it in the API response and it is kept in ai_conversations.
update public.appointments set ai_prescription_draft = null where ai_prescription_draft is not null;

comment on table public.consultation_summaries is
  'AI-assisted consultation summary versions. Draft → approved → released by the treating doctor. Patients never read this table; the released patient text is copied to appointments.ai_summary.';
