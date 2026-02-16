-- ===============================================
-- RLS POLICIES v3 — Production
-- ===============================================

alter table organizations enable row level security;
alter table users enable row level security;
alter table appointments enable row level security;
alter table documents enable row level security;
alter table questionnaires enable row level security;
alter table questionnaire_responses enable row level security;
alter table notifications enable row level security;
alter table ai_conversations enable row level security;
alter table audit_logs enable row level security;

-- Helper functions (SECURITY DEFINER = runs as creator, not caller)
create or replace function get_my_org_id() returns uuid language sql security definer stable as $$
  select organization_id from users where id = auth.uid()
$$;

create or replace function get_my_role() returns user_role language sql security definer stable as $$
  select role from users where id = auth.uid()
$$;

-- ORGANIZATIONS
create policy "org_select" on organizations for select using (id = get_my_org_id());
create policy "org_update_admin" on organizations for update using (id = get_my_org_id() and get_my_role() = 'admin');

-- USERS
create policy "users_select_own" on users for select using (id = auth.uid());
create policy "users_select_org" on users for select using (organization_id = get_my_org_id());
create policy "users_update_own" on users for update using (id = auth.uid());
create policy "users_admin_all" on users for all using (organization_id = get_my_org_id() and get_my_role() = 'admin');

-- APPOINTMENTS
create policy "apt_patient_select" on appointments for select using (patient_id = auth.uid());
create policy "apt_doctor_select" on appointments for select using (doctor_id = auth.uid());
create policy "apt_staff_select" on appointments for select using (organization_id = get_my_org_id() and get_my_role() in ('staff','admin'));
create policy "apt_patient_insert" on appointments for insert with check (patient_id = auth.uid() and organization_id = get_my_org_id());
create policy "apt_patient_update" on appointments for update using (patient_id = auth.uid() and status in ('pending','doctor_confirmed','time_selected','payment_pending'));
create policy "apt_doctor_update" on appointments for update using (doctor_id = auth.uid());
create policy "apt_staff_update" on appointments for update using (organization_id = get_my_org_id() and get_my_role() in ('staff','admin'));

-- DOCUMENTS
create policy "docs_patient_select" on documents for select using (patient_id = auth.uid());
create policy "docs_doctor_select" on documents for select using (exists(select 1 from appointments where id = documents.appointment_id and doctor_id = auth.uid()));
create policy "docs_staff_select" on documents for select using (organization_id = get_my_org_id() and get_my_role() in ('staff','admin'));
create policy "docs_insert" on documents for insert with check (uploaded_by = auth.uid() and organization_id = get_my_org_id());

-- QUESTIONNAIRES
create policy "quest_select" on questionnaires for select using (organization_id = get_my_org_id() or (is_template and is_published));
create policy "quest_manage" on questionnaires for all using (organization_id = get_my_org_id() and get_my_role() in ('doctor','admin'));

-- QUESTIONNAIRE RESPONSES
create policy "qr_patient_select" on questionnaire_responses for select using (patient_id = auth.uid());
create policy "qr_doctor_select" on questionnaire_responses for select using (exists(select 1 from appointments where id = questionnaire_responses.appointment_id and doctor_id = auth.uid()));
create policy "qr_patient_insert" on questionnaire_responses for insert with check (patient_id = auth.uid() and organization_id = get_my_org_id());
create policy "qr_patient_update" on questionnaire_responses for update using (patient_id = auth.uid() and not is_complete);

-- NOTIFICATIONS
create policy "notif_select" on notifications for select using (user_id = auth.uid());
create policy "notif_update" on notifications for update using (user_id = auth.uid());
create policy "notif_insert" on notifications for insert with check (true); -- service role

-- AI CONVERSATIONS
create policy "ai_user_select" on ai_conversations for select using (user_id = auth.uid());
create policy "ai_doctor_select" on ai_conversations for select using (exists(select 1 from appointments where id = ai_conversations.appointment_id and doctor_id = auth.uid()));
create policy "ai_insert" on ai_conversations for insert with check (user_id = auth.uid() and organization_id = get_my_org_id());
create policy "ai_update" on ai_conversations for update using (user_id = auth.uid());

-- AUDIT LOGS
create policy "audit_admin_select" on audit_logs for select using (organization_id = get_my_org_id() and get_my_role() = 'admin');
create policy "audit_insert" on audit_logs for insert with check (true); -- triggers

-- STORAGE POLICIES (run in Supabase Dashboard → Storage → Policies)
-- For medical-documents bucket:
--   SELECT: auth.uid() = owner OR doctor with appointment access
--   INSERT: authenticated, max 10MB
--   DELETE: admin only
