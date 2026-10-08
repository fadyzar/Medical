-- Migration 021: honest attribution + Hebrew text for automatic status audits.
--
-- audit_apt_status() logged coalesce(auth.uid(), new.patient_id). Status
-- changes made by the server (service role: completing a consultation, the
-- payment webhook, cancellations through the API) have no auth.uid(), so they
-- were attributed to the PATIENT. Server routes write their own audit entry
-- with the real actor; this automatic entry now records no user ("system")
-- instead of a wrong one, and describes the change in Hebrew.

create or replace function appointment_status_he(s text) returns text
language sql immutable as $$
  select case s
    when 'draft' then 'טיוטה' when 'pending' then 'ממתין' when 'doctor_confirmed' then 'אושר ע"י הרופא'
    when 'time_selected' then 'נבחר מועד' when 'payment_pending' then 'ממתין לתשלום' when 'paid' then 'שולם'
    when 'scheduled' then 'מתוזמן' when 'ready' then 'מוכן' when 'in_progress' then 'בתהליך'
    when 'completed' then 'הושלם' when 'cancelled_patient' then 'בוטל ע"י המטופל'
    when 'cancelled_doctor' then 'בוטל ע"י המרפאה' when 'no_show_patient' then 'המטופל לא הגיע'
    when 'no_show_doctor' then 'הרופא לא הגיע' else s end
$$;

create or replace function audit_apt_status() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into audit_logs (organization_id, user_id, action, resource_type, resource_id, description, metadata)
  values (new.organization_id, auth.uid(), 'APPOINTMENT_STATUS_CHANGED', 'appointment', new.id,
    format('סטטוס התור: %s ← %s', appointment_status_he(old.status::text), appointment_status_he(new.status::text)),
    jsonb_build_object('old_status', old.status, 'new_status', new.status, 'by', case when auth.uid() is null then 'system' else 'user' end));
  return new;
end;
$$;
