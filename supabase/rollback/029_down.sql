-- Rollback for migration 029 (no data to restore: 029 changes no rows).
drop trigger if exists t_apt_doctor_same_org on public.appointments;
drop function if exists public.enforce_appointment_doctor_org();
