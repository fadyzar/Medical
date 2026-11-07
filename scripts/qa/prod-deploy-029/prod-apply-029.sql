-- CANNA production: migration 029 in one transaction with a data-integrity guard.
create temp table ck_before(t text primary key, h text, n bigint) on commit drop;
do $$ declare t text; begin
  for t in select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE' order by 1 loop
    execute format($q$insert into ck_before select %L, md5(coalesce(string_agg(x,'' order by x),'')), count(*) from
      (select md5(to_jsonb(r)::text) x from public.%I r) s$q$, t, t);
  end loop; end $$;
-- Migration 029: an appointment's doctor must belong to the appointment's clinic.
--
-- apt_patient_insert (002) checks only patient_id and organization_id, so a
-- patient of clinic A could insert an appointment in clinic A with a doctor_id
-- from clinic B; apt_patient_update has no WITH CHECK on doctor_id at all.
-- Enforce the invariant in the database, for every writer (browser, API routes
-- and the AI assistant alike).
--
-- Only checked when doctor_id or organization_id is being SET, so existing rows
-- are never re-validated and status/payment updates on them keep working.
-- No data is changed. Re-runnable. Rollback: supabase/rollback/029_down.sql.

create or replace function public.enforce_appointment_doctor_org()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.doctor_id is null then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and new.doctor_id is not distinct from old.doctor_id
     and new.organization_id is not distinct from old.organization_id then
    return new;
  end if;

  if not exists (
    select 1 from public.users u
    where u.id = new.doctor_id
      and u.organization_id = new.organization_id
  ) then
    raise exception 'appointment doctor must belong to the appointment organization'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists t_apt_doctor_same_org on public.appointments;
create trigger t_apt_doctor_same_org
  before insert or update of doctor_id, organization_id on public.appointments
  for each row execute function public.enforce_appointment_doctor_org();
do $$ declare h text; cnt bigint; b record; changed int := 0; begin
  for b in select * from ck_before loop
    execute format($q$select md5(coalesce(string_agg(x,'' order by x),'')), count(*) from
      (select md5(to_jsonb(r)::text) x from public.%I r) s$q$, b.t) into h, cnt;
    if h <> b.h or cnt <> b.n then changed := changed + 1; raise warning 'table % changed', b.t; end if;
  end loop;
  if changed > 0 then raise exception 'integrity guard: % table(s) changed — aborting', changed; end if;
  raise notice 'integrity guard OK: % tables, % rows unchanged', (select count(*) from ck_before), (select sum(c.n) from ck_before c);
end $$;
select 'trigger_installed', count(*) from pg_trigger where tgname='t_apt_doctor_same_org';
