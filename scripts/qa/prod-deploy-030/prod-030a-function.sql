-- CANNA production: migration 030 step A (additive: appointment_doctors) in one transaction with a data-integrity guard.
create temp table ck_before(t text primary key, h text, n bigint) on commit drop;
do $$ declare t text; begin
  for t in select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE' order by 1 loop
    execute format($q$insert into ck_before select %L, md5(coalesce(string_agg(x,'' order by x),'')), count(*) from
      (select md5(to_jsonb(r)::text) x from public.%I r) s$q$, t, t);
  end loop; end $$;
create or replace function public.appointment_doctors(doctor_ids uuid[])
returns table (
  id uuid,
  first_name text,
  last_name text,
  avatar_url text,
  specialties text[],
  consultation_price numeric,
  average_rating numeric,
  total_ratings integer
)
language sql
stable
security definer
set search_path = public
as $$
  select d.id, d.first_name, d.last_name, d.avatar_url, d.specialties,
         d.consultation_price, d.average_rating, d.total_ratings
  from users d
  where auth.uid() is not null
    and d.role = 'doctor'
    and d.id = any(doctor_ids)
    and (
      d.id = auth.uid()
      or exists (select 1 from appointments a where a.doctor_id = d.id and a.patient_id = auth.uid())
      or (d.organization_id = get_my_org_id() and get_my_role() in ('staff', 'admin', 'doctor'))
    )
$$;

revoke all on function public.appointment_doctors(uuid[]) from public, anon;
grant execute on function public.appointment_doctors(uuid[]) to authenticated;
do $$ declare h text; cnt bigint; b record; changed int := 0; begin
  for b in select * from ck_before loop
    execute format($q$select md5(coalesce(string_agg(x,'' order by x),'')), count(*) from
      (select md5(to_jsonb(r)::text) x from public.%I r) s$q$, b.t) into h, cnt;
    if h <> b.h or cnt <> b.n then changed := changed + 1; raise warning 'table % changed', b.t; end if;
  end loop;
  if changed > 0 then raise exception 'integrity guard: % table(s) changed — aborting', changed; end if;
  raise notice 'integrity guard OK: % tables, % rows unchanged', (select count(*) from ck_before), (select sum(c.n) from ck_before c);
end $$;
select 'function_installed', count(*) from pg_proc where proname='appointment_doctors';
