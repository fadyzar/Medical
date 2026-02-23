-- ===============================================
-- Migration 004: Payments table + RLS
-- Stores payment transaction records from Tranzila
-- ===============================================

create table if not exists payments (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references organizations(id) not null,
  appointment_id uuid references appointments(id) not null,
  patient_id uuid references users(id) not null,
  amount numeric(10,2) not null check (amount >= 0),
  currency text not null default 'ILS',
  status payment_status not null default 'pending',
  provider text not null default 'tranzila',
  transaction_id text,
  confirmation_code text,
  idempotency_key text unique,
  masked_card text,
  response_code text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Indexes
create index idx_payments_org on payments(organization_id);
create index idx_payments_appointment on payments(appointment_id);
create index idx_payments_patient on payments(patient_id);
create index idx_payments_idempotency on payments(idempotency_key) where idempotency_key is not null;
create index idx_payments_status on payments(status);

-- Updated_at trigger
create trigger t_payments_updated before update on payments
  for each row execute function update_updated_at();

-- RLS
alter table payments enable row level security;

-- Patients can see their own payments
create policy "payments_patient_select" on payments
  for select using (patient_id = auth.uid());

-- Doctors can see payments for their appointments
create policy "payments_doctor_select" on payments
  for select using (
    exists(
      select 1 from appointments
      where id = payments.appointment_id
      and doctor_id = auth.uid()
    )
  );

-- Admin/staff can see all org payments
create policy "payments_staff_select" on payments
  for select using (
    organization_id = get_my_org_id()
    and get_my_role() in ('staff', 'admin')
  );

-- Only service role inserts payments (from webhook)
create policy "payments_insert" on payments
  for insert with check (true);

-- Admin can update payments (e.g. refunds)
create policy "payments_admin_update" on payments
  for update using (
    organization_id = get_my_org_id()
    and get_my_role() = 'admin'
  );
