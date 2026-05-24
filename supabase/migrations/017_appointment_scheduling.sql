-- Doctor can propose an alternative time to the patient
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS doctor_proposed_at timestamptz,
  ADD COLUMN IF NOT EXISTS patient_confirmed_proposed_at timestamptz;
