-- ===============================================
-- Migration 005: Fill RLS policy gaps
-- Adds missing policies found during security audit
-- ===============================================

-- ── DOCUMENTS: add UPDATE + DELETE ─────────────────────

-- Doctors can update documents (e.g. mark as verified) for their patients
create policy "docs_doctor_update" on documents
  for update using (
    exists(
      select 1 from appointments
      where id = documents.appointment_id
      and doctor_id = auth.uid()
    )
  );

-- Staff/admin can update documents in their org
create policy "docs_staff_update" on documents
  for update using (
    organization_id = get_my_org_id()
    and get_my_role() in ('staff', 'admin')
  );

-- Patients can delete their own uploaded documents
create policy "docs_patient_delete" on documents
  for delete using (
    uploaded_by = auth.uid()
    and patient_id = auth.uid()
  );

-- Admin can delete any document in their org
create policy "docs_admin_delete" on documents
  for delete using (
    organization_id = get_my_org_id()
    and get_my_role() = 'admin'
  );

-- ── QUESTIONNAIRE RESPONSES: add staff/admin SELECT ────

-- Staff/admin can see all questionnaire responses in their org
create policy "qr_staff_select" on questionnaire_responses
  for select using (
    organization_id = get_my_org_id()
    and get_my_role() in ('staff', 'admin')
  );

-- ── NOTIFICATIONS: add admin SELECT ────────────────────

-- Admin can see all notifications in their org (for monitoring)
create policy "notif_admin_select" on notifications
  for select using (
    organization_id = get_my_org_id()
    and get_my_role() = 'admin'
  );

-- ── AI CONVERSATIONS: add staff/admin SELECT ───────────

-- Staff/admin can see all AI conversations in their org (for billing/audit)
create policy "ai_staff_select" on ai_conversations
  for select using (
    organization_id = get_my_org_id()
    and get_my_role() in ('staff', 'admin')
  );

-- ── APPOINTMENTS: add DELETE for drafts only ───────────

-- Patients can delete their own draft appointments
create policy "apt_patient_delete" on appointments
  for delete using (
    patient_id = auth.uid()
    and status = 'draft'
  );

-- Admin can delete appointments in their org
create policy "apt_admin_delete" on appointments
  for delete using (
    organization_id = get_my_org_id()
    and get_my_role() = 'admin'
  );
