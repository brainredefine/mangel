-- ============================================================================
-- Mangel-App — no-account tenant model
-- ----------------------------------------------------------------------------
-- Reconciles 0001_init.sql with the architectural pivot:
--   * Tenants no longer have accounts. They create a ticket by entering their
--     Odoo id (validated server-side via the service role) and track it with an
--     unguessable tracking code (MNG-XXXXXXXX). All tenant operations run through
--     server actions using the service role, so they bypass RLS entirely.
--   * Admins keep their Supabase login + backoffice (gated by is_admin_am()).
--   * The in-app chat is removed.
--
-- This migration is idempotent: it has already been applied to the live project
-- and is safe to re-run on a fresh database created from 0001.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Drop the chat feature
-- ----------------------------------------------------------------------------
-- Removes the table, its RLS policies (messages_select / messages_insert) and
-- the idx_messages_ticket index via CASCADE.
drop table if exists public.ticket_messages cascade;

-- ----------------------------------------------------------------------------
-- 2. Drop tenant accounts plumbing
-- ----------------------------------------------------------------------------
-- Paper activation codes are obsolete now that tenants have no accounts.
drop table if exists public.tenant_invites cascade;

-- ----------------------------------------------------------------------------
-- 3. Tickets: support anonymous (no-account) creation
-- ----------------------------------------------------------------------------
-- Tenant-created tickets have no auth user, so created_by must be nullable.
alter table public.tickets alter column created_by drop not null;

-- Unguessable public tracking code (MNG-XXXXXXXX), unique per ticket.
alter table public.tickets add column if not exists tracking_code text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'tickets_tracking_code_key'
  ) then
    alter table public.tickets
      add constraint tickets_tracking_code_key unique (tracking_code);
  end if;
end $$;

-- Contact details captured from the public intake form (no auth user to join).
alter table public.tickets add column if not exists contact_name  text;
alter table public.tickets add column if not exists contact_email text;
-- contact_phone already exists in 0001_init.sql.

-- ----------------------------------------------------------------------------
-- Note on RLS
-- ----------------------------------------------------------------------------
-- The tenant-facing branches of the tickets / ticket_attachments policies
-- (current_tenant_id(), created_by = auth.uid()) are now dead paths: tenants
-- never authenticate, and all their reads/writes go through the service role
-- which bypasses RLS. The policies are intentionally left in place — they still
-- correctly scope authenticated *admin* access via is_admin_am(). No change.
-- ============================================================================
