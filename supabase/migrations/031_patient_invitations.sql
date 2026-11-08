-- Migration 031: clinic-controlled patient invitations + single-clinic membership.
--
-- Product rule: a patient belongs to at most ONE clinic at a time. Membership is
-- users.organization_id; the placeholder org 0000…0001 (and NULL) means "not in
-- a clinic yet" (marketplace patient).
--
--   1. invitations: revoke / accept / resend bookkeeping, and at most one live
--      patient invitation per clinic + email.
--   2. t_patient_single_clinic: a patient who already belongs to a clinic can
--      never be moved to another clinic (or detached) by any writer — browser,
--      API route, AI assistant or a race between two of them — except through
--      transfer_patient_clinic(), the support-only approved transfer path.
--   3. accept_patient_invitation(): the only way a patient invitation is
--      accepted. One transaction, row locks on the invitation and on the
--      patient, so replay and two clinics' invitations accepted at the same
--      moment are both safe.
--   4. handle_new_user(): self-service signups no longer take organization_id
--      from browser-supplied signup metadata. A patient joins a clinic only via
--      an invitation, the clinic's own site (server-side, host-derived) or
--      booking one of its doctors.
--
-- No existing row is changed: existing memberships, invitations and medical
-- records stay exactly as they are. Re-runnable.
-- Rollback: supabase/rollback/031_down.sql.

-- ── 1. invitations bookkeeping ──────────────────────────────────────────────
alter table public.invitations add column if not exists revoked_at   timestamptz;
alter table public.invitations add column if not exists revoked_by   uuid references public.users(id) on delete set null;
alter table public.invitations add column if not exists accepted_by  uuid references public.users(id) on delete set null;
alter table public.invitations add column if not exists last_sent_at timestamptz;
alter table public.invitations add column if not exists send_count   integer;

-- One live (not accepted, not revoked) patient invitation per clinic + email.
-- Expired ones are refreshed in place by the server (new token, new expiry).
create unique index if not exists invitations_one_live_patient
  on public.invitations (organization_id, lower(email))
  where role = 'patient' and used_at is null and revoked_at is null;

-- ── 2. single-clinic membership ─────────────────────────────────────────────
create or replace function public.enforce_patient_single_clinic()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.role = 'patient'
     and new.role = 'patient'
     and old.organization_id is not null
     and old.organization_id <> '00000000-0000-0000-0000-000000000001'
     and new.organization_id is distinct from old.organization_id
     and coalesce(current_setting('canna.approved_patient_transfer', true), '') <> new.id::text
  then
    raise exception 'patient already belongs to a clinic'
      using errcode = '23514', hint = 'patient_in_other_clinic';
  end if;
  return new;
end;
$$;

drop trigger if exists t_patient_single_clinic on public.users;
create trigger t_patient_single_clinic
  before update of organization_id, role on public.users
  for each row execute function public.enforce_patient_single_clinic();

-- Approved transfer path (support only: not executable by any API role).
create or replace function public.transfer_patient_clinic(
  p_patient uuid, p_to_org uuid, p_actor uuid, p_reason text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_from uuid;
begin
  if coalesce(length(trim(p_reason)), 0) < 5 then
    raise exception 'a transfer reason is required';
  end if;
  select organization_id into v_from from users where id = p_patient and role = 'patient' for update;
  if not found then raise exception 'patient not found'; end if;
  if not exists (select 1 from organizations where id = p_to_org) then raise exception 'clinic not found'; end if;

  perform set_config('canna.approved_patient_transfer', p_patient::text, true);
  update users set organization_id = p_to_org where id = p_patient;
  perform set_config('canna.approved_patient_transfer', '', true);

  insert into audit_logs (organization_id, user_id, action, resource_type, resource_id, description, metadata)
  values (p_to_org, p_actor, 'patient_transferred', 'user', p_patient,
          'העברת מטופל בין מרפאות (תהליך מאושר)', jsonb_build_object('reason', p_reason));
end;
$$;
revoke all on function public.transfer_patient_clinic(uuid, uuid, uuid, text) from public, anon, authenticated, service_role;

-- ── 3. atomic acceptance ────────────────────────────────────────────────────
-- Outcomes: joined | already_member | other_clinic | not_found | revoked |
-- used | expired | email_mismatch | email_unverified | not_patient | no_profile
create or replace function public.accept_patient_invitation(p_token uuid, p_user uuid)
returns table (outcome text, organization_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  inv   public.invitations%rowtype;
  au    record;
  me    record;
begin
  select * into inv from public.invitations i where i.token = p_token and i.role = 'patient' for update;
  if not found then return query select 'not_found'::text, null::uuid; return; end if;

  if inv.revoked_at is not null then return query select 'revoked'::text, null::uuid; return; end if;
  if inv.used_at is not null then
    if inv.accepted_by = p_user then return query select 'already_member'::text, inv.organization_id; return; end if;
    return query select 'used'::text, null::uuid; return;
  end if;
  if inv.expires_at <= now() then return query select 'expired'::text, null::uuid; return; end if;

  select a.email, a.email_confirmed_at into au from auth.users a where a.id = p_user;
  if not found or lower(au.email) is distinct from lower(inv.email) then
    return query select 'email_mismatch'::text, null::uuid; return;
  end if;
  if au.email_confirmed_at is null then return query select 'email_unverified'::text, null::uuid; return; end if;

  -- Serialises every membership decision for this patient (two clinics'
  -- invitations accepted at once: the second waits here, then sees the first).
  select u.role, u.organization_id into me from public.users u where u.id = p_user for update;
  if not found then return query select 'no_profile'::text, null::uuid; return; end if;
  if me.role <> 'patient' then return query select 'not_patient'::text, null::uuid; return; end if;

  if me.organization_id = inv.organization_id then
    update public.invitations set used_at = now(), accepted_by = p_user where id = inv.id;
    insert into audit_logs (organization_id, user_id, action, resource_type, resource_id, description, metadata)
    values (inv.organization_id, p_user, 'patient_invite_accepted', 'invitation', inv.id,
            'מטופל אישר הזמנה (כבר חבר במרפאה)', jsonb_build_object('already_member', true));
    return query select 'already_member'::text, inv.organization_id; return;
  end if;

  if me.organization_id is not null and me.organization_id <> '00000000-0000-0000-0000-000000000001' then
    -- Not recorded in either clinic's audit log: that would tell one clinic
    -- about the patient's membership in another.
    return query select 'other_clinic'::text, null::uuid; return;
  end if;

  update public.users set organization_id = inv.organization_id where id = p_user;
  update public.invitations set used_at = now(), accepted_by = p_user where id = inv.id;
  insert into audit_logs (organization_id, user_id, action, resource_type, resource_id, description, metadata)
  values (inv.organization_id, p_user, 'patient_invite_accepted', 'invitation', inv.id,
          'מטופל הצטרף למרפאה מהזמנה', jsonb_build_object('invited_by', inv.invited_by));
  return query select 'joined'::text, inv.organization_id;
end;
$$;
revoke all on function public.accept_patient_invitation(uuid, uuid) from public, anon, authenticated;
grant execute on function public.accept_patient_invitation(uuid, uuid) to service_role;

-- Host-derived clinic signup (the server passes the clinic of the request host).
-- Outcomes: joined | already_member | other_clinic | not_patient | no_profile
create or replace function public.claim_patient_clinic(p_user uuid, p_org uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  me record;
begin
  select u.role, u.organization_id into me from public.users u where u.id = p_user for update;
  if not found then return 'no_profile'; end if;
  if me.role <> 'patient' then return 'not_patient'; end if;
  if me.organization_id = p_org then return 'already_member'; end if;
  if me.organization_id is not null and me.organization_id <> '00000000-0000-0000-0000-000000000001' then
    return 'other_clinic';
  end if;
  update public.users set organization_id = p_org where id = p_user;
  insert into audit_logs (organization_id, user_id, action, resource_type, resource_id, description)
  values (p_org, p_user, 'patient_joined_clinic', 'user', p_user, 'מטופל הצטרף למרפאה');
  return 'joined';
end;
$$;
revoke all on function public.claim_patient_clinic(uuid, uuid) from public, anon, authenticated;
grant execute on function public.claim_patient_clinic(uuid, uuid) to service_role;

-- ── 4. signup never trusts browser-supplied organization_id ─────────────────
create or replace function public.handle_new_user() returns trigger as $$
declare
  v_org_id uuid;
  v_first  text;
  v_last   text;
begin
  v_first := coalesce(new.raw_user_meta_data->>'first_name', split_part(new.email, '@', 1), '');
  v_last  := coalesce(new.raw_user_meta_data->>'last_name', '');

  -- Everyone starts outside any clinic (the placeholder org). Clinic membership
  -- is granted server-side only: invitation, the clinic's own site, or booking.
  select id into v_org_id from organizations where id = '00000000-0000-0000-0000-000000000001';

  begin
    insert into public.users (id, organization_id, email, first_name, last_name, role)
    values (new.id, v_org_id, new.email, v_first, v_last, 'patient')
    on conflict (id) do nothing;
  exception when others then
    raise warning 'handle_new_user failed for %: %', new.id, sqlerrm;
  end;

  return new;
end;
$$ language plpgsql security definer set search_path = public;
