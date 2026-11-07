-- Rolled-back check of migration 029 in production. Writes nothing.
begin;
do $$ declare doc uuid; doc_org uuid; other_org uuid; pat uuid; begin
  select id, organization_id into doc, doc_org from users where role='doctor' and is_active limit 1;
  select id into other_org from organizations where id <> doc_org limit 1;
  select id into pat from users where role='patient' limit 1;
  begin
    insert into appointments(organization_id, patient_id, doctor_id, requested_specialty, chief_complaint, status)
    values (other_org, pat, doc, 'general', 'rollback test 029', 'pending');
    raise exception 'FAIL: cross-clinic insert was allowed';
  exception when insufficient_privilege then raise notice 'PASS: cross-clinic doctor rejected (42501)';
  end;
  insert into appointments(organization_id, patient_id, doctor_id, requested_specialty, chief_complaint, status)
  values (doc_org, pat, doc, 'general', 'rollback test 029', 'pending');
  raise notice 'PASS: same-clinic doctor accepted';
end $$;
rollback;
