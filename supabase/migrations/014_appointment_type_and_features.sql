-- ================================================================
-- Migration 014: appointment_type, doctor availability settings,
--               in-app notifications for patients
-- ================================================================

-- 0. Extend notification_type enum to include 'in_app'
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'in_app';

-- 1. Add appointment_type to appointments
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS appointment_type TEXT NOT NULL DEFAULT 'video'
    CHECK (appointment_type IN ('video', 'clinic'));

-- 2. Add clinic/video toggles to doctors (users table)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS accepts_video  BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS accepts_clinic BOOLEAN NOT NULL DEFAULT false;

-- 3. In-app notification flag on notifications
--    We use type = 'in_app' for internal notifications
--    Add read_at column if not already present (already in schema)
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS title TEXT;

-- 4. RLS: allow doctor to see patient documents by patient_id
--    (needed because documents uploaded via "my-documents" have no appointment_id)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'documents' AND policyname = 'docs_doctor_select_by_patient'
  ) THEN
    EXECUTE $POLICY$
      CREATE POLICY "docs_doctor_select_by_patient" ON documents
        FOR SELECT USING (
          EXISTS (
            SELECT 1 FROM appointments
            WHERE appointments.patient_id = documents.patient_id
              AND appointments.doctor_id = auth.uid()
          )
        )
    $POLICY$;
  END IF;
END $$;

-- 5. RLS: allow doctor to insert in-app notifications for their patients
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'notifications' AND policyname = 'notif_doctor_insert'
  ) THEN
    EXECUTE $POLICY$
      CREATE POLICY "notif_doctor_insert" ON notifications
        FOR INSERT WITH CHECK (
          get_my_role() IN ('doctor', 'staff', 'admin')
          AND organization_id = get_my_org_id()
        )
    $POLICY$;
  END IF;
END $$;

-- 6. RLS: allow patient to update their own notifications (mark as read)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'notifications' AND policyname = 'notif_patient_update'
  ) THEN
    EXECUTE $POLICY$
      CREATE POLICY "notif_patient_update" ON notifications
        FOR UPDATE USING (user_id = auth.uid())
    $POLICY$;
  END IF;
END $$;
