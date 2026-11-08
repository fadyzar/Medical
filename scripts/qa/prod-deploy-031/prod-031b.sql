-- CANNA production: migration 031 step B (handle_new_user no longer takes organization_id from signup metadata).
-- Run after the code deploy. One transaction + integrity guard.
create temp table ck_before(t text primary key, h text, n bigint) on commit drop;
do $$ declare t text; begin
  for t in select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE' order by 1 loop
    execute format($q$insert into ck_before select %L, md5(coalesce(string_agg(x,'' order by x),'')), count(*) from
      (select md5((to_jsonb(r) - array['revoked_at','revoked_by','accepted_by','last_sent_at','send_count'])::text) x from public.%I r) s$q$, t, t);
  end loop; end $$;
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
do $$ declare h text; cnt bigint; b record; changed int := 0; begin
  for b in select * from ck_before loop
    execute format($q$select md5(coalesce(string_agg(x,'' order by x),'')), count(*) from
      (select md5((to_jsonb(r) - array['revoked_at','revoked_by','accepted_by','last_sent_at','send_count'])::text) x from public.%I r) s$q$, b.t) into h, cnt;
    if h <> b.h or cnt <> b.n then changed := changed + 1; raise warning 'table % changed', b.t; end if;
  end loop;
  if changed > 0 then raise exception 'integrity guard: % table(s) changed — aborting', changed; end if;
  raise notice 'integrity guard OK: % tables, % rows unchanged', (select count(*) from ck_before), (select sum(c.n) from ck_before c);
end $$;
select 'handle_new_user_trusts_metadata_org', position('organization_id''' in prosrc) > 0 from pg_proc where proname='handle_new_user';
