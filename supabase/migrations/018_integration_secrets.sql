-- 018: Separate integration secrets from organizations.settings (security fix)
--
-- Problem: the RLS policy "org_select" (id = get_my_org_id()) is role-agnostic, so any
-- organization member (patient/doctor/staff) could SELECT the organizations row and read
-- integration credentials stored in organizations.settings (e.g. Green API token).
--
-- Fix: store integration credentials in a dedicated table with ADMIN-ONLY RLS, and strip
-- the integration_* keys out of organizations.settings. Runtime resolvers use the service
-- role (bypasses RLS), so behavior is unchanged. Non-sensitive settings (timezone,
-- working hours, cancellation policy, branding, subdomain/domain state) stay on the
-- organizations row and remain readable by org members as before.

create table if not exists organization_integrations (
  organization_id uuid primary key references organizations(id) on delete cascade,
  secrets jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table organization_integrations enable row level security;

-- Only the org's admin can read or write its integration secrets.
drop policy if exists "oi_admin_select" on organization_integrations;
create policy "oi_admin_select" on organization_integrations
  for select using (organization_id = get_my_org_id() and get_my_role() = 'admin');

drop policy if exists "oi_admin_write" on organization_integrations;
create policy "oi_admin_write" on organization_integrations
  for all using (organization_id = get_my_org_id() and get_my_role() = 'admin')
  with check (organization_id = get_my_org_id() and get_my_role() = 'admin');

-- ── Migrate any existing integration_* blocks out of organizations.settings ──
-- Preserve whatever was stored (nothing is lost) into the admin-only table.
insert into organization_integrations (organization_id, secrets)
select id, jsonb_strip_nulls(jsonb_build_object(
    'integration_whatsapp', settings->'integration_whatsapp',
    'integration_payment',  settings->'integration_payment',
    'integration_email',    settings->'integration_email',
    'integration_video',    settings->'integration_video',
    'integration_invoice',  settings->'integration_invoice',
    'integration_subdomain', settings->'integration_subdomain'
  ))
from organizations
where settings ?| array['integration_whatsapp','integration_payment','integration_email',
                        'integration_video','integration_invoice','integration_subdomain']
on conflict (organization_id) do update
  set secrets = organization_integrations.secrets || excluded.secrets,
      updated_at = now();

-- Remove the integration_* keys from settings so they are no longer exposed via org_select.
update organizations set settings = settings
    - 'integration_whatsapp'
    - 'integration_payment'
    - 'integration_email'
    - 'integration_video'
    - 'integration_invoice'
    - 'integration_subdomain'
where settings ?| array['integration_whatsapp','integration_payment','integration_email',
                        'integration_video','integration_invoice','integration_subdomain'];
