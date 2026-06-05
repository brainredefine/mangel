-- 0004_vendor_tracking.sql
-- Dienstleister-Verfolgung am Ticket: Beauftragung, Bestätigung, Status.

alter table public.tickets
  add column if not exists vendor_status text,
  add column if not exists beauftragt_at timestamptz,
  add column if not exists vendor_confirmed_at timestamptz;

-- Status-Werte begrenzen (idempotent).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'tickets_vendor_status_check'
  ) then
    alter table public.tickets
      add constraint tickets_vendor_status_check
      check (vendor_status in ('commissioned', 'confirmed', 'completed'));
  end if;
end $$;
