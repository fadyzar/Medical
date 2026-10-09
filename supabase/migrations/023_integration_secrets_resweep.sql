-- Migration 023: move integration credentials out of organizations.settings again.
--
-- 018 moved integration_* blocks into organization_integrations (admin-only RLS),
-- but builds deployed before the sprint kept writing them back into
-- organizations.settings, which every member of the clinic can read (org_select).
-- This repeats 018's move for whatever was written since.
--
-- The settings copy is the newer one (the old UI wrote only there), so it wins.
-- Any value it replaces is kept under secrets->'_previous' so nothing is lost.
-- Re-runnable: after the first run there is nothing left to move.

with moved as (
  select id as organization_id, jsonb_strip_nulls(jsonb_build_object(
      'integration_whatsapp',  settings->'integration_whatsapp',
      'integration_payment',   settings->'integration_payment',
      'integration_email',     settings->'integration_email',
      'integration_video',     settings->'integration_video',
      'integration_invoice',   settings->'integration_invoice',
      'integration_subdomain', settings->'integration_subdomain'
    )) as secrets
  from organizations
  where settings ?| array['integration_whatsapp','integration_payment','integration_email',
                          'integration_video','integration_invoice','integration_subdomain']
)
insert into organization_integrations (organization_id, secrets)
select organization_id, secrets from moved
on conflict (organization_id) do update
  set secrets = organization_integrations.secrets || excluded.secrets || coalesce((
        select jsonb_build_object('_previous',
                 coalesce(organization_integrations.secrets->'_previous', '{}'::jsonb)
                 || jsonb_object_agg(k, organization_integrations.secrets->k))
        from jsonb_object_keys(excluded.secrets) k
        where organization_integrations.secrets ? k
          and organization_integrations.secrets->k is distinct from excluded.secrets->k
      ), '{}'::jsonb),
      updated_at = now();

update organizations set settings = settings
    - 'integration_whatsapp'
    - 'integration_payment'
    - 'integration_email'
    - 'integration_video'
    - 'integration_invoice'
    - 'integration_subdomain'
where settings ?| array['integration_whatsapp','integration_payment','integration_email',
                        'integration_video','integration_invoice','integration_subdomain'];
