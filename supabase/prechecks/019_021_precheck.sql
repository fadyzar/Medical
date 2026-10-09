-- READ-ONLY pre-check before running migrations 019, 020, 021 in production.
-- Run in the Supabase SQL editor. Every query must return 0 rows / true before
-- applying the migrations. Nothing here writes.

-- 1) 019 creates a UNIQUE index on (doctor_id, scheduled_at) for active
--    appointments. Any existing double booking makes the migration fail.
select doctor_id, scheduled_at, count(*) as active_bookings, array_agg(id) as appointment_ids
from appointments
where scheduled_at is not null and doctor_id is not null
  and status not in ('draft','cancelled_patient','cancelled_doctor','no_show_patient','no_show_doctor','completed')
group by doctor_id, scheduled_at
having count(*) > 1;

-- 2) 019's signup trigger pins org-less signups to the default organization.
select exists (select 1 from organizations where id = '00000000-0000-0000-0000-000000000001') as default_org_exists;

-- 3) 020 replaces the agent_type CHECK; existing rows must already be valid.
select agent_type, count(*) from ai_conversations
where agent_type not in ('triage','intake','summary','prescription_draft','follow_up','general','brief','document_generator')
group by agent_type;

-- 4) Context: how many users each new users-table policy affects (informational).
select role, count(*) from users group by role order by role;
