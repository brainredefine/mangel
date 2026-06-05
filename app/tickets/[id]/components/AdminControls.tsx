// app/tickets/[id]/components/AdminControls.tsx

'use client';

import { useState } from 'react';
import { supabase } from '../../../../lib/supabaseClient';
import { notifyTenantAction, logTicketActivityAction } from '../actions';
import { Button, Select, cn } from '@/components/ui';
import type { TicketWithMeta, Priority, TicketStatus } from '../types';

const STATUS_DE: Record<string, string> = {
  new: 'Neu',
  open: 'Offen',
  in_progress: 'In Bearbeitung',
  closed: 'Geschlossen',
  archived: 'Archiviert',
};

type Props = {
  ticket: TicketWithMeta;
  setTicket: React.Dispatch<React.SetStateAction<TicketWithMeta | null>>;
  isRequest?: boolean;
  assetGroup?: 'AD' | 'AC' | null;
};

export function AdminControls({ ticket, setTicket, isRequest = false, assetGroup = null }: Props) {
  const [priorityUpdating, setPriorityUpdating] = useState(false);
  const [updatingAction, setUpdatingAction] = useState<string | null>(null);

  const isClosed = ticket.status === 'closed' || ticket.status === 'archived';

  // Freigabe-Limit je Portfolio: Nadine (AC) 7.500 €, Andrea (AD) 5.000 € netto.
  const LIMIT = assetGroup === 'AC' ? 7500 : 5000;
  const costTable = Array.isArray(ticket.cost_table) ? ticket.cost_table : [];
  const nettoFromTable = costTable.reduce(
    (s, r) => s + (r.rowType !== 'total' && r.rowType !== 'extra' && typeof r.amount === 'number' ? r.amount : 0),
    0
  );
  const nettoAmount = nettoFromTable > 0 ? nettoFromTable : ticket.cost_estimated ?? 0;
  const overLimit = !isRequest && nettoAmount > LIMIT;

  // --- HANDLERS ---

  const handlePriorityChange = async (newPriority: Priority) => {
    setPriorityUpdating(true);
    const { error } = await supabase
      .from('tickets')
      .update({ priority: newPriority })
      .eq('id', ticket.id);

    if (!error) {
      setTicket((prev) => (prev ? { ...prev, priority: newPriority } : prev));
    }
    setPriorityUpdating(false);
  };

  const handleCloseTicket = async (reason: string = 'resolved') => {
    setUpdatingAction('close');

    const { error } = await supabase
      .from('tickets')
      .update({ status: 'closed', closed_reason: reason })
      .eq('id', ticket.id);

    if (error) {
      console.error('Error closing ticket:', error);
      alert('Fehler beim Schließen des Tickets.');
    } else {
      setTicket((prev) => (prev ? { ...prev, status: 'closed', closed_reason: reason } : prev));
      notifyTenantAction(ticket.id, 'status').catch(() => {});
      logTicketActivityAction(
        ticket.id,
        'status',
        reason === 'tenant_liability' ? 'Geschlossen (Mieter-Haftung)' : 'Geschlossen'
      ).catch(() => {});
    }
    setUpdatingAction(null);
  };

  const handleStatusChange = async (newStatus: TicketStatus) => {
    if (newStatus === ticket.status) return;
    setUpdatingAction('status');

    // Schließen setzt einen Standardgrund; jeder andere Status räumt ihn weg.
    const closing = newStatus === 'closed';
    const patch = { status: newStatus, closed_reason: closing ? 'resolved' : null };

    const { error } = await supabase.from('tickets').update(patch).eq('id', ticket.id);

    if (error) {
      console.error('Error updating status:', error);
      alert('Fehler beim Aktualisieren des Status.');
    } else {
      setTicket((prev) => (prev ? { ...prev, status: newStatus, closed_reason: patch.closed_reason } : prev));
      notifyTenantAction(ticket.id, 'status').catch(() => {});
      logTicketActivityAction(ticket.id, 'status', `Status: ${STATUS_DE[newStatus] || newStatus}`).catch(() => {});
    }
    setUpdatingAction(null);
  };

  const handleToggleOver5k = async () => {
    const newVal = !ticket.over_5k;
    setTicket((prev) => (prev ? { ...prev, over_5k: newVal } : prev));

    const { error } = await supabase
      .from('tickets')
      .update({ over_5k: newVal })
      .eq('id', ticket.id);

    if (error) {
      setTicket((prev) => (prev ? { ...prev, over_5k: !newVal } : prev));
    }
  };

  const handleToggleLuxApproved = async () => {
    const newVal = !ticket.lux_approved;
    setTicket((prev) => (prev ? { ...prev, lux_approved: newVal } : prev));

    const { error } = await supabase
      .from('tickets')
      .update({ lux_approved: newVal })
      .eq('id', ticket.id);

    if (error) {
      setTicket((prev) => (prev ? { ...prev, lux_approved: !newVal } : prev));
    }
  };

  return (
    <>
      {/* Luxembourg Alert - DEFECT ONLY */}
      {!isRequest && ticket.over_5k && (
        <LuxembourgAlert isApproved={!!ticket.lux_approved} onToggle={handleToggleLuxApproved} />
      )}

      {/* Auto-Hinweis: geschätzte Kosten über dem Freigabe-Limit */}
      {overLimit && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <span>
            <span className="font-semibold">Freigabe erforderlich:</span> Die geschätzten Kosten
            (~{nettoAmount.toLocaleString('de-DE')} € netto) übersteigen das Limit von{' '}
            {LIMIT.toLocaleString('de-DE')} €.
          </span>
        </div>
      )}

      {/* Admin Controls Panel */}
      <div className={ticket.over_5k && !isRequest ? 'mt-6 border-t border-zinc-100 pt-6' : ''}>
        <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Verwaltung
        </h3>

        <div className="flex flex-wrap items-center gap-4">
          {/* Priority Select - DEFECT ONLY */}
          {!isRequest && (
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-zinc-700">Priorität:</label>
              <Select
                value={ticket.priority}
                onChange={(e) => handlePriorityChange(e.target.value as Priority)}
                disabled={priorityUpdating}
                className="h-9 w-auto"
              >
                <option value="low">Niedrig</option>
                <option value="medium">Normal</option>
                <option value="high">Hoch</option>
              </Select>
            </div>
          )}

          {/* Over 5k Checkbox - DEFECT ONLY */}
          {!isRequest && (
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={!!ticket.over_5k}
                onChange={handleToggleOver5k}
                className="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm font-medium text-zinc-700">Über {LIMIT.toLocaleString('de-DE')} €</span>
            </label>
          )}

          {/* Status — einfach wählen, wo das Ticket im Prozess steht */}
          <div className="ml-auto flex items-center gap-2">
            <label className="text-sm font-medium text-zinc-700">Status:</label>
            <Select
              value={ticket.status === 'archived' ? 'closed' : ticket.status}
              onChange={(e) => handleStatusChange(e.target.value as TicketStatus)}
              disabled={!!updatingAction}
              className="h-9 w-auto"
            >
              <option value="new">Neu</option>
              <option value="open">Offen</option>
              <option value="in_progress">In Bearbeitung</option>
              <option value="closed">Geschlossen</option>
            </Select>

            {/* Mieter-Haftung — schließt mit besonderem Grund (nur Mangel) */}
            {!isRequest && !isClosed && (
              <Button
                variant="secondary"
                onClick={() => handleCloseTicket('tenant_liability')}
                loading={updatingAction === 'close'}
                disabled={!!updatingAction}
              >
                Mieter-Haftung
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// Sub-component for Luxembourg Alert
function LuxembourgAlert({ isApproved, onToggle }: { isApproved: boolean; onToggle: () => void }) {
  return (
    <div
      className={cn(
        'mb-6 flex flex-col justify-between gap-4 rounded-xl border p-4 transition-colors md:flex-row md:items-center',
        isApproved
          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
          : 'border-amber-200 bg-amber-50 text-amber-800'
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg',
            isApproved ? 'bg-emerald-100' : 'bg-amber-100'
          )}
        >
          <svg className={cn('h-5 w-5', isApproved ? 'text-emerald-600' : 'text-amber-600')} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            {isApproved ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            )}
          </svg>
        </div>
        <div>
          <h4 className="text-sm font-bold uppercase tracking-wide">Luxembourg Process</h4>
          <p className="mt-1 text-sm">
            {isApproved
              ? 'Genehmigt: Unterschrift aus Luxemburg liegt vor.'
              : 'Unterschrift aus Luxemburg erforderlich.'}
          </p>
        </div>
      </div>

      <label className="flex cursor-pointer select-none items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 transition-colors hover:bg-zinc-50">
        <input
          type="checkbox"
          checked={isApproved}
          onChange={onToggle}
          className="h-5 w-5 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-600"
        />
        <span className="text-sm font-semibold text-zinc-900">Signed</span>
      </label>
    </div>
  );
}
