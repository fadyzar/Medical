-- ===============================================
-- SCHEMA v3 — Production Ready
-- CHECKLIST: users.id refs auth.users, constraints, indexes
-- ===============================================

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- Enums
create type user_role as enum ('patient','doctor','staff','admin');
create type gender_type as enum ('male','female','other','prefer_not_to_say');
create type organization_plan as enum ('free','basic','pro','enterprise');
create type subscription_status as enum ('active','trial','suspended','cancelled');
create type appointment_status as enum (
  'draft','pending','doctor_confirmed','time_selected',
  'payment_pending','paid','scheduled','ready',
  'in_progress','completed','cancelled_patient',
  'cancelled_doctor','no_show_patient','no_show_doctor'
);
create type payment_status as enum ('pending','processing','completed','failed','refunded');
create type notification_type as enum ('whatsapp','sms','email','push');
create type notification_status as enum ('pending','sent','delivered','read','failed');

-- ===============================================
-- ORGANIZATIONS (multi-tenant root)
-- ===============================================
create table organizations (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  subdomain text unique not null,
  slug text unique not null,
  custom_domain text unique,
  contact_email text,
  contact_phone text,
  logo_url text,
  primary_color text default '#0EA5E9',
  secondary_color text default '#8B5CF6',
  plan organization_plan default 'free',
  subscription_status subscription_status default 'trial',
  trial_ends_at timestamptz default (now() + interval '14 days'),
  stripe_customer_id text,
  stripe_subscription_id text,
  features jsonb default '{
    "ai_summaries":true,"ai_triage":false,"ai_prescription_draft":false,
    "video_calls":true,"whatsapp_notifications":true,"sms_notifications":false,
    "email_notifications":true,"smart_questionnaires":true,
    "document_storage":true,"document_ocr":false,
    "analytics":false,"custom_branding":false,"api_access":false
  }'::jsonb,
  max_doctors int default 3,
  max_appointments_per_month int default 100,
  max_storage_gb numeric(10,2) default 10,
  current_doctors int default 0,
  current_month_appointments int default 0,
  current_storage_gb numeric(10,2) default 0,
  settings jsonb default '{
    "timezone":"Asia/Jerusalem","locale":"he-IL","currency":"ILS",
    "working_hours":{"start":"08:00","end":"20:00"},
    "appointment_duration_default":30,
    "appointment_buffer_minutes":15,
    "cancellation_policy_hours":24,
    "auto_reminder_24h":true,"auto_reminder_1h":true
  }'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ===============================================
-- USERS  *** CRITICAL: references auth.users ***
-- ===============================================
create table users (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid references organizations(id) not null,
  email text unique not null,
  phone text,
  role user_role not null default 'patient',
  is_active boolean default true,
  first_name text not null,
  last_name text not null,
  date_of_birth date,
  gender gender_type,
  id_number text,
  avatar_url text,
  -- Doctor fields
  license_number text,
  specialties text[],
  bio text,
  languages text[] default array['עברית'],
  consultation_price numeric(10,2),
  availability jsonb default '[]'::jsonb,
  total_appointments int default 0,
  average_rating numeric(3,2),
  total_ratings int default 0,
  -- Patient fields
  medical_history jsonb default '{"allergies":[],"chronic_conditions":[],"current_medications":[],"past_surgeries":[]}'::jsonb,
  emergency_contact jsonb default '{}'::jsonb,
  insurance_info jsonb default '{}'::jsonb,
  -- Meta
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  last_login_at timestamptz,
  constraint valid_doctor check (role != 'doctor' or license_number is not null),
  constraint valid_price check (consultation_price is null or consultation_price > 0)
);

-- ===============================================
-- APPOINTMENTS
-- ===============================================
create table appointments (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references organizations(id) not null,
  patient_id uuid references users(id) not null,
  doctor_id uuid references users(id),
  requested_specialty text,
  chief_complaint text not null,
  complaint_description text,
  urgency_level text default 'routine' check (urgency_level in ('routine','soon','urgent')),
  preferred_times jsonb,
  status appointment_status default 'pending',
  status_history jsonb default '[]'::jsonb,
  -- AI triage
  ai_triage_score numeric(5,2),
  ai_triage_category text,
  ai_triage_reasoning text,
  ai_triage_at timestamptz,
  -- Scheduling
  requested_at timestamptz default now(),
  doctor_accepted_at timestamptz,
  time_selected_at timestamptz,
  scheduled_at timestamptz,
  duration_minutes int default 30,
  -- Payment
  payment_amount numeric(10,2),
  payment_status payment_status,
  payment_transaction_id text,
  payment_completed_at timestamptz,
  payment_method text,
  payment_idempotency_key text unique,
  -- Video
  video_room_id text,
  video_room_name text,
  video_started_at timestamptz,
  video_ended_at timestamptz,
  video_duration_seconds int,
  -- Clinical (SOAP)
  subjective_notes text,
  objective_notes text,
  assessment text,
  plan text,
  doctor_notes text,
  diagnosis text,
  diagnosis_codes text[],
  treatment_plan text,
  medications_prescribed jsonb,
  follow_up_instructions text,
  follow_up_date date,
  -- AI
  ai_summary text,
  ai_summary_generated_at timestamptz,
  ai_prescription_draft text,
  ai_follow_up_suggestions jsonb,
  ai_used boolean default false,
  -- Completion
  completed_at timestamptz,
  patient_rating int check (patient_rating between 1 and 5),
  patient_feedback text,
  -- Cancel
  cancelled_at timestamptz,
  cancelled_by uuid references users(id),
  cancellation_reason text,
  refund_status text,
  -- No-show / Reminders
  no_show_recorded_at timestamptz,
  reminder_24h_sent_at timestamptz,
  reminder_1h_sent_at timestamptz,
  -- Metrics
  response_time_hours numeric(10,2),
  wait_time_minutes numeric(10,2),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ===============================================
-- DOCUMENTS
-- ===============================================
create table documents (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references organizations(id) not null,
  patient_id uuid references users(id) not null,
  appointment_id uuid references appointments(id),
  uploaded_by uuid references users(id) not null,
  file_name text not null,
  file_type text not null,
  file_size_bytes bigint not null check (file_size_bytes > 0),
  storage_path text not null,
  document_type text,
  category text,
  tags text[],
  ocr_text text,
  ocr_confidence numeric(5,2),
  analyzed_at timestamptz,
  ai_classification text,
  is_verified boolean default false,
  verified_by uuid references users(id),
  verified_at timestamptz,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ===============================================
-- QUESTIONNAIRES
-- ===============================================
create table questionnaires (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references organizations(id),
  title text not null,
  description text,
  questions jsonb not null,
  is_template boolean default false,
  is_active boolean default true,
  is_published boolean default false,
  specialties text[],
  conditions text[],
  times_used int default 0,
  average_completion_time_seconds int,
  created_by uuid references users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table questionnaire_responses (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references organizations(id) not null,
  questionnaire_id uuid references questionnaires(id) not null,
  appointment_id uuid references appointments(id),
  patient_id uuid references users(id) not null,
  responses jsonb not null,
  is_complete boolean default false,
  started_at timestamptz default now(),
  completed_at timestamptz,
  time_taken_seconds int,
  score numeric(10,2),
  risk_level text check (risk_level in ('low','medium','high','critical')),
  ai_analysis text,
  ai_recommendations jsonb,
  created_at timestamptz default now()
);

-- ===============================================
-- NOTIFICATIONS
-- ===============================================
create table notifications (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references organizations(id) not null,
  user_id uuid references users(id) not null,
  appointment_id uuid references appointments(id),
  type notification_type not null,
  template_name text,
  content text not null,
  variables jsonb,
  recipient_phone text,
  recipient_email text,
  status notification_status default 'pending',
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  failed_at timestamptz,
  error_message text,
  retry_count int default 0,
  provider text,
  external_id text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- ===============================================
-- AI CONVERSATIONS (billing + audit)
-- ===============================================
create table ai_conversations (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references organizations(id) not null,
  user_id uuid references users(id) not null,
  appointment_id uuid references appointments(id),
  agent_type text not null check (agent_type in ('triage','intake','summary','prescription_draft','follow_up','general')),
  messages jsonb not null default '[]'::jsonb,
  result jsonb,
  is_complete boolean default false,
  input_tokens int default 0,
  output_tokens int default 0,
  model_used text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ===============================================
-- AUDIT LOGS (HIPAA)
-- ===============================================
create table audit_logs (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references organizations(id) not null,
  user_id uuid references users(id),
  user_email text,
  user_role text,
  action text not null,
  resource_type text not null,
  resource_id uuid,
  description text,
  metadata jsonb default '{}'::jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz default now()
);

-- ===============================================
-- STORAGE BUCKETS (Supabase Storage)
-- ===============================================
-- Run via Supabase Dashboard or SQL:
-- insert into storage.buckets (id, name, public) values ('medical-documents', 'medical-documents', false);
-- insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true);
-- insert into storage.buckets (id, name, public) values ('org-assets', 'org-assets', true);

-- ===============================================
-- INDEXES
-- ===============================================
create index idx_orgs_subdomain on organizations(subdomain);
create index idx_orgs_slug on organizations(slug);
create index idx_orgs_custom_domain on organizations(custom_domain) where custom_domain is not null;
create unique index idx_users_email on users(email);
create index idx_users_org on users(organization_id);
create index idx_users_role on users(role);
create index idx_users_org_role on users(organization_id, role);
create index idx_users_doctor_specialties on users using gin(specialties) where role = 'doctor';
create index idx_apt_org on appointments(organization_id);
create index idx_apt_patient on appointments(patient_id);
create index idx_apt_doctor on appointments(doctor_id);
create index idx_apt_status on appointments(status);
create index idx_apt_scheduled on appointments(scheduled_at) where scheduled_at is not null;
create index idx_apt_created on appointments(created_at desc);
create index idx_apt_org_status on appointments(organization_id, status);
create index idx_apt_idempotency on appointments(payment_idempotency_key) where payment_idempotency_key is not null;
create index idx_docs_patient on documents(patient_id);
create index idx_docs_apt on documents(appointment_id);
create index idx_notif_user on notifications(user_id);
create index idx_notif_pending on notifications(status, created_at) where status = 'pending';
create index idx_ai_conv_apt on ai_conversations(appointment_id);
create index idx_audit_org on audit_logs(organization_id);
create index idx_audit_created on audit_logs(created_at desc);

-- ===============================================
-- TRIGGERS
-- ===============================================
create or replace function update_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

create trigger t_orgs_updated before update on organizations for each row execute function update_updated_at();
create trigger t_users_updated before update on users for each row execute function update_updated_at();
create trigger t_apt_updated before update on appointments for each row execute function update_updated_at();
create trigger t_docs_updated before update on documents for each row execute function update_updated_at();
create trigger t_quest_updated before update on questionnaires for each row execute function update_updated_at();

-- Auto-create user profile on signup
create or replace function handle_new_user() returns trigger as $$
begin
  insert into public.users (id, organization_id, email, first_name, last_name, role)
  values (
    new.id,
    coalesce((new.raw_user_meta_data->>'organization_id')::uuid, (select id from organizations order by created_at limit 1)),
    new.email,
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'last_name', ''),
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'patient')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- Track appointment status changes
create or replace function track_appointment_status() returns trigger as $$
begin
  if old.status is distinct from new.status then
    new.status_history = coalesce(old.status_history, '[]'::jsonb) || jsonb_build_object(
      'from', old.status, 'to', new.status, 'at', now(), 'by', auth.uid()
    );
  end if;
  return new;
end;
$$ language plpgsql;

create trigger t_apt_status_track before update on appointments
  for each row when (old.status is distinct from new.status)
  execute function track_appointment_status();

-- Update doctor stats on completion
create or replace function update_doctor_stats() returns trigger as $$
begin
  if new.status = 'completed' and old.status != 'completed' and new.doctor_id is not null then
    update users set
      total_appointments = total_appointments + 1,
      average_rating = (select coalesce(avg(patient_rating),0) from appointments where doctor_id = new.doctor_id and patient_rating is not null),
      total_ratings = (select count(*) from appointments where doctor_id = new.doctor_id and patient_rating is not null)
    where id = new.doctor_id;
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger t_doctor_stats after update on appointments
  for each row when (new.status = 'completed' and old.status != 'completed')
  execute function update_doctor_stats();

-- Audit: appointment status changes
create or replace function audit_apt_status() returns trigger as $$
begin
  insert into audit_logs (organization_id, user_id, action, resource_type, resource_id, description, metadata)
  values (new.organization_id, coalesce(auth.uid(), new.patient_id), 'APPOINTMENT_STATUS_CHANGED', 'appointment', new.id,
    format('Status: %s → %s', old.status, new.status),
    jsonb_build_object('old_status', old.status, 'new_status', new.status));
  return new;
end;
$$ language plpgsql security definer;

create trigger t_audit_apt_status after update on appointments
  for each row when (old.status is distinct from new.status)
  execute function audit_apt_status();
