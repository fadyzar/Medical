-- Migration 030: close direct database access to doctor display data.
--
-- public_doctors (019) is a view owned by postgres with security_invoker = false
-- and carried Supabase's default grants: anon and authenticated had SELECT,
-- INSERT, UPDATE and DELETE. Because the view runs as its owner, RLS on users
-- did not apply, so through the REST API:
--   * anyone could list every clinic's doctors, bypassing clinic isolation;
--   * anyone (no login) could UPDATE doctor rows via the view — price, bio,
--     availability, ratings — and DELETE doctors with no appointments.
--
-- Doctor data now reaches browsers only through the server, which decides the
-- clinic from the request host and the verified session:
--   * public pages and GET /api/doctors (service role, server-side scope);
--   * appointment_doctors(uuid[]) below — display fields of doctors the caller
--     is actually related to (their appointments, themselves, their clinic).
--
-- No rows are changed. Re-runnable. Rollback: supabase/rollback/030_down.sql.

revoke all on public.public_doctors from anon, authenticated, public;
-- Defence in depth: if a grant ever comes back, users' RLS applies again.
alter view public.public_doctors set (security_invoker = true);

create or replace function public.appointment_doctors(doctor_ids uuid[])
returns table (
  id uuid,
  first_name text,
  last_name text,
  avatar_url text,
  specialties text[],
  consultation_price numeric,
  average_rating numeric,
  total_ratings integer
)
language sql
stable
security definer
set search_path = public
as $$
  select d.id, d.first_name, d.last_name, d.avatar_url, d.specialties,
         d.consultation_price, d.average_rating, d.total_ratings
  from users d
  where auth.uid() is not null
    and d.role = 'doctor'
    and d.id = any(doctor_ids)
    and (
      d.id = auth.uid()
      or exists (select 1 from appointments a where a.doctor_id = d.id and a.patient_id = auth.uid())
      or (d.organization_id = get_my_org_id() and get_my_role() in ('staff', 'admin', 'doctor'))
    )
$$;

revoke all on function public.appointment_doctors(uuid[]) from public, anon;
grant execute on function public.appointment_doctors(uuid[]) to authenticated;
