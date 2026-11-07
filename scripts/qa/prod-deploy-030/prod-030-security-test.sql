-- Rolled-back production check of migration 030. Attempts writes only inside a
-- transaction that is always rolled back; the privilege checks reject them first.
begin;
do $$ declare n int; begin
  begin set local role anon; perform 1 from public.public_doctors limit 1; raise notice 'FAIL: anon can SELECT public_doctors';
  exception when insufficient_privilege then raise notice 'PASS: anon SELECT public_doctors denied'; end;
  reset role;
  begin set local role anon; update public.public_doctors set bio = bio where false; raise notice 'FAIL: anon can UPDATE public_doctors';
  exception when insufficient_privilege then raise notice 'PASS: anon UPDATE public_doctors denied'; end;
  reset role;
  begin set local role authenticated; perform 1 from public.public_doctors limit 1; raise notice 'FAIL: authenticated can SELECT public_doctors';
  exception when insufficient_privilege then raise notice 'PASS: authenticated SELECT public_doctors denied'; end;
  reset role;
  begin set local role anon; perform * from public.appointment_doctors(array[]::uuid[]); raise notice 'FAIL: anon can execute appointment_doctors';
  exception when insufficient_privilege then raise notice 'PASS: anon cannot execute appointment_doctors'; end;
  reset role;
  begin set local role anon; select count(*) into n from public.users where role = 'doctor';
    if n = 0 then raise notice 'PASS: anon sees 0 doctor rows in users (RLS)'; else raise notice 'FAIL: anon sees % doctor rows', n; end if;
  end;
  reset role;
end $$;
rollback;
