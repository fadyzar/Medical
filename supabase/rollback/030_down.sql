-- Rollback for migration 030 (restores the 019 state; 030 changed no rows).
-- WARNING: this re-opens the anon read/write exposure of public_doctors.
drop function if exists public.appointment_doctors(uuid[]);
alter view public.public_doctors set (security_invoker = false);
grant select on public.public_doctors to anon, authenticated;
