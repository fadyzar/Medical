-- Migration 026: storage policies scoped to the clinic and the owner.
--
-- 011's policies for the private `medical-documents` bucket checked only
-- `auth.role() = 'authenticated'`. Registration is open, so any signed-in user,
-- of any clinic, could list, download and delete every medical file. `logos`
-- and `org-assets` let any signed-in user overwrite or delete another clinic's
-- files, and `avatars` let anyone write into another clinic's branding folder.
--
-- medical-documents paths are `<organization_id>/<patient_id>/...` (uploads in
-- lib/supabase/storage.ts and new-appointment) or `questionnaires/<user_id>/...`.
--   read:   the owner; doctors/staff/admins of the clinic in the first segment
--   write:  the owner only, into their own clinic or a clinic they have an
--           appointment with (marketplace bookings store files under the
--           appointment's clinic)
-- Signed URLs are created with the caller's session, so these rules also govern
-- every "view document" button. Re-runnable.

-- ── medical-documents ───────────────────────────────────────────────
drop policy if exists "docs_auth_select" on storage.objects;
drop policy if exists "docs_auth_insert" on storage.objects;
drop policy if exists "docs_auth_delete" on storage.objects;
drop policy if exists "docs_select_scoped" on storage.objects;
drop policy if exists "docs_insert_owner" on storage.objects;
drop policy if exists "docs_delete_owner" on storage.objects;

create policy "docs_select_scoped" on storage.objects for select using (
  bucket_id = 'medical-documents' and (
    (storage.foldername(name))[2] = auth.uid()::text
    or (
      (storage.foldername(name))[1] = public.get_my_org_id()::text
      and public.get_my_role() in ('doctor', 'staff', 'admin')
    )
  )
);

create policy "docs_insert_owner" on storage.objects for insert with check (
  bucket_id = 'medical-documents'
  and (storage.foldername(name))[2] = auth.uid()::text
  and (
    (storage.foldername(name))[1] = 'questionnaires'
    or (storage.foldername(name))[1] = public.get_my_org_id()::text
    or exists (
      select 1 from public.appointments a
      where a.patient_id = auth.uid()
        and a.organization_id::text = (storage.foldername(name))[1]
    )
  )
);

create policy "docs_delete_owner" on storage.objects for delete using (
  bucket_id = 'medical-documents'
  and (storage.foldername(name))[2] = auth.uid()::text
);

-- ── avatars (profile pictures and clinic branding) ──────────────────
-- Paths: avatars/<org>/<user>.<ext> and branding/<org>/logo.<ext> (upsert).
-- 011 compared the user id with the org segment, so replacing a picture never
-- worked, and inserts were open to any path.
drop policy if exists "avatars_auth_insert" on storage.objects;
drop policy if exists "avatars_owner_update" on storage.objects;
drop policy if exists "avatars_owner_delete" on storage.objects;
drop policy if exists "avatars_write_scoped" on storage.objects;
drop policy if exists "avatars_update_scoped" on storage.objects;
drop policy if exists "avatars_delete_scoped" on storage.objects;

create policy "avatars_write_scoped" on storage.objects for insert with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[2] = public.get_my_org_id()::text
  and (
    ((storage.foldername(name))[1] = 'avatars' and split_part(storage.filename(name), '.', 1) = auth.uid()::text)
    or ((storage.foldername(name))[1] = 'branding' and public.get_my_role() = 'admin')
  )
);

create policy "avatars_update_scoped" on storage.objects for update using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[2] = public.get_my_org_id()::text
  and (
    ((storage.foldername(name))[1] = 'avatars' and split_part(storage.filename(name), '.', 1) = auth.uid()::text)
    or ((storage.foldername(name))[1] = 'branding' and public.get_my_role() = 'admin')
  )
);

create policy "avatars_delete_scoped" on storage.objects for delete using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[2] = public.get_my_org_id()::text
  and (
    ((storage.foldername(name))[1] = 'avatars' and split_part(storage.filename(name), '.', 1) = auth.uid()::text)
    or ((storage.foldername(name))[1] = 'branding' and public.get_my_role() = 'admin')
  )
);

-- ── logos / org-assets: insert-only for clients ─────────────────────
-- Logos get a unique random name at upload and are never replaced in place,
-- so no client needs to update or delete them.
drop policy if exists "logos_auth_update" on storage.objects;
drop policy if exists "logos_auth_delete" on storage.objects;
drop policy if exists "org_assets_auth_update" on storage.objects;
