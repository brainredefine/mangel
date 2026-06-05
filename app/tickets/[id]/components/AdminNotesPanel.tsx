// app/tickets/[id]/components/AdminNotesPanel.tsx

'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../../../lib/supabaseClient';
import { Card, Textarea } from '@/components/ui';
import type { TicketWithMeta } from '../types';

type Props = {
  ticket: TicketWithMeta;
  setTicket: React.Dispatch<React.SetStateAction<TicketWithMeta | null>>;
};

export function AdminNotesPanel({ ticket, setTicket }: Props) {
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  // Sync draft with ticket data
  useEffect(() => {
    setDraft(ticket.admin_notes ?? '');
  }, [ticket.admin_notes]);

  const handleSave = async () => {
    setSaving(true);

    const { error } = await supabase
      .from('tickets')
      .update({ admin_notes: draft.trim() || null })
      .eq('id', ticket.id);

    if (!error) {
      setTicket((prev) => (prev ? { ...prev, admin_notes: draft.trim() || null } : prev));
    }

    setSaving(false);
  };

  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="h-4 w-4 text-indigo-500" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
          </svg>
          <h2 className="font-semibold text-zinc-900">Interne Notizen</h2>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="text-sm font-semibold text-indigo-600 transition hover:text-indigo-500 disabled:opacity-50"
        >
          {saving ? 'Speichert...' : 'Speichern'}
        </button>
      </div>

      <Textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Interne Notizen (nur für Admins sichtbar)..."
      />
    </Card>
  );
}
