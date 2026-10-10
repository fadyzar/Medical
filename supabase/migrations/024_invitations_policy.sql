-- Migration 024: invitations — read-only access for the clinic admin.
--
-- Production never received 015's policy, so the admin "pending invitations"
-- list was empty there. 015's policy was also too broad: FOR ALL including
-- staff, so a staff member could write invitation rows (e.g. role 'admin')
-- straight from the browser. Invitations are created and accepted only by the
-- server (service role), so clients need SELECT and nothing else.
-- Re-runnable.

drop policy if exists "admin can manage own org invitations" on invitations;
drop policy if exists "invitations_admin_select" on invitations;
create policy "invitations_admin_select" on invitations
  for select using (organization_id = get_my_org_id() and get_my_role() = 'admin');

create index if not exists invitations_organization_idx on invitations(organization_id);
create index if not exists invitations_email_idx        on invitations(email);
