-- Migration 013: Allow authenticated users to see active doctors
-- Patients need to see doctors to book appointments

CREATE POLICY "users_select_doctors"
  ON users FOR SELECT
  USING (role = 'doctor' AND is_active = true AND auth.role() = 'authenticated');
