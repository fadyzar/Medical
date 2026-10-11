-- Migration 023: move integration credentials out of organizations.settings again.
--
-- 018 moved integration_* blocks into organization_integrations (admin-only RLS),
-- but builds deployed before the sprint kept writing them back into
-- organizations.settings, which every member of the clinic can read (org_select).
-- This repeats 018's move for whatever was written since.
--
-- The settings copy is the newer one (the old UI wrote only there), so it wins,
-- unless it is blank.
-- Any value it replaces is kept under secrets->'_previous' so nothing is lost.
-- Re-runnable: after the first run there is nothing left to move.

with moved as (
  -- Only blocks holding at least one non-blank value. An empty form saved by an
  -- old build must never replace working credentials (see 025).
  select o.id as organization_id, jsonb_object_agg(e.key, e.value) as secrets
  from organizations o, jsonb_each(o.settings) e
  where e.key in ('integration_whatsapp','integration_payment','integration_email',
                  'integration_video','integration_invoice','integration_subdomain')
    and jsonb_typeof(e.value) = 'object'
    and exists (select 1 from jsonb_each_text(e.value) f where coalesce(trim(f.value), '') <> '')
  group by o.id
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
