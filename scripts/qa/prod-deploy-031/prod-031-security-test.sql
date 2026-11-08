-- CANNA production: migration 031 security test. Everything runs inside one
-- transaction that is ROLLED BACK — it uses a throw-away auth user created here,
-- never a real patient, and leaves no rows behind.
begin;
do $$
declare
  ta uuid := (select id from organizations where subdomain in ('testtest', 'shaked-qa') order by subdomain limit 1);
  tb uuid := (select id from organizations where subdomain in ('shalomtest1', 'oren-qa') order by subdomain limit 1);
  u  uuid := gen_random_uuid();
  t1 uuid; t2 uuid; r record; org uuid; ok boolean;
begin
  -- 1. grants
  if has_function_privilege('anon', 'public.accept_patient_invitation(uuid,uuid)', 'execute')
     or has_function_privilege('authenticated', 'public.accept_patient_invitation(uuid,uuid)', 'execute')
     or has_function_privilege('anon', 'public.claim_patient_clinic(uuid,uuid)', 'execute')
     or has_function_privilege('authenticated', 'public.claim_patient_clinic(uuid,uuid)', 'execute')
     or has_function_privilege('service_role', 'public.transfer_patient_clinic(uuid,uuid,uuid,text)', 'execute')
     or has_function_privilege('authenticated', 'public.transfer_patient_clinic(uuid,uuid,uuid,text)', 'execute')
  then raise exception 'FAIL grants'; end if;
  if not has_function_privilege('service_role', 'public.accept_patient_invitation(uuid,uuid)', 'execute') then raise exception 'FAIL service_role grant'; end if;
  raise notice 'PASS 1 grants (anon/authenticated cannot accept/claim/transfer)';

  -- 2. signup metadata cannot choose a clinic
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
  values (u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'qa-031-' || u || '@qa-rollback.test', '', now(),
          jsonb_build_object('first_name', 'QA', 'organization_id', ta, 'role', 'admin'), '{}'::jsonb, now(), now());
  select organization_id into org from public.users where id = u and role = 'patient';
  if org is distinct from '00000000-0000-0000-0000-000000000001' then raise exception 'FAIL signup used metadata org: %', org; end if;
  raise notice 'PASS 2 signup with forged organization_id/role → patient outside any clinic';

  -- 3. acceptance + single clinic + concurrency semantics
  insert into invitations (organization_id, email, role, send_count) values (ta, 'qa-031-' || u || '@qa-rollback.test', 'patient', 1) returning token into t1;
  insert into invitations (organization_id, email, role, send_count) values (tb, 'qa-031-' || u || '@qa-rollback.test', 'patient', 1) returning token into t2;
  select * into r from accept_patient_invitation(t1, u);
  if r.outcome <> 'joined' or r.organization_id <> ta then raise exception 'FAIL accept: %', r.outcome; end if;
  select * into r from accept_patient_invitation(t2, u);
  if r.outcome <> 'other_clinic' then raise exception 'FAIL second clinic: %', r.outcome; end if;
  select * into r from accept_patient_invitation(t1, u);
  if r.outcome <> 'already_member' then raise exception 'FAIL replay: %', r.outcome; end if;
  if (select organization_id from users where id = u) <> ta then raise exception 'FAIL membership moved'; end if;
  raise notice 'PASS 3 accept → joined; other clinic → blocked; replay → already member';

  -- 4. trigger blocks every other writer
  ok := false;
  begin update users set organization_id = tb where id = u; exception when sqlstate '23514' then ok := true; end;
  if not ok then raise exception 'FAIL trigger allowed a move'; end if;
  ok := false;
  begin update users set organization_id = '00000000-0000-0000-0000-000000000001' where id = u; exception when sqlstate '23514' then ok := true; end;
  if not ok then raise exception 'FAIL trigger allowed a detach'; end if;
  raise notice 'PASS 4 trigger blocks moving/detaching a clinic patient';

  -- 5. one live patient invitation per clinic + email
  ok := false;
  begin insert into invitations (organization_id, email, role, send_count) values (tb, upper('qa-031-' || u || '@qa-rollback.test'), 'patient', 1);
  exception when unique_violation then ok := true; end;
  if not ok then raise exception 'FAIL duplicate live invitation allowed'; end if;
  raise notice 'PASS 5 duplicate live invitation rejected';
end $$;
rollback;
