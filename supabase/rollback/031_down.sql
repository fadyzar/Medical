-- Rollback for 031_patient_invitations.sql. Changes no data rows: memberships
-- and invitations made while 031 was live are kept. The added invitation
-- columns are left in place (dropping them would destroy revoke/accept history);
-- the 030-era code simply ignores them.

drop function if exists public.accept_patient_invitation(uuid, uuid);
drop function if exists public.claim_patient_clinic(uuid, uuid);
drop function if exists public.transfer_patient_clinic(uuid, uuid, uuid, text);
drop trigger if exists t_patient_single_clinic on public.users;
drop function if exists public.enforce_patient_single_clinic();
drop index if exists public.invitations_one_live_patient;

-- handle_new_user() as of migration 019 (client-chosen organization accepted).
create or replace function public.handle_new_user() returns trigger as $$
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
  if v_org_id is not null and not exists (select 1 from organizations where id = v_org_id) then
    v_org_id := null;
  end if;
  if v_org_id is null then
    select id into v_org_id from organizations where id = '00000000-0000-0000-0000-000000000001';
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
