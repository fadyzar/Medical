-- CANNA production: migration 033 security test. ONE transaction, ROLLED BACK.
-- Uses a throw-away auth user and throw-away appointments created here; no
-- email is sent (SQL only) and nothing remains afterwards.
begin;
do $$
declare
  ta uuid := (select id from organizations where subdomain in ('testtest', 'shaked-qa') order by subdomain limit 1);
  tb uuid := (select id from organizations where subdomain in ('shalomtest1', 'oren-qa') order by subdomain limit 1);
  doc uuid := (select u.id from users u join organizations o on o.id = u.organization_id where u.role = 'doctor' and o.subdomain in ('testtest', 'shaked-qa') order by o.subdomain, u.created_at limit 1);
  admb uuid := (select u.id from users u join organizations o on o.id = u.organization_id where u.role = 'admin' and o.subdomain in ('shalomtest1', 'oren-qa') order by o.subdomain limit 1);
  u uuid := gen_random_uuid();
  a1 uuid; a2 uuid; r jsonb; ok boolean;
  t timestamptz := date_trunc('hour', now()) + interval '400 days';
begin
  if ta is null or doc is null then raise exception 'SETUP: test clinic/doctor not found'; end if;
  -- 1. grants
  if has_function_privilege('anon', 'public.approve_appointment(uuid,uuid,int)', 'execute')
     or has_function_privilege('authenticated', 'public.approve_appointment(uuid,uuid,int)', 'execute')
     or has_function_privilege('authenticated', 'public.reject_appointment(uuid,uuid,text)', 'execute')
     or not has_function_privilege('service_role', 'public.approve_appointment(uuid,uuid,int)', 'execute')
  then raise exception 'FAIL grants'; end if;
  raise notice 'PASS 1 grants: approve/reject only for service_role';

  -- throw-away patient in the test clinic
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
  values (u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'qa-033-' || u || '@qa-rollback.test', '', now(), '{"first_name":"QA"}', '{}', now(), now());
  update users set organization_id = ta where id = u;

  insert into appointments (organization_id, patient_id, doctor_id, chief_complaint, scheduled_at, status, payment_collection, payment_status, payment_amount)
  values (ta, u, doc, 'QA-033', t, 'payment_pending', 'online', 'pending', 100) returning id into a1;

  -- 2. browser session of the patient cannot fake payment / confirm / reprice
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', u::text, true);
  set local role authenticated;
  begin update appointments set payment_status = 'completed' where id = a1; ok := false; exception when others then ok := true; end;
  if not ok then raise exception 'FAIL patient marked payment completed'; end if;
  begin update appointments set status = 'confirmed' where id = a1; ok := false; exception when others then ok := true; end;
  if not ok then raise exception 'FAIL patient confirmed'; end if;
  begin update appointments set payment_amount = 1 where id = a1; ok := false; exception when others then ok := true; end;
  if not ok then raise exception 'FAIL patient repriced'; end if;
  insert into appointments (organization_id, patient_id, doctor_id, chief_complaint, scheduled_at, status, payment_amount, payment_status)
  values (ta, u, doc, 'QA-033', t + interval '1 hour', 'pending', 0.01, 'completed') returning id into a2;
  reset role;
  if (select payment_status from appointments where id = a2) is not null
     or (select payment_amount from appointments where id = a2) is distinct from (select consultation_price from users where id = doc)
  then raise exception 'FAIL insert kept client payment fields'; end if;
  raise notice 'PASS 2 browser cannot fake payment, confirm or reprice; insert priced from doctor';

  -- 3. approval rules
  r := approve_appointment(a1, doc);
  if r->>'code' <> 'invalid_status' then raise exception 'FAIL approval while awaiting payment: %', r; end if;
  update appointments set status = 'pending_approval' where id = a1;   -- queued but not paid
  r := approve_appointment(a1, doc);
  if r->>'code' <> 'payment_not_verified' then raise exception 'FAIL unpaid approval: %', r; end if;
  update appointments set status = 'pending_approval', payment_status = 'completed' where id = a1;
  if admb is not null then
    r := approve_appointment(a1, admb);
    if r->>'code' <> 'forbidden' then raise exception 'FAIL cross-clinic admin: %', r; end if;
  end if;
  r := approve_appointment(a1, u);
  if r->>'code' <> 'forbidden' then raise exception 'FAIL patient approval: %', r; end if;
  r := approve_appointment(a1, doc);
  if (r->>'ok')::boolean is not true then raise exception 'FAIL doctor approval: %', r; end if;
  r := approve_appointment(a1, doc);
  if r->>'code' <> 'already_confirmed' then raise exception 'FAIL duplicate: %', r; end if;
  raise notice 'PASS 3 approval: unpaid refused, cross-clinic/patient refused, doctor ok, duplicate no-op';

  -- 4. rejection frees the slot and flags a refund
  update appointments set payment_collection = 'online', status = 'pending_approval', payment_status = 'completed' where id = a2;
  r := reject_appointment(a2, doc, 'qa');
  if (r->>'refund_required')::boolean is not true or (select status from appointments where id = a2) <> 'rejected' then raise exception 'FAIL reject: %', r; end if;
  insert into appointments (organization_id, patient_id, doctor_id, chief_complaint, scheduled_at, status)
  values (ta, u, doc, 'QA-033', t + interval '1 hour', 'pending');
  raise notice 'PASS 4 rejection: refund flagged, slot rebookable';
end $$;
rollback;
select 'after rollback' as check, count(*) as leftover from appointments where chief_complaint = 'QA-033';
