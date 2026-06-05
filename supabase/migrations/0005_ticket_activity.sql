-- 0005_ticket_activity.sql
-- Aktivitätsprotokoll je Ticket (Audit-Trail).

create table if not exists public.ticket_activity (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  actor_id uuid,
  actor_name text,
  type text not null,
  detail text,
  created_at timestamptz not null default now()
);

create index if not exists ticket_activity_ticket_idx
  on public.ticket_activity (ticket_id, created_at desc);

alter table public.ticket_activity enable row level security;

-- Lesen nur für Admins; Inserts laufen serverseitig über den Service-Role-Key.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'ticket_activity'
      and policyname = 'ticket_activity_admin_select'
  ) then
    create policy ticket_activity_admin_select on public.ticket_activity
      for select using (is_admin_am());
  end if;
end $$;
