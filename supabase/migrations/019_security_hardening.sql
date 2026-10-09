-- ===============================================
-- 019: Security hardening — privilege escalation, tenant isolation, double-booking
-- ===============================================
-- Every item below is exploitable on the current schema from a browser console
-- using only the public anon key. Run this before any real clinic data exists.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Signup could grant any role in any organization
--
-- handle_new_user() read `role` and `organization_id` straight out of
-- raw_user_meta_data, which is supplied by the client calling auth.signUp().
-- Combined with the public /api/org/by-subdomain endpoint (which returns an
-- org's UUID to anyone), this let anyone register as an admin of any clinic
-- and then read every patient record in it.
--
-- Fix: self-service signup is ALWAYS a patient. Elevated roles are granted only
-- by /api/auth/invite-accept, which validates a single-use token server-side
-- with the service role. organization_id stays client-supplied — choosing which
-- clinic to register with is legitimate — and is now safe because step 3 stops
-- org membership from exposing other members.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function handle_new_user() returns trigger as $$
declare
  v_org_id uuid;
  v_first  text;
  v_last   text;
begin
  v_first := coalesce(new.raw_user_meta_data->>'first_name', split_part(new.email, '@', 1), '');
  v_last  := coalesce(new.raw_user_meta_data->>'last_name', '');

  begin
    v_org_id := (new.raw_user_meta_data->>'organization_id')::uuid;
  exception when others then
    v_org_id := null;
  end;

  -- Only accept an organization that actually exists.
  if v_org_id is not null and not exists (select 1 from organizations where id = v_org_id) then
    v_org_id := null;
  end if;

  -- Previously this fell back to `select id from organizations order by created_at
  -- limit 1`, which silently dropped every org-less signup into whichever clinic
  -- happened to be oldest. Pin the explicit default org instead, and leave it null
  -- if that row is gone — booking assigns the clinic anyway.
  if v_org_id is null then
    select id into v_org_id from organizations
    where id = '00000000-0000-0000-0000-000000000001';
  end if;

  begin
    insert into public.users (id, organization_id, email, first_name, last_name, role)
    values (new.id, v_org_id, new.email, v_first, v_last, 'patient')
    on conflict (id) do nothing;
  exception when others then
    raise warning 'handle_new_user failed for %: %', new.id, sqlerrm;
  end;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Users could promote themselves
--
-- "users_update_own" was `for update using (id = auth.uid())` with no WITH CHECK.
-- Postgres defaults WITH CHECK to the USING expression, so the only constraint on
-- the NEW row was that it still belonged to the caller — leaving role and
-- organization_id freely writable. Any logged-in patient could run
--   supabase.from('users').update({ role: 'admin' }).eq('id', <self>)
-- and own the tenant.
--
-- Fix: pin role and organization_id to their current values. get_my_role() and
-- get_my_org_id() are SECURITY DEFINER + STABLE, so inside this statement they
-- still read the pre-update row — i.e. "must not change".
-- ─────────────────────────────────────────────────────────────────────────────
drop policy if exists "users_update_own" on users;
create policy "users_update_own" on users
  for update
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and role = get_my_role()
    and organization_id is not distinct from get_my_org_id()
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Every clinic member could read every other member's medical record
--
-- "users_select_org" was `using (organization_id = get_my_org_id())` with no role
-- restriction, and the users table holds id_number, date_of_birth,
-- medical_history, insurance_info and emergency_contact. One
--   supabase.from('users').select('*')
-- as any logged-in patient returned every other patient's full record.
--
-- Fix: staff and admin keep the member list they need; a doctor sees only the
-- patients they actually treat; everyone else sees just themselves (via the
-- existing users_select_own).
-- ─────────────────────────────────────────────────────────────────────────────
drop policy if exists "users_select_org" on users;

drop policy if exists "users_select_org_staff" on users;
create policy "users_select_org_staff" on users
  for select using (
    organization_id = get_my_org_id()
    and get_my_role() in ('staff', 'admin')
  );

drop policy if exists "users_select_own_patients" on users;
create policy "users_select_own_patients" on users
  for select using (
    get_my_role() = 'doctor'
    and exists (
      select 1 from appointments a
      where a.doctor_id = auth.uid() and a.patient_id = users.id
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Doctor rows were readable in full, across every tenant
--
-- "users_select_doctors" (013) is `role = 'doctor' and is_active and
-- auth.role() = 'authenticated'` — no column limit and no org limit, so any
-- logged-in user could read doctors' license_number, id_number, phone and
-- medical_history. Cross-org visibility is deliberate (marketplace booking), the
-- column exposure is not, and RLS cannot restrict columns.
--
-- Fix (partial): browsing doctors now goes through a view exposing only the
-- public booking columns, so the marketplace list no longer pulls whole rows.
--
-- The row policy itself has to stay: patient-facing screens read the doctor
-- through PostgREST embeds (appointments -> doctor:doctor_id(...)), which resolve
-- against the users TABLE, not the view. Dropping it would blank out the doctor's
-- name on the patient's appointment list, payment page and video call.
--
-- Residual risk, accepted for now: an authenticated user can still select any
-- column of a *doctor* row (license_number, id_number, phone). Postgres RLS is
-- row-level only, and column GRANTs cannot help because admins, staff, doctors and
-- patients are all the same `authenticated` role. The real fix is to move doctor
-- PII out of users into a private table; tracked in TODO.md.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace view public_doctors
with (security_invoker = false) as
  select
    id, organization_id, first_name, last_name, avatar_url,
    specialties, bio, languages, consultation_price,
    average_rating, total_ratings, availability, metadata
  from users
  where role = 'doctor' and is_active = true;

grant select on public_doctors to authenticated, anon;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Two patients could book the same slot
--
-- Free slots were computed read-side in /api/appointments/available-slots with
-- nothing enforcing the result at write time, so two patients holding the same
-- slot list both succeeded. Enforce it in the database: one live appointment per
-- doctor per instant. Cancelled/no-show rows are excluded so a freed slot can be
-- rebooked.
-- ─────────────────────────────────────────────────────────────────────────────
create unique index if not exists appointments_doctor_slot_unique
  on appointments (doctor_id, scheduled_at)
  where scheduled_at is not null
    and doctor_id is not null
    and status not in (
      'draft', 'cancelled_patient', 'cancelled_doctor',
      'no_show_patient', 'no_show_doctor', 'completed'
    );
