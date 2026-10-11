-- Migration 025: restore integration credentials that 023 replaced with blanks.
--
-- 023 let the organizations.settings copy win. For one clinic that copy was an
-- empty form (every field ''), so the working Green API credentials were moved
-- to secrets->'_previous' and WhatsApp stopped finding them. This puts back any
-- integration block that is now entirely blank while its _previous copy has a
-- value. Blocks with any non-blank value are left alone.
-- Re-runnable: once restored, a block is no longer blank and nothing matches.

update organization_integrations oi
   set secrets = oi.secrets || r.restored,
       updated_at = now()
  from (
    select organization_id, jsonb_object_agg(k, secrets->'_previous'->k) as restored
      from organization_integrations,
           jsonb_object_keys(case when jsonb_typeof(secrets->'_previous') = 'object'
                                  then secrets->'_previous' else '{}'::jsonb end) k
     where jsonb_typeof(secrets->k) = 'object'
       and jsonb_typeof(secrets->'_previous'->k) = 'object'
       and not exists (select 1 from jsonb_each_text(secrets->k) f where coalesce(trim(f.value), '') <> '')
       and exists     (select 1 from jsonb_each_text(secrets->'_previous'->k) f where coalesce(trim(f.value), '') <> '')
     group by organization_id
  ) r
 where r.organization_id = oi.organization_id;
