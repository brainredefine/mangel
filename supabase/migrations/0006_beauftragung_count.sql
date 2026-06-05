-- 0006_beauftragung_count.sql
-- Zähler für Beauftragungsnummern je Ticket (z. B. MNG-XXXX-01, -02 …).

alter table public.tickets
  add column if not exists beauftragung_count integer not null default 0;
