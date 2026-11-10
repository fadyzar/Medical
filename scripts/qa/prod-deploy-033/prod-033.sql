-- CANNA production: migration 033 in ONE transaction with an integrity guard:
-- every public table is checksummed before and after (ignoring only the columns
-- 033 adds); any other difference aborts and rolls everything back.
-- Run: psql --single-transaction -v ON_ERROR_STOP=1 -f prod-033.sql
create temp table ck_before(t text primary key, h text, n bigint) on commit drop;
do $$ declare t text; begin
  for t in select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE' order by 1 loop
    execute format($q$insert into ck_before select %L, md5(coalesce(string_agg(x,'' order by x),'')), count(*) from
      (select md5((to_jsonb(r) - array['approved_at','approved_by','rejected_at','rejected_by','rejection_reason','payment_collection','refund_requested_at','timezone'])::text) x from public.%I r) s$q$, t, t);
  end loop; end $$;

\ir ../../../supabase/migrations/033_appointment_approval_workflow.sql

do $$ declare h text; cnt bigint; b record; changed int := 0; begin
  for b in select * from ck_before loop
    execute format($q$select md5(coalesce(string_agg(x,'' order by x),'')), count(*) from
      (select md5((to_jsonb(r) - array['approved_at','approved_by','rejected_at','rejected_by','rejection_reason','payment_collection','refund_requested_at','timezone'])::text) x from public.%I r) s$q$, b.t) into h, cnt;
    if h <> b.h or cnt <> b.n then changed := changed + 1; raise warning 'table % changed', b.t; end if;
  end loop;
  if changed > 0 then raise exception 'integrity guard: % table(s) changed — aborting', changed; end if;
  raise notice 'integrity guard OK: % tables, % rows unchanged', (select count(*) from ck_before), (select sum(c.n) from ck_before c);
end $$;
select 'objects' as check,
  (select count(*) from pg_proc where proname in ('approve_appointment','reject_appointment','guard_appointment_client_writes','appointment_holds_doctor_time')) as fns,
  (select count(*) from pg_trigger where tgname = 't_apt_guard_client_writes') as trg,
  (select count(*) from appointments where status in ('pending_approval','confirmed','rejected')) as rows_in_new_statuses;
