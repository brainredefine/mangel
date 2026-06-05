-- ============================================================================
-- Mangel-App — initial schema
-- Reverse-engineered from the application code (lib/, app/).
-- Recreates: profiles, tenant_invites, tickets, ticket_attachments,
-- ticket_messages, the handle_new_user trigger, RLS policies, helper
-- functions, and the private "ticket_attachments" storage bucket.
--
-- Apply with: Supabase CLI (`supabase db push`), the SQL editor, or
-- the Supabase MCP `apply_migration`.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. profiles  (1:1 mirror of auth.users)
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  role       text not null default 'tenant_user'
             check (role in ('tenant_user', 'admin_am')),
  full_name  text,
  odoo_id    bigint,   -- Odoo partner id (logical ref, not a DB FK)
  tenant_id  bigint,   -- Odoo partner id used to scope tickets
  created_at timestamptz not null default now()
);

-- Auto-create an (empty) profile row whenever an auth user is created.
-- The activation flow later upserts role / odoo_id / tenant_id / full_name.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 2. tenant_invites  (paper activation codes, managed via service role only)
-- ----------------------------------------------------------------------------
create table if not exists public.tenant_invites (
  id          uuid primary key default gen_random_uuid(),
  odoo_id     bigint not null,
  access_code text   not null,
  is_claimed  boolean not null default false,
  claimed_by  uuid references auth.users (id) on delete set null,
  claimed_at  timestamptz,
  created_at  timestamptz not null default now(),
  unique (odoo_id, access_code)
);

-- ----------------------------------------------------------------------------
-- 3. tickets  (central entity)
-- ----------------------------------------------------------------------------
create table if not exists public.tickets (
  id          uuid primary key default gen_random_uuid(),
  ticket_type text check (ticket_type is null or ticket_type in ('defect', 'request')),
  tenant_id   bigint not null,             -- Odoo partner id (matches profiles.tenant_id)
  odoo_tenancy_id bigint,
  asset_id    bigint,
  created_by  uuid not null references auth.users (id) on delete cascade,
  made_by_pm  boolean not null default false,
  title       text not null,
  description text,
  priority    text not null default 'medium'
              check (priority in ('low', 'medium', 'high')),
  status      text not null default 'new'
              check (status in ('new', 'open', 'in_progress', 'closed', 'archived')),
  categories  text[],
  created_at  timestamptz not null default now(),
  closed_at   timestamptz,
  closed_reason text,

  -- Defect intake fields
  contact_phone          text,
  building_section       text,
  floor                  text,
  room                   text,
  location_description   text,
  access_required        boolean,
  access_time_window     text,
  access_instructions    text,
  attachments_description text,
  extra_contact_info     text,

  -- Admin workflow / cost fields
  checklist          jsonb,
  admin_notes        text,
  cost_estimated     numeric,
  expected_enddate   date,
  chosen_tgm         text,
  cost_analysis_text text,
  cost_table         jsonb,
  angebotsumme       numeric,
  beauftragungsumme  numeric,
  rechnungsumme      numeric,
  over_5k            boolean,
  lux_approved       boolean,

  -- Vendor (TGM / Dienstleister) fields
  tgm_street     text,
  tgm_city       text,
  tgm_zip        text,   -- kept as text to preserve leading zeros
  tgm_mail       text,
  tgm_phone      text,
  odoo_vendor_id bigint,

  -- Read-tracking / messaging meta
  last_admin_read_at timestamptz,
  last_message_at    timestamptz,
  pm                 text   -- name of the AM/PM who claimed the ticket
);

-- ----------------------------------------------------------------------------
-- 4. ticket_attachments
-- ----------------------------------------------------------------------------
create table if not exists public.ticket_attachments (
  id            uuid primary key default gen_random_uuid(),
  ticket_id     uuid not null references public.tickets (id) on delete cascade,
  uploaded_by   uuid references auth.users (id) on delete set null,
  file_path     text not null,
  original_name text,
  mime_type     text,
  privacy       text not null default 'public'
                check (privacy in ('public', 'private')),
  created_at    timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 5. ticket_messages
-- ----------------------------------------------------------------------------
create table if not exists public.ticket_messages (
  id         uuid primary key default gen_random_uuid(),
  ticket_id  uuid not null references public.tickets (id) on delete cascade,
  sender_id  uuid not null references auth.users (id) on delete cascade,
  body       text not null,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Indexes
-- ----------------------------------------------------------------------------
create index if not exists idx_tickets_tenant_id   on public.tickets (tenant_id);
create index if not exists idx_tickets_created_by  on public.tickets (created_by);
create index if not exists idx_tickets_status      on public.tickets (status);
create index if not exists idx_tickets_created_at  on public.tickets (created_at desc);
create index if not exists idx_attachments_ticket  on public.ticket_attachments (ticket_id);
create index if not exists idx_messages_ticket     on public.ticket_messages (ticket_id);

-- ----------------------------------------------------------------------------
-- Helper functions (SECURITY DEFINER so they bypass RLS and avoid recursion)
-- ----------------------------------------------------------------------------
create or replace function public.is_admin_am()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin_am'
  );
$$;

create or replace function public.current_tenant_id()
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select tenant_id from public.profiles where id = auth.uid();
$$;

create or replace function public.can_access_ticket(p_ticket uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.tickets t
    where t.id = p_ticket
      and (
        public.is_admin_am()
        or t.tenant_id = public.current_tenant_id()
        or t.created_by = auth.uid()
      )
  );
$$;

-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------
alter table public.profiles         enable row level security;
alter table public.tenant_invites   enable row level security;
alter table public.tickets          enable row level security;
alter table public.ticket_attachments enable row level security;
alter table public.ticket_messages  enable row level security;

-- profiles: users see/update their own row; admins see/update all.
create policy "profiles_select" on public.profiles
  for select using (id = auth.uid() or public.is_admin_am());
create policy "profiles_update" on public.profiles
  for update using (id = auth.uid() or public.is_admin_am())
  with check (id = auth.uid() or public.is_admin_am());

-- tenant_invites: no anon/authenticated policies -> only the service role
-- (which bypasses RLS) can read/write them. RLS stays enabled = locked down.

-- tickets
create policy "tickets_select" on public.tickets
  for select using (
    public.is_admin_am()
    or tenant_id = public.current_tenant_id()
    or created_by = auth.uid()
  );
create policy "tickets_insert" on public.tickets
  for insert with check (
    created_by = auth.uid()
    and (public.is_admin_am() or tenant_id = public.current_tenant_id())
  );
create policy "tickets_update" on public.tickets
  for update using (
    public.is_admin_am()
    or tenant_id = public.current_tenant_id()
    or created_by = auth.uid()
  )
  with check (
    public.is_admin_am()
    or tenant_id = public.current_tenant_id()
    or created_by = auth.uid()
  );
create policy "tickets_delete" on public.tickets
  for delete using (public.is_admin_am());

-- ticket_attachments
create policy "attachments_select" on public.ticket_attachments
  for select using (
    public.can_access_ticket(ticket_id)
    and (privacy = 'public' or public.is_admin_am() or uploaded_by = auth.uid())
  );
create policy "attachments_insert" on public.ticket_attachments
  for insert with check (
    uploaded_by = auth.uid() and public.can_access_ticket(ticket_id)
  );
create policy "attachments_update" on public.ticket_attachments
  for update using (public.is_admin_am() or uploaded_by = auth.uid())
  with check (public.is_admin_am() or uploaded_by = auth.uid());
create policy "attachments_delete" on public.ticket_attachments
  for delete using (public.is_admin_am() or uploaded_by = auth.uid());

-- ticket_messages
create policy "messages_select" on public.ticket_messages
  for select using (public.can_access_ticket(ticket_id));
create policy "messages_insert" on public.ticket_messages
  for insert with check (
    sender_id = auth.uid() and public.can_access_ticket(ticket_id)
  );

-- ----------------------------------------------------------------------------
-- Storage: private bucket "ticket_attachments"
-- Object path convention: {tenant_id}/{ticketId}/{timestamp}-{filename}
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('ticket_attachments', 'ticket_attachments', false)
on conflict (id) do nothing;

-- Admins manage everything in the bucket; tenants are scoped to their own
-- {tenant_id} folder (first path segment).
create policy "ticket_files_select" on storage.objects
  for select using (
    bucket_id = 'ticket_attachments'
    and (
      public.is_admin_am()
      or (storage.foldername(name))[1] = public.current_tenant_id()::text
    )
  );
create policy "ticket_files_insert" on storage.objects
  for insert with check (
    bucket_id = 'ticket_attachments'
    and (
      public.is_admin_am()
      or (storage.foldername(name))[1] = public.current_tenant_id()::text
    )
  );
create policy "ticket_files_update" on storage.objects
  for update using (
    bucket_id = 'ticket_attachments'
    and (
      public.is_admin_am()
      or (storage.foldername(name))[1] = public.current_tenant_id()::text
    )
  );
create policy "ticket_files_delete" on storage.objects
  for delete using (
    bucket_id = 'ticket_attachments'
    and (
      public.is_admin_am()
      or (storage.foldername(name))[1] = public.current_tenant_id()::text
    )
  );

-- ============================================================================
-- POST-MIGRATION MANUAL STEPS (not run automatically)
-- ============================================================================
-- 1. Seed tenant_invites with the codes handed out to tenants, e.g.:
--      insert into public.tenant_invites (odoo_id, access_code)
--      values (12345, 'ABC123'), (12346, 'DEF456');
--
-- 2. Promote your first admin. After creating the user in Supabase Auth
--    (Dashboard > Authentication > Add user), run:
--      update public.profiles set role = 'admin_am', full_name = 'Your Name'
--      where id = (select id from auth.users where email = 'you@example.com');
-- ============================================================================
