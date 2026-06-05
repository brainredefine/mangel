// app/tickets/[id]/components/TenantMessagePanel.tsx

'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../../../lib/supabaseClient';
import { notifyTenantAction, logTicketActivityAction } from '../actions';
import { Card, Textarea } from '@/components/ui';
import type { TicketWithMeta } from '../types';

type Props = {
  ticket: TicketWithMeta;
  setTicket: React.Dispatch<React.SetStateAction<TicketWithMeta | null>>;
};

export function TenantMessagePanel({ ticket, setTicket }: Props) {
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(ticket.tenant_message ?? '');
  }, [ticket.tenant_message]);

  const handleSave = async () => {
    setSaving(true);

    const { error } = await supabase
      .from('tickets')
      .update({ tenant_message: draft.trim() || null })
      .eq('id', ticket.id);

    if (!error) {
      setTicket((prev) => (prev ? { ...prev, tenant_message: draft.trim() || null } : prev));
      if (draft.trim()) notifyTenantAction(ticket.id, 'message').catch(() => {});
      logTicketActivityAction(
        ticket.id,
        'message',
        draft.trim() ? 'Nachricht an Mieter gesendet' : 'Nachricht entfernt'
      ).catch(() => {});
    }

    setSaving(false);
  };

  return (
    <Card className="p-6">
      <div className="mb-1 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="h-4 w-4 text-indigo-500" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
          </svg>
          <h2 className="font-semibold text-zinc-900">Nachricht an Mieter</h2>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="text-sm font-semibold text-indigo-600 transition hover:text-indigo-500 disabled:opacity-50"
        >
          {saving ? 'Speichert...' : 'Speichern'}
        </button>
      </div>

      <p className="mb-3 text-xs text-zinc-500">
        Für den Mieter auf der Tracking-Seite sichtbar.
      </p>

      <Textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="z. B. „Ein Termin mit dem Dienstleister ist für nächste Woche vereinbart.“"
      />
    </Card>
  );
}
