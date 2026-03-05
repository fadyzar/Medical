-- ===============================================
-- Migration 006: Tighten notification insert policy
-- Previously: with check (true) — any user could insert
-- Now: restrict to own org only
-- ===============================================

-- Drop the overly permissive policy
drop policy if exists "notif_insert" on notifications;

-- Notifications can only be inserted for users within the same organization.
-- Server-side inserts use service role which bypasses RLS entirely.
-- This policy only affects authenticated client-side inserts.
create policy "notif_insert" on notifications
  for insert
  with check (
    organization_id = get_my_org_id()
  );
