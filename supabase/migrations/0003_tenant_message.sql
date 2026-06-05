-- ============================================================================
-- Mangel-App — tenant-visible message per ticket
-- ----------------------------------------------------------------------------
-- Adds a single free-text message the AM/PM can write on a ticket and that the
-- tenant sees on the public tracking page (/tickets/track).
--
-- This is deliberately separate from `admin_notes`, which stays strictly
-- internal. `tenant_message` is the one field an admin can surface to the
-- tenant alongside the attachments marked `privacy = 'public'`.
--
-- Idempotent and safe to re-run.
-- ============================================================================

alter table public.tickets
  add column if not exists tenant_message text;
