-- Rollback for migration 033 (and the code that uses 032's statuses).
-- Removes the guard trigger and approve/reject functions and restores the
-- 019 slot index. Keeps the added columns and their data (approval history is
-- audit-relevant). Rows already in pending_approval / confirmed / rejected keep
-- those statuses: decide per row before rolling back code that cannot show them.
begin;
drop trigger if exists t_apt_guard_client_writes on public.appointments;
drop function if exists public.guard_appointment_client_writes();
drop function if exists public.approve_appointment(uuid, uuid, int);
drop function if exists public.reject_appointment(uuid, uuid, text);
drop function if exists public.appointment_holds_doctor_time(public.appointment_status);
drop index if exists public.appointments_doctor_pending_approval;
drop index if exists public.appointments_doctor_slot_unique;
create unique index appointments_doctor_slot_unique
  on public.appointments (doctor_id, scheduled_at)
  where scheduled_at is not null and doctor_id is not null
    and status not in ('draft','cancelled_patient','cancelled_doctor','no_show_patient','no_show_doctor','completed');
commit;
