-- CANNA production: migration 032 (enum values only; additive, no row changes).
-- ALTER TYPE ... ADD VALUE commits on its own; run WITHOUT --single-transaction.
\ir ../../../supabase/migrations/032_appointment_approval_statuses.sql
select enum_range(null::public.appointment_status);
