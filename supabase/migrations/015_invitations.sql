-- ===============================================
-- INVITATIONS — Invite-only registration for doctors/staff/admin
-- ===============================================

create table if not exists invitations (
  id             uuid primary key default uuid_generate_v4(),
  token          uuid unique not null default uuid_generate_v4(),
  organization_id uuid references organizations(id) on delete cascade not null,
  email          text not null,
  role           user_role not null,
  invited_by     uuid references users(id) on delete set null,
  first_name     text,             -- optional pre-fill
  last_name      text,             -- optional pre-fill
  expires_at     timestamptz not null default (now() + interval '7 days'),
  used_at        timestamptz,
  created_at     timestamptz default now()
);

-- Indexes
create index if not exists invitations_token_idx          on invitations(token);
create index if not exists invitations_organization_idx   on invitations(organization_id);
create index if not exists invitations_email_idx          on invitations(email);

-- RLS
alter table invitations enable row level security;

-- Admins of the org can see/create invitations for their org
create policy "admin can manage own org invitations"
  on invitations
  using (
    organization_id = get_my_org_id()
    and get_my_role() in ('admin', 'staff')
  );

-- Public read by token — used for the invite acceptance page (checked server-side with service role)
-- No public policy needed; API routes use service role to validate token
