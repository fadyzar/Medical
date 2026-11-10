-- Migration 032: appointment statuses for the doctor-approval lifecycle.
--
--   pending_approval — booked (and, when online payment applies, paid and
--                      verified by the server); waiting for the doctor.
--   confirmed        — approved by the assigned doctor (or a clinic admin).
--                      The only status, besides a running consultation, that
--                      may receive a video token.
--   rejected         — declined by the doctor; the slot is released and any
--                      captured payment is flagged for refund.
--
-- Enum values only. ALTER TYPE ... ADD VALUE cannot be used in the transaction
-- that adds it, so everything that uses these values is in 033.
-- Additive; no existing row changes. Rollback: values stay (Postgres cannot
-- drop enum values); 033_down removes everything that uses them.

alter type public.appointment_status add value if not exists 'pending_approval';
alter type public.appointment_status add value if not exists 'confirmed';
alter type public.appointment_status add value if not exists 'rejected';
