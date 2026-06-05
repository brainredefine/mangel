// app/tickets/[id]/utils.ts

import { STATUS_LABELS, PRIORITY_LABELS, CLOSED_REASON_LABELS } from './constants';
import type { TicketStatus, Priority } from './types';

// ==========================================
// DATE FORMATTING
// ==========================================

export function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString('de-DE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function formatDateShort(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('de-DE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } catch {
    return iso;
  }
}

// ==========================================
// LABEL HELPERS
// ==========================================

export function getStatusLabel(status: TicketStatus): string {
  return STATUS_LABELS[status] || status;
}

export function getPriorityLabel(priority: Priority | string): string {
  return PRIORITY_LABELS[priority] || 'Normal';
}

export function getClosedReasonLabel(reason: string | null): string | null {
  if (!reason) return null;
  return CLOSED_REASON_LABELS[reason] || `Geschlossen (${reason})`;
}

// ==========================================
// COST FORMATTING
// ==========================================

export function formatCost(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  try {
    return value.toLocaleString('de-DE', {
      style: 'currency',
      currency: 'EUR',
    });
  } catch {
    return `${value} €`;
  }
}

export function parseCostInput(input: string): number | null {
  const trimmed = input.trim().replace(',', '.');
  if (!trimmed) return null;
  const parsed = parseFloat(trimmed);
  return isNaN(parsed) ? null : parsed;
}

// ==========================================
// ID GENERATION
// ==========================================

export function createRowId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ==========================================
// FILE HELPERS
// ==========================================

export function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
}

export function formatFileSize(bytes: number): string {
  const mb = bytes / 1024 / 1024;
  return `${mb.toFixed(2)} MB`;
}

export function isImageFile(mimeType: string | null): boolean {
  return mimeType?.startsWith('image/') ?? false;
}

// ==========================================
// VENDOR HELPERS
// ==========================================

export function buildVendorAddress(vendor: {
  street?: string | boolean;
  zip?: string | boolean;
  city?: string | boolean;
}): string {
  const parts = [
    typeof vendor.street === 'string' ? vendor.street : null,
    typeof vendor.zip === 'string' ? vendor.zip : null,
    typeof vendor.city === 'string' ? vendor.city : null,
  ].filter(Boolean);
  return parts.join(' ');
}

export function getVendorEmail(vendor: { email?: string | boolean }): string | null {
  return typeof vendor.email === 'string' ? vendor.email : null;
}

export function getVendorPhone(vendor: { phone?: string | boolean }): string | null {
  return typeof vendor.phone === 'string' ? vendor.phone : null;
}

// ==========================================
// CHECKLIST HELPERS
// ==========================================

export function isWarrantyPossible(constructionYear: number | string | null | undefined): boolean {
  if (!constructionYear) return false;
  const year = Number(constructionYear);
  if (isNaN(year)) return false;
  return new Date().getFullYear() - year <= 5;
}
