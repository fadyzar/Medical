-- Migration 033: doctor approval, server-managed payment state, release of
-- rejected slots.
--
-- Problems this closes (found in production acceptance, Nov 2026):
--  * apt_patient_update (002) has no WITH CHECK, so a patient could PATCH their
--    own appointment through the REST API to payment_status = 'completed',
--    status = 'scheduled', or a different payment_amount (the webhook compared
--    the paid sum against that patient-written amount).
--  * Nothing required the doctor to approve a booking before the consultation.
--
-- What changes:
--  1. New columns: approval / rejection bookkeeping, how payment is collected
--     (online | clinic | none), the appointment's timezone.
--  2. t_apt_guard_client_writes: browser sessions (roles authenticated/anon)
--     can no longer write payment, approval or refund fields, cannot move an
--     appointment into or out of the approval lifecycle, and patients cannot
--     change status, time or doctor directly (they use the API routes). On
--     insert the price is taken from the doctor's profile, not from the client.
--     Server code (service_role) and SQL (postgres) are not affected.
--  3. approve_appointment / reject_appointment: the only way to confirm or
--     reject. Row lock + per-doctor advisory lock + overlap check, so two
--     approvals cannot double-book and a second click is a no-op. Executable
--     by service_role only; the API route resolves the caller first and the
--     function re-checks the caller's role and clinic.
--  4. appointments_doctor_slot_unique is rebuilt so a rejected booking frees
--     its slot.
--
-- Existing rows: no status, payment or time is changed. New columns are NULL
-- except timezone, which gets the default 'Asia/Jerusalem' (the only timezone
-- the product has ever used). Re-runnable. Rollback: supabase/rollback/033_down.sql.

-- ── 1. columns ───────────────────────────────────────────────────────────────
alter table public.appointments add column if not exists approved_at        timestamptz;
alter table public.appointments add column if not exists approved_by        uuid references public.users(id) on delete set null;
alter table public.appointments add column if not exists rejected_at        timestamptz;
alter table public.appointments add column if not exists rejected_by        uuid references public.users(id) on delete set null;
alter table public.appointments add column if not exists rejection_reason   text;
alter table public.appointments add column if not exists payment_collection text;
alter table public.appointments add column if not exists refund_requested_at timestamptz;
alter table public.appointments add column if not exists timezone           text not null default 'Asia/Jerusalem';

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'appointments_payment_collection_check') then
    alter table public.appointments add constraint appointments_payment_collection_check
      check (payment_collection is null or payment_collection in ('online', 'clinic', 'none'));
  end if;
end $$;

comment on column public.appointments.payment_collection is
  'How this booking is paid: online (verified by the payment provider before approval), clinic (settled with the clinic; no online charge), none (free). NULL = booked before migration 033 or not yet submitted.';

create index if not exists appointments_doctor_pending_approval
  on public.appointments (doctor_id, scheduled_at) where status = 'pending_approval';

-- ── 2. Hebrew status labels (used by the automatic status audit, 021) ───────
create or replace function public.appointment_status_he(s text) returns text
language sql immutable as $$
  select case s
    when 'draft' then 'טיוטה' when 'pending' then 'ממתין' when 'doctor_confirmed' then 'אושר ע"י הרופא'
    when 'time_selected' then 'נבחר מועד' when 'payment_pending' then 'ממתין לתשלום' when 'paid' then 'שולם'
    when 'scheduled' then 'מתוזמן' when 'ready' then 'מוכן' when 'in_progress' then 'בתהליך'
    when 'completed' then 'הושלם' when 'cancelled_patient' then 'בוטל ע"י המטופל'
    when 'cancelled_doctor' then 'בוטל ע"י המרפאה' when 'no_show_patient' then 'המטופל לא הגיע'
    when 'no_show_doctor' then 'הרופא לא הגיע'
    when 'pending_approval' then 'ממתין לאישור הרופא' when 'confirmed' then 'מאושר'
    when 'rejected' then 'נדחה ע"י הרופא'
    else s end
$$;

-- ── 3. guard browser writes ──────────────────────────────────────────────────
create or replace function public.guard_appointment_client_writes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
begin
  -- Only browser sessions are restricted. The API routes use service_role and
  -- enforce their own rules; migrations and support SQL run as postgres.
  -- (Inside this SECURITY DEFINER function current_user is the owner; the
  -- caller's role, as set by PostgREST with SET ROLE, is the 'role' setting.)
  if coalesce(current_setting('role', true), 'none') not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.status is distinct from 'pending' and new.status is distinct from 'draft' then
      raise exception 'new appointments start as pending' using errcode = '42501';
    end if;
    if new.scheduled_at is not null and new.scheduled_at < now() then
      raise exception 'cannot book a time in the past' using errcode = '22023';
    end if;
    -- Payment and approval state is the server's. The price is the doctor's.
    new.payment_status := null;
    new.payment_transaction_id := null;
    new.payment_completed_at := null;
    new.payment_method := null;
    new.payment_idempotency_key := null;
    new.payment_collection := null;
    new.approved_at := null;  new.approved_by := null;
    new.rejected_at := null;  new.rejected_by := null;  new.rejection_reason := null;
    new.refund_status := null; new.refund_requested_at := null;
    new.payment_amount := case when new.doctor_id is null then null else
      (select u.consultation_price from public.users u where u.id = new.doctor_id and u.role = 'doctor') end;
    return new;
  end if;

  -- UPDATE
  if new.payment_status          is distinct from old.payment_status
     or new.payment_amount          is distinct from old.payment_amount
     or new.payment_transaction_id  is distinct from old.payment_transaction_id
     or new.payment_completed_at    is distinct from old.payment_completed_at
     or new.payment_method          is distinct from old.payment_method
     or new.payment_idempotency_key is distinct from old.payment_idempotency_key
     or new.payment_collection      is distinct from old.payment_collection
     or new.approved_at  is distinct from old.approved_at
     or new.approved_by  is distinct from old.approved_by
     or new.rejected_at  is distinct from old.rejected_at
     or new.rejected_by  is distinct from old.rejected_by
     or new.rejection_reason is distinct from old.rejection_reason
     or new.refund_status    is distinct from old.refund_status
     or new.refund_requested_at is distinct from old.refund_requested_at
     or new.timezone     is distinct from old.timezone
  then
    raise exception 'payment and approval fields are managed by the server' using errcode = '42501';
  end if;

  -- Patients change their bookings only through the API (cancel, reschedule
  -- request, proposal answer), never by writing status/time/doctor directly.
  if v_caller is not null and v_caller = old.patient_id and v_caller is distinct from old.doctor_id then
    if new.status is distinct from old.status
       or new.scheduled_at is distinct from old.scheduled_at
       or new.doctor_id is distinct from old.doctor_id
       or new.duration_minutes is distinct from old.duration_minutes
       or new.organization_id is distinct from old.organization_id then
      raise exception 'patients change appointments through the booking service' using errcode = '42501';
    end if;
  end if;

  if new.status is distinct from old.status then
    -- Entering or leaving the approval lifecycle is server-only. The single
    -- browser transition allowed is the doctor's client starting a confirmed
    -- consultation (confirmed -> in_progress).
    if new.status in ('pending_approval', 'confirmed', 'rejected', 'payment_pending') then
      raise exception 'status % is set by the server', new.status using errcode = '42501';
    end if;
    if old.status in ('pending_approval', 'payment_pending', 'rejected') then
      raise exception 'status % is changed by the server', old.status using errcode = '42501';
    end if;
    if old.status = 'confirmed' and new.status is distinct from 'in_progress' then
      raise exception 'a confirmed appointment is changed through the booking service' using errcode = '42501';
    end if;
  end if;

  if old.status in ('pending_approval', 'payment_pending', 'confirmed', 'rejected')
     and (new.scheduled_at is distinct from old.scheduled_at
          or new.doctor_id is distinct from old.doctor_id
          or new.duration_minutes is distinct from old.duration_minutes
          or new.organization_id is distinct from old.organization_id) then
    raise exception 'time and doctor are changed through the booking service' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists t_apt_guard_client_writes on public.appointments;
create trigger t_apt_guard_client_writes
  before insert or update on public.appointments
  for each row execute function public.guard_appointment_client_writes();

-- ── 4. approve / reject (server only) ────────────────────────────────────────
-- Statuses that occupy a doctor's time for the overlap check on approval.
create or replace function public.appointment_holds_doctor_time(s public.appointment_status)
returns boolean language sql immutable as $$
  select s in ('confirmed', 'in_progress', 'scheduled', 'ready', 'paid')
$$;

create or replace function public.approve_appointment(
  p_appointment uuid, p_actor uuid, p_duration_minutes int default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  a public.appointments%rowtype;
  v_role public.user_role;
  v_org uuid;
  v_duration int;
  v_conflict uuid;
begin
  select * into a from public.appointments where id = p_appointment for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  select u.role, u.organization_id into v_role, v_org from public.users u where u.id = p_actor;
  if not ((v_role = 'doctor' and a.doctor_id = p_actor)
          or (v_role = 'admin' and v_org is not null and v_org = a.organization_id)) then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;

  if a.status = 'confirmed' then
    return jsonb_build_object('ok', false, 'code', 'already_confirmed');
  end if;
  if a.status <> 'pending_approval' then
    return jsonb_build_object('ok', false, 'code', 'invalid_status', 'status', a.status);
  end if;
  if a.doctor_id is null then
    return jsonb_build_object('ok', false, 'code', 'no_doctor');
  end if;
  if a.scheduled_at is null then
    return jsonb_build_object('ok', false, 'code', 'no_time');
  end if;
  if a.payment_collection is null then
    return jsonb_build_object('ok', false, 'code', 'not_submitted');
  end if;
  if a.payment_collection = 'online' and a.payment_status is distinct from 'completed' then
    return jsonb_build_object('ok', false, 'code', 'payment_not_verified');
  end if;

  v_duration := coalesce(p_duration_minutes, a.duration_minutes, 30);
  if v_duration < 5 or v_duration > 240 then
    return jsonb_build_object('ok', false, 'code', 'invalid_duration');
  end if;
  if a.scheduled_at + make_interval(mins => v_duration) <= now() then
    return jsonb_build_object('ok', false, 'code', 'time_passed');
  end if;

  -- Serialise approvals per doctor, then look for an overlapping booking that
  -- already holds the doctor's time. A second statement sees rows committed
  -- by an approval that held the lock before us.
  perform pg_advisory_xact_lock(hashtextextended('appointment-doctor:' || a.doctor_id::text, 0));

  select o.id into v_conflict
  from public.appointments o
  where o.doctor_id = a.doctor_id
    and o.id <> a.id
    and o.scheduled_at is not null
    and public.appointment_holds_doctor_time(o.status)
    and tstzrange(o.scheduled_at, o.scheduled_at + make_interval(mins => coalesce(o.duration_minutes, 30)))
        && tstzrange(a.scheduled_at, a.scheduled_at + make_interval(mins => v_duration))
  limit 1;
  if v_conflict is not null then
    return jsonb_build_object('ok', false, 'code', 'conflict');
  end if;

  update public.appointments
     set status = 'confirmed',
         approved_at = now(),
         approved_by = p_actor,
         doctor_accepted_at = coalesce(doctor_accepted_at, now()),
         duration_minutes = v_duration
   where id = a.id;

  insert into public.audit_logs (organization_id, user_id, action, resource_type, resource_id, description, metadata)
  values (a.organization_id, p_actor, 'APPOINTMENT_APPROVED', 'appointment', a.id,
          'התור אושר ע"י ' || case when v_role = 'doctor' then 'הרופא' else 'מנהל המרפאה' end,
          jsonb_build_object('by_role', v_role, 'scheduled_at', a.scheduled_at, 'duration_minutes', v_duration,
                             'payment_collection', a.payment_collection, 'payment_status', a.payment_status));

  return jsonb_build_object('ok', true, 'status', 'confirmed');
end;
$$;

create or replace function public.reject_appointment(
  p_appointment uuid, p_actor uuid, p_reason text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  a public.appointments%rowtype;
  v_role public.user_role;
  v_org uuid;
  v_refund boolean;
begin
  select * into a from public.appointments where id = p_appointment for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  select u.role, u.organization_id into v_role, v_org from public.users u where u.id = p_actor;
  if not ((v_role = 'doctor' and a.doctor_id = p_actor)
          or (v_role = 'admin' and v_org is not null and v_org = a.organization_id)) then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;

  if a.status = 'rejected' then
    return jsonb_build_object('ok', false, 'code', 'already_rejected');
  end if;
  if a.status <> 'pending_approval' then
    return jsonb_build_object('ok', false, 'code', 'invalid_status', 'status', a.status);
  end if;

  v_refund := coalesce(a.payment_status = 'completed', false);

  update public.appointments
     set status = 'rejected',
         rejected_at = now(),
         rejected_by = p_actor,
         rejection_reason = nullif(left(trim(coalesce(p_reason, '')), 500), ''),
         refund_status = case when v_refund then 'pending' else refund_status end,
         refund_requested_at = case when v_refund then now() else refund_requested_at end
   where id = a.id;

  insert into public.audit_logs (organization_id, user_id, action, resource_type, resource_id, description, metadata)
  values (a.organization_id, p_actor, 'APPOINTMENT_REJECTED', 'appointment', a.id,
          'בקשת התור נדחתה ע"י ' || case when v_role = 'doctor' then 'הרופא' else 'מנהל המרפאה' end,
          jsonb_build_object('by_role', v_role, 'scheduled_at', a.scheduled_at,
                             'payment_status', a.payment_status, 'refund_required', v_refund));

  return jsonb_build_object('ok', true, 'status', 'rejected', 'refund_required', v_refund);
end;
$$;

revoke all on function public.approve_appointment(uuid, uuid, int) from public, anon, authenticated;
revoke all on function public.reject_appointment(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.approve_appointment(uuid, uuid, int) to service_role;
grant execute on function public.reject_appointment(uuid, uuid, text) to service_role;
revoke all on function public.guard_appointment_client_writes() from public, anon, authenticated;

-- ── 5. a rejected booking releases its slot ──────────────────────────────────
drop index if exists public.appointments_doctor_slot_unique;
create unique index appointments_doctor_slot_unique
  on public.appointments (doctor_id, scheduled_at)
  where scheduled_at is not null
    and doctor_id is not null
    and status not in (
      'draft', 'cancelled_patient', 'cancelled_doctor',
      'no_show_patient', 'no_show_doctor', 'completed', 'rejected'
    );
