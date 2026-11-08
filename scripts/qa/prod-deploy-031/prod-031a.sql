-- CANNA production: migration 031 step A (additive: invitation columns, single-clinic trigger,
-- acceptance/claim functions). Compatible with the code currently deployed. One transaction + integrity guard.
create temp table ck_before(t text primary key, h text, n bigint) on commit drop;
do $$ declare t text; begin
  for t in select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE' order by 1 loop
    execute format($q$insert into ck_before select %L, md5(coalesce(string_agg(x,'' order by x),'')), count(*) from
      (select md5((to_jsonb(r) - array['revoked_at','revoked_by','accepted_by','last_sent_at','send_count'])::text) x from public.%I r) s$q$, t, t);
  end loop; end $$;
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

do $$ declare h text; cnt bigint; b record; changed int := 0; begin
  for b in select * from ck_before loop
    execute format($q$select md5(coalesce(string_agg(x,'' order by x),'')), count(*) from
      (select md5((to_jsonb(r) - array['revoked_at','revoked_by','accepted_by','last_sent_at','send_count'])::text) x from public.%I r) s$q$, b.t) into h, cnt;
    if h <> b.h or cnt <> b.n then changed := changed + 1; raise warning 'table % changed', b.t; end if;
  end loop;
  if changed > 0 then raise exception 'integrity guard: % table(s) changed — aborting', changed; end if;
  raise notice 'integrity guard OK: % tables, % rows unchanged', (select count(*) from ck_before), (select sum(c.n) from ck_before c);
end $$;
select 'objects', (select count(*) from pg_proc where proname in ('accept_patient_invitation','claim_patient_clinic','transfer_patient_clinic','enforce_patient_single_clinic')) fns, (select count(*) from pg_trigger where tgname='t_patient_single_clinic') trg;
