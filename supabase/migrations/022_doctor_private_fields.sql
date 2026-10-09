-- Migration 022: stop exposing doctors' private fields to every signed-in user.
--
-- Policy "users_select_doctors" (013) let ANY authenticated user select whole
-- doctor rows in `users` — including id_number, license_number, phone, email,
-- date_of_birth, medical_history and insurance_info — across all clinics.
-- RLS cannot hide columns, so the row access itself is removed:
--   * patients and the public read doctor display data from the
--     `public_doctors` view (019), which carries only safe columns;
--   * clinic staff/admin keep in-clinic access ("users_select_org_staff", 019);
--   * a doctor keeps their own row ("users_select_own").
-- Requires 019. Re-runnable.

drop policy if exists "users_select_doctors" on users;
