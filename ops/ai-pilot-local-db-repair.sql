-- Repairs ~/Downloads/ai-pilot local dev DB (127.0.0.1:54322) after CANNA
-- migrations 001-010 were applied to it by mistake on 2026-10-08.
-- Removes ONLY objects CANNA created; restores ai-pilot's handle_new_user()
-- verbatim from 20260927000002_security_and_gamification.sql.
begin;

drop table if exists public.leads, public.payments, public.audit_logs, public.ai_conversations,
  public.notifications, public.questionnaire_responses, public.questionnaires, public.documents,
  public.appointments, public.users, public.organizations cascade;

drop function if exists public.audit_apt_status() cascade;
drop function if exists public.track_appointment_status() cascade;
drop function if exists public.update_doctor_stats() cascade;
drop function if exists public.update_leads_updated_at() cascade;
drop function if exists public.update_updated_at() cascade;
drop function if exists public.get_my_org_id() cascade;
drop function if exists public.get_my_role() cascade;

drop type if exists public.appointment_status, public.gender_type, public.notification_status,
  public.notification_type, public.organization_plan, public.payment_status,
  public.subscription_status, public.user_role;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), ''))
  on conflict (id) do nothing;
  insert into public.user_stats (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
revoke execute on function public.handle_new_user() from public, anon, authenticated;

delete from supabase_migrations.schema_migrations
 where version in ('001','002','003','004','005','006','007','008','009','010');

commit;
