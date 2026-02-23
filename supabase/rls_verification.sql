-- ===============================================
-- RLS VERIFICATION SCRIPT
-- ===============================================
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New Query)
--
-- This script:
--   1. Confirms RLS is enabled on every table
--   2. Lists all policies per table
--   3. Creates test fixtures (2 orgs, 4 users)
--   4. Tests access patterns for patient / doctor / admin / cross-org
--   5. Cleans up all test data
--
-- ⚠ Run on a STAGING database, not production.
-- ⚠ This uses service_role context (bypasses RLS) to set up fixtures,
--    then switches to test user contexts via set_config to simulate RLS.
-- ===============================================

-- ╔═══════════════════════════════════════════════╗
-- ║ PART 1: Verify RLS is enabled on all tables  ║
-- ╚═══════════════════════════════════════════════╝

do $$
declare
  tbl text;
  rls_on boolean;
  tables_to_check text[] := array[
    'organizations','users','appointments','documents',
    'questionnaires','questionnaire_responses',
    'notifications','ai_conversations','audit_logs','payments'
  ];
begin
  raise notice '══════════════════════════════════════════';
  raise notice 'PART 1: RLS ENABLED CHECK';
  raise notice '══════════════════════════════════════════';

  foreach tbl in array tables_to_check loop
    select relrowsecurity into rls_on
    from pg_class
    where relname = tbl and relnamespace = 'public'::regnamespace;

    if rls_on is null then
      raise notice '  ✗ Table "%" does NOT EXIST', tbl;
    elsif rls_on then
      raise notice '  ✓ % — RLS ENABLED', tbl;
    else
      raise warning '  ✗ % — RLS DISABLED ← FIX THIS', tbl;
    end if;
  end loop;
end $$;

-- ╔═══════════════════════════════════════════════╗
-- ║ PART 2: List all policies per table           ║
-- ╚═══════════════════════════════════════════════╝

do $$
declare
  r record;
  current_table text := '';
begin
  raise notice '';
  raise notice '══════════════════════════════════════════';
  raise notice 'PART 2: POLICIES PER TABLE';
  raise notice '══════════════════════════════════════════';

  for r in
    select
      schemaname,
      tablename,
      policyname,
      permissive,
      roles,
      cmd,
      qual,
      with_check
    from pg_policies
    where schemaname = 'public'
    order by tablename, policyname
  loop
    if r.tablename != current_table then
      raise notice '';
      raise notice '  ── % ──', r.tablename;
      current_table := r.tablename;
    end if;
    raise notice '    [%] % (roles: %)', r.cmd, r.policyname, r.roles;
  end loop;
end $$;

-- ╔═══════════════════════════════════════════════╗
-- ║ PART 3: Expected policies check               ║
-- ╚═══════════════════════════════════════════════╝

do $$
declare
  missing text[] := '{}';
  expected_policies text[][] := array[
    -- table, policy_name
    array['organizations', 'org_select'],
    array['organizations', 'org_update_admin'],
    array['users', 'users_select_own'],
    array['users', 'users_select_org'],
    array['users', 'users_update_own'],
    array['users', 'users_admin_all'],
    array['appointments', 'apt_patient_select'],
    array['appointments', 'apt_doctor_select'],
    array['appointments', 'apt_staff_select'],
    array['appointments', 'apt_patient_insert'],
    array['appointments', 'apt_patient_update'],
    array['appointments', 'apt_doctor_update'],
    array['appointments', 'apt_staff_update'],
    array['appointments', 'apt_patient_delete'],
    array['appointments', 'apt_admin_delete'],
    array['documents', 'docs_patient_select'],
    array['documents', 'docs_doctor_select'],
    array['documents', 'docs_staff_select'],
    array['documents', 'docs_insert'],
    array['documents', 'docs_doctor_update'],
    array['documents', 'docs_staff_update'],
    array['documents', 'docs_patient_delete'],
    array['documents', 'docs_admin_delete'],
    array['questionnaires', 'quest_select'],
    array['questionnaires', 'quest_manage'],
    array['questionnaire_responses', 'qr_patient_select'],
    array['questionnaire_responses', 'qr_doctor_select'],
    array['questionnaire_responses', 'qr_patient_insert'],
    array['questionnaire_responses', 'qr_patient_update'],
    array['questionnaire_responses', 'qr_staff_select'],
    array['notifications', 'notif_select'],
    array['notifications', 'notif_update'],
    array['notifications', 'notif_insert'],
    array['notifications', 'notif_admin_select'],
    array['ai_conversations', 'ai_user_select'],
    array['ai_conversations', 'ai_doctor_select'],
    array['ai_conversations', 'ai_insert'],
    array['ai_conversations', 'ai_update'],
    array['ai_conversations', 'ai_staff_select'],
    array['audit_logs', 'audit_admin_select'],
    array['audit_logs', 'audit_insert'],
    array['payments', 'payments_patient_select'],
    array['payments', 'payments_doctor_select'],
    array['payments', 'payments_staff_select'],
    array['payments', 'payments_insert'],
    array['payments', 'payments_admin_update']
  ];
  pair text[];
  found boolean;
begin
  raise notice '';
  raise notice '══════════════════════════════════════════';
  raise notice 'PART 3: EXPECTED POLICIES CHECK';
  raise notice '══════════════════════════════════════════';

  foreach pair slice 1 in array expected_policies loop
    select exists(
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = pair[1]
        and policyname = pair[2]
    ) into found;

    if found then
      raise notice '  ✓ %.%', pair[1], pair[2];
    else
      raise warning '  ✗ MISSING: %.% ← CREATE THIS POLICY', pair[1], pair[2];
      missing := array_append(missing, pair[1] || '.' || pair[2]);
    end if;
  end loop;

  if array_length(missing, 1) is not null then
    raise warning '';
    raise warning '  ⚠ % missing policies found! Run migrations 004 + 005.', array_length(missing, 1);
  else
    raise notice '';
    raise notice '  ✓ All % expected policies are present.', array_length(expected_policies, 1);
  end if;
end $$;

-- ╔═══════════════════════════════════════════════╗
-- ║ PART 4: Functional RLS tests with test data   ║
-- ╚═══════════════════════════════════════════════╝
-- Creates test fixtures, then tests access with set_config('request.jwt.claims', ...)
-- to simulate different authenticated users.

do $$
declare
  -- Test UUIDs (deterministic for easy cleanup)
  org1_id    uuid := 'a0000000-0000-0000-0000-000000000001';
  org2_id    uuid := 'a0000000-0000-0000-0000-000000000002';
  patient1   uuid := 'b0000000-0000-0000-0000-000000000001'; -- org1 patient
  doctor1    uuid := 'b0000000-0000-0000-0000-000000000002'; -- org1 doctor
  admin1     uuid := 'b0000000-0000-0000-0000-000000000003'; -- org1 admin
  patient2   uuid := 'b0000000-0000-0000-0000-000000000004'; -- org2 patient (cross-org)
  apt1_id    uuid := 'c0000000-0000-0000-0000-000000000001'; -- org1 appointment
  apt2_id    uuid := 'c0000000-0000-0000-0000-000000000002'; -- org2 appointment
  doc1_id    uuid := 'd0000000-0000-0000-0000-000000000001'; -- org1 document
  notif1_id  uuid := 'e0000000-0000-0000-0000-000000000001';
  notif2_id  uuid := 'e0000000-0000-0000-0000-000000000002';
  ai1_id     uuid := 'f0000000-0000-0000-0000-000000000001';
  audit1_id  uuid := 'f1000000-0000-0000-0000-000000000001';
  qr1_id     uuid := 'f2000000-0000-0000-0000-000000000001';
  quest1_id  uuid := 'f3000000-0000-0000-0000-000000000001';
  pay1_id    uuid := 'f4000000-0000-0000-0000-000000000001';

  row_count  int;
  test_pass  int := 0;
  test_fail  int := 0;
  test_total int := 0;
begin
  raise notice '';
  raise notice '══════════════════════════════════════════';
  raise notice 'PART 4: FUNCTIONAL RLS TESTS';
  raise notice '══════════════════════════════════════════';
  raise notice '  Setting up test fixtures...';

  -- ── Clean up any previous test run ──
  delete from audit_logs where organization_id in (org1_id, org2_id);
  delete from ai_conversations where organization_id in (org1_id, org2_id);
  delete from notifications where organization_id in (org1_id, org2_id);
  delete from questionnaire_responses where organization_id in (org1_id, org2_id);
  delete from questionnaires where organization_id in (org1_id, org2_id);
  delete from documents where organization_id in (org1_id, org2_id);
  -- Delete payments if table exists
  begin
    execute 'delete from payments where organization_id in ($1, $2)' using org1_id, org2_id;
  exception when undefined_table then null;
  end;
  delete from appointments where organization_id in (org1_id, org2_id);
  delete from users where organization_id in (org1_id, org2_id);
  delete from organizations where id in (org1_id, org2_id);

  -- ── Create test organizations ──
  insert into organizations (id, name, subdomain, slug) values
    (org1_id, 'Test Clinic 1', 'test-rls-org1', 'test-rls-org1'),
    (org2_id, 'Test Clinic 2', 'test-rls-org2', 'test-rls-org2');

  -- ── Create test users (directly, bypassing auth.users trigger) ──
  -- We need corresponding auth.users entries for auth.uid() to work
  -- In testing we use set_config to simulate auth context instead

  insert into users (id, organization_id, email, first_name, last_name, role, license_number) values
    (patient1, org1_id, 'test-rls-patient1@test.com', 'Patient', 'One', 'patient', null),
    (doctor1,  org1_id, 'test-rls-doctor1@test.com',  'Doctor',  'One', 'doctor', 'LIC-TEST-001'),
    (admin1,   org1_id, 'test-rls-admin1@test.com',   'Admin',   'One', 'admin',  null),
    (patient2, org2_id, 'test-rls-patient2@test.com', 'Patient', 'Two', 'patient', null);

  -- ── Create test appointments ──
  insert into appointments (id, organization_id, patient_id, doctor_id, chief_complaint, status, payment_amount) values
    (apt1_id, org1_id, patient1, doctor1, 'Test complaint 1', 'pending', 250.00),
    (apt2_id, org2_id, patient2, null,    'Test complaint 2', 'pending', 150.00);

  -- ── Create test documents ──
  insert into documents (id, organization_id, patient_id, appointment_id, uploaded_by, file_name, file_type, file_size_bytes, storage_path) values
    (doc1_id, org1_id, patient1, apt1_id, patient1, 'test.pdf', 'application/pdf', 1024, 'test/path.pdf');

  -- ── Create test questionnaire + response ──
  insert into questionnaires (id, organization_id, title, questions, is_template, is_published, created_by) values
    (quest1_id, org1_id, 'Test Questionnaire', '[{"q":"test?"}]'::jsonb, false, true, doctor1);

  insert into questionnaire_responses (id, organization_id, questionnaire_id, appointment_id, patient_id, responses, is_complete) values
    (qr1_id, org1_id, quest1_id, apt1_id, patient1, '{"1":"answer"}'::jsonb, true);

  -- ── Create test notifications ──
  insert into notifications (id, organization_id, user_id, type, content) values
    (notif1_id, org1_id, patient1, 'email', 'Test notification for patient1'),
    (notif2_id, org1_id, doctor1,  'email', 'Test notification for doctor1');

  -- ── Create test AI conversation ──
  insert into ai_conversations (id, organization_id, user_id, appointment_id, agent_type, messages) values
    (ai1_id, org1_id, patient1, apt1_id, 'triage', '[{"role":"user","content":"test"}]'::jsonb);

  -- ── Create test audit log ──
  insert into audit_logs (id, organization_id, user_id, action, resource_type, resource_id) values
    (audit1_id, org1_id, patient1, 'TEST_ACTION', 'appointment', apt1_id);

  -- ── Create test payment (if table exists) ──
  begin
    execute format(
      'insert into payments (id, organization_id, appointment_id, patient_id, amount, status, provider, idempotency_key) values ($1, $2, $3, $4, 250.00, ''completed'', ''tranzila'', ''test-idem-001'')'
    ) using pay1_id, org1_id, apt1_id, patient1;
  exception when undefined_table then
    raise notice '  ⚠ payments table does not exist — skipping payment tests';
  end;

  raise notice '  Fixtures created. Running tests...';
  raise notice '';

  -- ══════════════════════════════════════════
  -- HELPER: We use set_config to simulate auth.uid()
  -- auth.uid() in Supabase reads from request.jwt.claims->sub
  -- ══════════════════════════════════════════

  -- ── TEST GROUP: ORGANIZATIONS ──────────────────────

  -- Test 1: Patient can see own org
  perform set_config('request.jwt.claims', json_build_object('sub', patient1, 'role', 'authenticated')::text, true);
  select count(*) into row_count from organizations where id = org1_id;
  test_total := test_total + 1;
  if row_count = 1 then
    raise notice '  ✓ T%: Patient sees own organization', test_total;
    test_pass := test_pass + 1;
  else
    raise warning '  ✗ T%: Patient should see own org (got % rows)', test_total, row_count;
    test_fail := test_fail + 1;
  end if;

  -- Test 2: Patient cannot see other org
  test_total := test_total + 1;
  select count(*) into row_count from organizations where id = org2_id;
  if row_count = 0 then
    raise notice '  ✓ T%: Patient cannot see other organization', test_total;
    test_pass := test_pass + 1;
  else
    raise warning '  ✗ T%: Patient should NOT see other org (got % rows)', test_total, row_count;
    test_fail := test_fail + 1;
  end if;

  -- ── TEST GROUP: USERS ──────────────────────────────

  -- Test 3: Patient sees own profile
  test_total := test_total + 1;
  select count(*) into row_count from users where id = patient1;
  if row_count = 1 then
    raise notice '  ✓ T%: Patient sees own profile', test_total;
    test_pass := test_pass + 1;
  else
    raise warning '  ✗ T%: Patient should see own profile', test_total;
    test_fail := test_fail + 1;
  end if;

  -- Test 4: Patient sees org members (same org)
  test_total := test_total + 1;
  select count(*) into row_count from users where organization_id = org1_id;
  if row_count >= 1 then
    raise notice '  ✓ T%: Patient sees org members (% users)', test_total, row_count;
    test_pass := test_pass + 1;
  else
    raise warning '  ✗ T%: Patient should see org members', test_total;
    test_fail := test_fail + 1;
  end if;

  -- Test 5: Patient cannot see other org users
  test_total := test_total + 1;
  select count(*) into row_count from users where organization_id = org2_id;
  if row_count = 0 then
    raise notice '  ✓ T%: Patient cannot see other org users', test_total;
    test_pass := test_pass + 1;
  else
    raise warning '  ✗ T%: Patient should NOT see other org users (got %)', test_total, row_count;
    test_fail := test_fail + 1;
  end if;

  -- ── TEST GROUP: APPOINTMENTS ───────────────────────

  -- Test 6: Patient sees own appointments
  test_total := test_total + 1;
  select count(*) into row_count from appointments where patient_id = patient1;
  if row_count = 1 then
    raise notice '  ✓ T%: Patient sees own appointments', test_total;
    test_pass := test_pass + 1;
  else
    raise warning '  ✗ T%: Patient should see own appointment (got %)', test_total, row_count;
    test_fail := test_fail + 1;
  end if;

  -- Test 7: Patient cannot see other org appointments
  test_total := test_total + 1;
  select count(*) into row_count from appointments where organization_id = org2_id;
  if row_count = 0 then
    raise notice '  ✓ T%: Patient cannot see other org appointments', test_total;
    test_pass := test_pass + 1;
  else
    raise warning '  ✗ T%: Patient should NOT see other org appointments (got %)', test_total, row_count;
    test_fail := test_fail + 1;
  end if;

  -- Test 8: Doctor sees assigned appointments
  perform set_config('request.jwt.claims', json_build_object('sub', doctor1, 'role', 'authenticated')::text, true);
  test_total := test_total + 1;
  select count(*) into row_count from appointments where doctor_id = doctor1;
  if row_count = 1 then
    raise notice '  ✓ T%: Doctor sees assigned appointments', test_total;
    test_pass := test_pass + 1;
  else
    raise warning '  ✗ T%: Doctor should see assigned appointment (got %)', test_total, row_count;
    test_fail := test_fail + 1;
  end if;

  -- Test 9: Doctor cannot see other org appointments
  test_total := test_total + 1;
  select count(*) into row_count from appointments where organization_id = org2_id;
  if row_count = 0 then
    raise notice '  ✓ T%: Doctor cannot see other org appointments', test_total;
    test_pass := test_pass + 1;
  else
    raise warning '  ✗ T%: Doctor should NOT see other org appointments (got %)', test_total, row_count;
    test_fail := test_fail + 1;
  end if;

  -- Test 10: Admin sees all org appointments
  perform set_config('request.jwt.claims', json_build_object('sub', admin1, 'role', 'authenticated')::text, true);
  test_total := test_total + 1;
  select count(*) into row_count from appointments where organization_id = org1_id;
  if row_count >= 1 then
    raise notice '  ✓ T%: Admin sees all org appointments (% rows)', test_total, row_count;
    test_pass := test_pass + 1;
  else
    raise warning '  ✗ T%: Admin should see all org appointments', test_total;
    test_fail := test_fail + 1;
  end if;

  -- Test 11: Admin cannot see other org appointments
  test_total := test_total + 1;
  select count(*) into row_count from appointments where organization_id = org2_id;
  if row_count = 0 then
    raise notice '  ✓ T%: Admin cannot see other org appointments', test_total;
    test_pass := test_pass + 1;
  else
    raise warning '  ✗ T%: Admin should NOT see other org appointments (got %)', test_total, row_count;
    test_fail := test_fail + 1;
  end if;

  -- ── TEST GROUP: DOCUMENTS ──────────────────────────

  -- Test 12: Patient sees own documents
  perform set_config('request.jwt.claims', json_build_object('sub', patient1, 'role', 'authenticated')::text, true);
  test_total := test_total + 1;
  select count(*) into row_count from documents where patient_id = patient1;
  if row_count = 1 then
    raise notice '  ✓ T%: Patient sees own documents', test_total;
    test_pass := test_pass + 1;
  else
    raise warning '  ✗ T%: Patient should see own document (got %)', test_total, row_count;
    test_fail := test_fail + 1;
  end if;

  -- Test 13: Doctor sees documents via appointment link
  perform set_config('request.jwt.claims', json_build_object('sub', doctor1, 'role', 'authenticated')::text, true);
  test_total := test_total + 1;
  select count(*) into row_count from documents where appointment_id = apt1_id;
  if row_count = 1 then
    raise notice '  ✓ T%: Doctor sees documents via appointment', test_total;
    test_pass := test_pass + 1;
  else
    raise warning '  ✗ T%: Doctor should see appointment documents (got %)', test_total, row_count;
    test_fail := test_fail + 1;
  end if;

  -- Test 14: Cross-org patient cannot see org1 documents
  perform set_config('request.jwt.claims', json_build_object('sub', patient2, 'role', 'authenticated')::text, true);
  test_total := test_total + 1;
  select count(*) into row_count from documents where organization_id = org1_id;
  if row_count = 0 then
    raise notice '  ✓ T%: Cross-org patient cannot see org1 documents', test_total;
    test_pass := test_pass + 1;
  else
    raise warning '  ✗ T%: Cross-org patient should NOT see org1 docs (got %)', test_total, row_count;
    test_fail := test_fail + 1;
  end if;

  -- ── TEST GROUP: QUESTIONNAIRE RESPONSES ────────────

  -- Test 15: Patient sees own responses
  perform set_config('request.jwt.claims', json_build_object('sub', patient1, 'role', 'authenticated')::text, true);
  test_total := test_total + 1;
  select count(*) into row_count from questionnaire_responses where patient_id = patient1;
  if row_count = 1 then
    raise notice '  ✓ T%: Patient sees own questionnaire responses', test_total;
    test_pass := test_pass + 1;
  else
    raise warning '  ✗ T%: Patient should see own response (got %)', test_total, row_count;
    test_fail := test_fail + 1;
  end if;

  -- Test 16: Doctor sees responses via appointment
  perform set_config('request.jwt.claims', json_build_object('sub', doctor1, 'role', 'authenticated')::text, true);
  test_total := test_total + 1;
  select count(*) into row_count from questionnaire_responses where appointment_id = apt1_id;
  if row_count = 1 then
    raise notice '  ✓ T%: Doctor sees responses via appointment', test_total;
    test_pass := test_pass + 1;
  else
    raise warning '  ✗ T%: Doctor should see appointment responses (got %)', test_total, row_count;
    test_fail := test_fail + 1;
  end if;

  -- Test 17: Admin sees all org responses
  perform set_config('request.jwt.claims', json_build_object('sub', admin1, 'role', 'authenticated')::text, true);
  test_total := test_total + 1;
  select count(*) into row_count from questionnaire_responses where organization_id = org1_id;
  if row_count >= 1 then
    raise notice '  ✓ T%: Admin sees all org questionnaire responses', test_total;
    test_pass := test_pass + 1;
  else
    raise warning '  ✗ T%: Admin should see all org responses (got %)', test_total, row_count;
    test_fail := test_fail + 1;
  end if;

  -- ── TEST GROUP: NOTIFICATIONS ──────────────────────

  -- Test 18: Patient sees only own notifications
  perform set_config('request.jwt.claims', json_build_object('sub', patient1, 'role', 'authenticated')::text, true);
  test_total := test_total + 1;
  select count(*) into row_count from notifications where user_id = patient1;
  if row_count = 1 then
    raise notice '  ✓ T%: Patient sees own notifications', test_total;
    test_pass := test_pass + 1;
  else
    raise warning '  ✗ T%: Patient should see 1 notification (got %)', test_total, row_count;
    test_fail := test_fail + 1;
  end if;

  -- Test 19: Patient cannot see doctor's notifications
  test_total := test_total + 1;
  select count(*) into row_count from notifications where user_id = doctor1;
  if row_count = 0 then
    raise notice '  ✓ T%: Patient cannot see doctor notifications', test_total;
    test_pass := test_pass + 1;
  else
    raise warning '  ✗ T%: Patient should NOT see doctor notifications (got %)', test_total, row_count;
    test_fail := test_fail + 1;
  end if;

  -- Test 20: Admin sees all org notifications
  perform set_config('request.jwt.claims', json_build_object('sub', admin1, 'role', 'authenticated')::text, true);
  test_total := test_total + 1;
  select count(*) into row_count from notifications where organization_id = org1_id;
  if row_count >= 2 then
    raise notice '  ✓ T%: Admin sees all org notifications (% rows)', test_total, row_count;
    test_pass := test_pass + 1;
  else
    raise warning '  ✗ T%: Admin should see all org notifications (got %)', test_total, row_count;
    test_fail := test_fail + 1;
  end if;

  -- ── TEST GROUP: AI CONVERSATIONS ───────────────────

  -- Test 21: Patient sees own AI conversations
  perform set_config('request.jwt.claims', json_build_object('sub', patient1, 'role', 'authenticated')::text, true);
  test_total := test_total + 1;
  select count(*) into row_count from ai_conversations where user_id = patient1;
  if row_count = 1 then
    raise notice '  ✓ T%: Patient sees own AI conversations', test_total;
    test_pass := test_pass + 1;
  else
    raise warning '  ✗ T%: Patient should see own AI conversation (got %)', test_total, row_count;
    test_fail := test_fail + 1;
  end if;

  -- Test 22: Doctor sees AI conversations via appointment
  perform set_config('request.jwt.claims', json_build_object('sub', doctor1, 'role', 'authenticated')::text, true);
  test_total := test_total + 1;
  select count(*) into row_count from ai_conversations where appointment_id = apt1_id;
  if row_count = 1 then
    raise notice '  ✓ T%: Doctor sees AI conversations via appointment', test_total;
    test_pass := test_pass + 1;
  else
    raise warning '  ✗ T%: Doctor should see appointment AI conversations (got %)', test_total, row_count;
    test_fail := test_fail + 1;
  end if;

  -- Test 23: Admin sees all org AI conversations
  perform set_config('request.jwt.claims', json_build_object('sub', admin1, 'role', 'authenticated')::text, true);
  test_total := test_total + 1;
  select count(*) into row_count from ai_conversations where organization_id = org1_id;
  if row_count >= 1 then
    raise notice '  ✓ T%: Admin sees all org AI conversations', test_total;
    test_pass := test_pass + 1;
  else
    raise warning '  ✗ T%: Admin should see all org AI conversations (got %)', test_total, row_count;
    test_fail := test_fail + 1;
  end if;

  -- Test 24: Cross-org patient cannot see org1 AI conversations
  perform set_config('request.jwt.claims', json_build_object('sub', patient2, 'role', 'authenticated')::text, true);
  test_total := test_total + 1;
  select count(*) into row_count from ai_conversations where organization_id = org1_id;
  if row_count = 0 then
    raise notice '  ✓ T%: Cross-org patient cannot see org1 AI conversations', test_total;
    test_pass := test_pass + 1;
  else
    raise warning '  ✗ T%: Cross-org patient should NOT see org1 AI conversations (got %)', test_total, row_count;
    test_fail := test_fail + 1;
  end if;

  -- ── TEST GROUP: AUDIT LOGS ─────────────────────────

  -- Test 25: Patient cannot see audit logs
  perform set_config('request.jwt.claims', json_build_object('sub', patient1, 'role', 'authenticated')::text, true);
  test_total := test_total + 1;
  select count(*) into row_count from audit_logs where organization_id = org1_id;
  if row_count = 0 then
    raise notice '  ✓ T%: Patient cannot see audit logs', test_total;
    test_pass := test_pass + 1;
  else
    raise warning '  ✗ T%: Patient should NOT see audit logs (got %)', test_total, row_count;
    test_fail := test_fail + 1;
  end if;

  -- Test 26: Doctor cannot see audit logs
  perform set_config('request.jwt.claims', json_build_object('sub', doctor1, 'role', 'authenticated')::text, true);
  test_total := test_total + 1;
  select count(*) into row_count from audit_logs where organization_id = org1_id;
  if row_count = 0 then
    raise notice '  ✓ T%: Doctor cannot see audit logs', test_total;
    test_pass := test_pass + 1;
  else
    raise warning '  ✗ T%: Doctor should NOT see audit logs (got %)', test_total, row_count;
    test_fail := test_fail + 1;
  end if;

  -- Test 27: Admin sees own org audit logs
  perform set_config('request.jwt.claims', json_build_object('sub', admin1, 'role', 'authenticated')::text, true);
  test_total := test_total + 1;
  select count(*) into row_count from audit_logs where organization_id = org1_id;
  if row_count >= 1 then
    raise notice '  ✓ T%: Admin sees own org audit logs (% rows)', test_total, row_count;
    test_pass := test_pass + 1;
  else
    raise warning '  ✗ T%: Admin should see org audit logs (got %)', test_total, row_count;
    test_fail := test_fail + 1;
  end if;

  -- Test 28: Admin cannot see other org audit logs
  test_total := test_total + 1;
  select count(*) into row_count from audit_logs where organization_id = org2_id;
  if row_count = 0 then
    raise notice '  ✓ T%: Admin cannot see other org audit logs', test_total;
    test_pass := test_pass + 1;
  else
    raise warning '  ✗ T%: Admin should NOT see other org audit logs (got %)', test_total, row_count;
    test_fail := test_fail + 1;
  end if;

  -- ── TEST GROUP: PAYMENTS (if table exists) ─────────

  begin
    -- Test 29: Patient sees own payments
    perform set_config('request.jwt.claims', json_build_object('sub', patient1, 'role', 'authenticated')::text, true);
    test_total := test_total + 1;
    execute 'select count(*) from payments where patient_id = $1' into row_count using patient1;
    if row_count = 1 then
      raise notice '  ✓ T%: Patient sees own payments', test_total;
      test_pass := test_pass + 1;
    else
      raise warning '  ✗ T%: Patient should see own payment (got %)', test_total, row_count;
      test_fail := test_fail + 1;
    end if;

    -- Test 30: Cross-org patient cannot see org1 payments
    perform set_config('request.jwt.claims', json_build_object('sub', patient2, 'role', 'authenticated')::text, true);
    test_total := test_total + 1;
    execute 'select count(*) from payments where organization_id = $1' into row_count using org1_id;
    if row_count = 0 then
      raise notice '  ✓ T%: Cross-org patient cannot see org1 payments', test_total;
      test_pass := test_pass + 1;
    else
      raise warning '  ✗ T%: Cross-org patient should NOT see org1 payments (got %)', test_total, row_count;
      test_fail := test_fail + 1;
    end if;

    -- Test 31: Doctor sees payments via appointment
    perform set_config('request.jwt.claims', json_build_object('sub', doctor1, 'role', 'authenticated')::text, true);
    test_total := test_total + 1;
    execute 'select count(*) from payments where appointment_id = $1' into row_count using apt1_id;
    if row_count = 1 then
      raise notice '  ✓ T%: Doctor sees payments via appointment', test_total;
      test_pass := test_pass + 1;
    else
      raise warning '  ✗ T%: Doctor should see appointment payment (got %)', test_total, row_count;
      test_fail := test_fail + 1;
    end if;

    -- Test 32: Admin sees all org payments
    perform set_config('request.jwt.claims', json_build_object('sub', admin1, 'role', 'authenticated')::text, true);
    test_total := test_total + 1;
    execute 'select count(*) from payments where organization_id = $1' into row_count using org1_id;
    if row_count >= 1 then
      raise notice '  ✓ T%: Admin sees all org payments (% rows)', test_total, row_count;
      test_pass := test_pass + 1;
    else
      raise warning '  ✗ T%: Admin should see org payments (got %)', test_total, row_count;
      test_fail := test_fail + 1;
    end if;
  exception when undefined_table then
    raise notice '  ⚠ payments table does not exist — skipped 4 payment tests';
  end;

  -- ══════════════════════════════════════════
  -- SUMMARY
  -- ══════════════════════════════════════════
  raise notice '';
  raise notice '══════════════════════════════════════════';
  raise notice 'RESULTS: % passed, % failed, % total', test_pass, test_fail, test_total;
  raise notice '══════════════════════════════════════════';

  if test_fail > 0 then
    raise warning '⚠ % tests FAILED — review policies above', test_fail;
  else
    raise notice '✓ All tests passed!';
  end if;

  -- ══════════════════════════════════════════
  -- CLEANUP
  -- ══════════════════════════════════════════
  raise notice '';
  raise notice 'Cleaning up test fixtures...';

  -- Reset to service role context
  perform set_config('request.jwt.claims', '', true);

  delete from audit_logs where organization_id in (org1_id, org2_id);
  delete from ai_conversations where organization_id in (org1_id, org2_id);
  delete from notifications where organization_id in (org1_id, org2_id);
  delete from questionnaire_responses where organization_id in (org1_id, org2_id);
  delete from questionnaires where organization_id in (org1_id, org2_id);
  delete from documents where organization_id in (org1_id, org2_id);
  begin
    execute 'delete from payments where organization_id in ($1, $2)' using org1_id, org2_id;
  exception when undefined_table then null;
  end;
  delete from appointments where organization_id in (org1_id, org2_id);
  delete from users where organization_id in (org1_id, org2_id);
  delete from organizations where id in (org1_id, org2_id);

  raise notice 'Cleanup complete.';
end $$;
