-- CANNA production: migration 030 step B (revoke public_doctors) in one transaction with a data-integrity guard.
create temp table ck_before(t text primary key, h text, n bigint) on commit drop;
do $$ declare t text; begin
  for t in select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE' order by 1 loop
    execute format($q$insert into ck_before select %L, md5(coalesce(string_agg(x,'' order by x),'')), count(*) from
      (select md5(to_jsonb(r)::text) x from public.%I r) s$q$, t, t);
  end loop; end $$;
revoke all on public.public_doctors from anon, authenticated, public;
alter view public.public_doctors set (security_invoker = true);
do $$ declare h text; cnt bigint; b record; changed int := 0; begin
  for b in select * from ck_before loop
    execute format($q$select md5(coalesce(string_agg(x,'' order by x),'')), count(*) from
      (select md5(to_jsonb(r)::text) x from public.%I r) s$q$, b.t) into h, cnt;
    if h <> b.h or cnt <> b.n then changed := changed + 1; raise warning 'table % changed', b.t; end if;
  end loop;
  if changed > 0 then raise exception 'integrity guard: % table(s) changed — aborting', changed; end if;
  raise notice 'integrity guard OK: % tables, % rows unchanged', (select count(*) from ck_before), (select sum(c.n) from ck_before c);
end $$;
select 'anon_select', has_table_privilege('anon','public.public_doctors','SELECT'), 'anon_update', has_table_privilege('anon','public.public_doctors','UPDATE');
