// app/tickets/[id]/components/CostSection.tsx

'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../../../lib/supabaseClient';
import { formatCost, parseCostInput, createRowId } from '../utils';
import { Card, Button, Spinner, cn } from '@/components/ui';
import type { TicketWithMeta, CostRow } from '../types';

type Props = {
  ticket: TicketWithMeta;
  setTicket: React.Dispatch<React.SetStateAction<TicketWithMeta | null>>;
};

export function CostSection({ ticket, setTicket }: Props) {
  const [costDraft, setCostDraft] = useState('');
  const [angebotDraft, setAngebotDraft] = useState('');
  const [beauftragtDraft, setBeauftragtDraft] = useState('');
  const [rechnungDraft, setRechnungDraft] = useState('');
  const [expectedEndDraft, setExpectedEndDraft] = useState('');

  const [analysisDraft, setAnalysisDraft] = useState('');
  const [costTableRows, setCostTableRows] = useState<CostRow[]>([]);

  const [savingCost, setSavingCost] = useState(false);
  const [savingAngebot, setSavingAngebot] = useState(false);
  const [savingBeauftragt, setSavingBeauftragt] = useState(false);
  const [savingRechnung, setSavingRechnung] = useState(false);
  const [savingExpectedEnd, setSavingExpectedEnd] = useState(false);
  const [savingAnalysis, setSavingAnalysis] = useState(false);
  const [savingTable, setSavingTable] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);

  useEffect(() => {
    setCostDraft(ticket.cost_estimated?.toString() ?? '');
    setAngebotDraft(ticket.angebotsumme?.toString() ?? '');
    setBeauftragtDraft(ticket.beauftragungsumme?.toString() ?? '');
    setRechnungDraft(ticket.rechnungsumme?.toString() ?? '');
    setExpectedEndDraft(ticket.expected_enddate?.slice(0, 10) ?? '');
    setAnalysisDraft(ticket.cost_analysis_text ?? '');
    setCostTableRows(Array.isArray(ticket.cost_table) ? ticket.cost_table : []);
  }, [ticket]);

  const saveMoneyField = async (
    field: 'cost_estimated' | 'angebotsumme' | 'beauftragungsumme' | 'rechnungsumme',
    draftValue: string,
    setSaving: (v: boolean) => void
  ) => {
    setSaving(true);
    const val = parseCostInput(draftValue);

    if (draftValue.trim() && val === null) {
      alert('Ungültige Zahl');
      setSaving(false);
      return;
    }

    const { error } = await supabase
      .from('tickets')
      .update({ [field]: val })
      .eq('id', ticket.id);

    if (!error) {
      setTicket((prev) => (prev ? { ...prev, [field]: val } as any : prev));
    }
    setSaving(false);
  };

  const handleSaveExpectedEnd = async () => {
    setSavingExpectedEnd(true);
    const val = expectedEndDraft.trim() || null;

    const { error } = await supabase
      .from('tickets')
      .update({ expected_enddate: val })
      .eq('id', ticket.id);

    if (!error) {
      setTicket((prev) => (prev ? { ...prev, expected_enddate: val } : prev));
    }
    setSavingExpectedEnd(false);
  };

  const handleSaveAnalysis = async () => {
    setSavingAnalysis(true);

    const { error } = await supabase
      .from('tickets')
      .update({ cost_analysis_text: analysisDraft.trim() || null })
      .eq('id', ticket.id);

    if (!error) {
      setTicket((prev) =>
        prev ? { ...prev, cost_analysis_text: analysisDraft.trim() || null } : prev
      );
    }
    setSavingAnalysis(false);
  };

  const handleSaveTable = async () => {
    setSavingTable(true);

    const { error } = await supabase
      .from('tickets')
      .update({ cost_table: costTableRows })
      .eq('id', ticket.id);

    if (!error) {
      setTicket((prev) => (prev ? { ...prev, cost_table: costTableRows } : prev));
    }
    setSavingTable(false);
  };

  const handleGenerateReport = async () => {
    if (!confirm('KI-Analyse generieren? Dies kann einige Sekunden dauern.')) return;

    setGeneratingReport(true);

    try {
      const res = await fetch(`/api/tickets/${ticket.id}/generate-report`, { method: 'POST' });
      const data = await res.json();

      if (data.ok) {
        setAnalysisDraft(data.cost_analysis_text || '');
        setCostTableRows(data.cost_table || []);
        setTicket((prev) => prev ? {
          ...prev,
          cost_analysis_text: data.cost_analysis_text,
          cost_table: data.cost_table,
        } : prev);
        alert('Analyse erfolgreich generiert!');
      } else {
        alert(`Fehler: ${data.error || 'Unbekannter Fehler'}`);
      }
    } catch (err) {
      console.error('Generate report error', err);
      alert('Netzwerkfehler bei der Analyse-Generierung.');
    }

    setGeneratingReport(false);
  };

  const handleRowChange = (id: string, field: keyof CostRow, value: string) => {
    setCostTableRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        if (field === 'amount') {
          const v = value.trim().replace(',', '.');
          return { ...r, amount: v === '' ? null : isNaN(parseFloat(v)) ? r.amount : parseFloat(v) };
        }
        if (field === 'rowType') return { ...r, rowType: value as any };
        return { ...r, [field]: value };
      })
    );
  };

  const handleAddRow = () => {
    setCostTableRows((prev) => [
      ...prev,
      { id: createRowId(), label: '', kostengruppe: '', amount: null, notes: '', rowType: 'position' },
    ]);
  };

  const handleDeleteRow = (id: string) => {
    setCostTableRows((prev) => prev.filter((r) => r.id !== id));
  };

  const subtotal = costTableRows.reduce((sum, row) => sum + (row.amount ?? 0), 0);
  const taxAmount = subtotal * 0.19;
  const totalWithTax = subtotal + taxAmount;

  return (
    <div className="space-y-6">
      {/* Cost Inputs Row */}
      <Card className="p-6">
        <div className="mb-6 flex items-center gap-3 border-b border-zinc-100 pb-3">
          <svg className="h-4 w-4 text-indigo-500" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
          </svg>
          <h2 className="text-xs font-bold uppercase tracking-[0.1em] text-zinc-900">
            Kosten &amp; Termine
          </h2>
        </div>

        {/* Grid Layout 2x3 */}
        <div className="mb-4 grid gap-4 md:grid-cols-3">
          <ImprovedCostInput
            label="Kostenschätzung"
            value={costDraft}
            onChange={setCostDraft}
            onSave={() => saveMoneyField('cost_estimated', costDraft, setSavingCost)}
            onBlur={() => saveMoneyField('cost_estimated', costDraft, setSavingCost)}
            saving={savingCost}
          />
          <ImprovedCostInput
            label="Angebotsumme"
            value={angebotDraft}
            onChange={setAngebotDraft}
            onSave={() => saveMoneyField('angebotsumme', angebotDraft, setSavingAngebot)}
            onBlur={() => saveMoneyField('angebotsumme', angebotDraft, setSavingAngebot)}
            saving={savingAngebot}
          />
          <ImprovedCostInput
            label="Beauftragungsumme"
            value={beauftragtDraft}
            onChange={setBeauftragtDraft}
            onSave={() => saveMoneyField('beauftragungsumme', beauftragtDraft, setSavingBeauftragt)}
            onBlur={() => saveMoneyField('beauftragungsumme', beauftragtDraft, setSavingBeauftragt)}
            saving={savingBeauftragt}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <ImprovedCostInput
            label="Rechnungsumme"
            value={rechnungDraft}
            onChange={setRechnungDraft}
            onSave={() => saveMoneyField('rechnungsumme', rechnungDraft, setSavingRechnung)}
            onBlur={() => saveMoneyField('rechnungsumme', rechnungDraft, setSavingRechnung)}
            saving={savingRechnung}
          />

          {/* Date Input */}
          <div className="md:col-span-2">
            <label className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-zinc-500">
              Voraussichtliches Ende
            </label>
            <div className="flex gap-2">
              <input
                type="date"
                value={expectedEndDraft}
                onChange={(e) => setExpectedEndDraft(e.target.value)}
                onBlur={handleSaveExpectedEnd}
                className="flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 transition-all focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
              <Button onClick={handleSaveExpectedEnd} loading={savingExpectedEnd} size="sm">
                Speichern
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Cost Analysis Text */}
      <Card className="p-6">
        <div className="mb-6 flex items-center justify-between border-b border-zinc-100 pb-4">
          <div className="flex items-center gap-3">
            <svg className="h-5 w-5 text-indigo-500" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
            </svg>
            <h2 className="text-xs font-bold uppercase tracking-[0.1em] text-zinc-900">
              Kostenanalyse (KI)
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={handleGenerateReport}
              loading={generatingReport}
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-500"
            >
              {!generatingReport && (
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
              )}
              KI-Analyse
            </Button>
            <button
              onClick={handleSaveAnalysis}
              disabled={savingAnalysis}
              className="text-sm font-semibold text-indigo-600 transition-colors hover:text-indigo-500 disabled:opacity-50"
            >
              {savingAnalysis ? 'Speichert...' : 'Speichern'}
            </button>
          </div>
        </div>

        <textarea
          className="min-h-[240px] w-full resize-none rounded-lg border border-zinc-200 bg-zinc-50 p-4 font-mono text-sm leading-relaxed text-zinc-800 transition-all placeholder:text-zinc-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          value={analysisDraft}
          onChange={(e) => setAnalysisDraft(e.target.value)}
          placeholder="KI-generierte Kostenanalyse..."
        />
      </Card>

      {/* Cost Table */}
      <Card className="p-6">
        <div className="mb-6 flex items-center justify-between border-b border-zinc-100 pb-4">
          <div className="flex items-center gap-3">
            <svg className="h-5 w-5 text-indigo-500" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M13.125 12h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125M20.625 12c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5M12 14.625v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 14.625c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m0 1.5v-1.5m0 0c0-.621.504-1.125 1.125-1.125m0 0h7.5" />
            </svg>
            <h2 className="text-xs font-bold uppercase tracking-[0.1em] text-zinc-900">
              Kostentabelle
            </h2>
          </div>
          <Button onClick={handleAddRow} variant="secondary" size="sm">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Zeile hinzufügen
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] table-fixed text-sm">
            <thead>
              <tr className="border-b border-zinc-200">
                <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-500">Position</th>
                <th className="w-20 px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-500">KG</th>
                <th className="w-28 px-4 py-3 text-right text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-500">Betrag (€)</th>
                <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-500">Notizen</th>
                <th className="w-28 px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-500">Typ</th>
                <th className="w-10 px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {costTableRows.map((row) => (
                <tr key={row.id} className="transition-colors hover:bg-zinc-50">
                  <td className="px-4 py-2">
                    <input
                      type="text"
                      value={row.label}
                      onChange={(e) => handleRowChange(row.id, 'label', e.target.value)}
                      className="w-full border-0 border-b border-transparent bg-transparent text-sm text-zinc-900 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-0"
                      placeholder="Bezeichnung"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="text"
                      value={row.kostengruppe}
                      onChange={(e) => handleRowChange(row.id, 'kostengruppe', e.target.value)}
                      className="w-full border-0 border-b border-transparent bg-transparent text-sm text-zinc-900 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-0"
                      placeholder="KG 330"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="text"
                      value={row.amount?.toString() ?? ''}
                      onChange={(e) => handleRowChange(row.id, 'amount', e.target.value)}
                      className="w-full border-0 border-b border-transparent bg-transparent text-right font-mono text-sm text-zinc-900 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-0"
                      placeholder="0.00"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="text"
                      value={row.notes ?? ''}
                      onChange={(e) => handleRowChange(row.id, 'notes', e.target.value)}
                      className="w-full border-0 border-b border-transparent bg-transparent text-sm text-zinc-900 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-0"
                      placeholder="Optional"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <select
                      value={row.rowType ?? 'position'}
                      onChange={(e) => handleRowChange(row.id, 'rowType', e.target.value)}
                      className="w-full border-0 border-b border-transparent bg-transparent text-xs text-zinc-900 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-0"
                    >
                      <option value="position">Position</option>
                      <option value="subtotal">Subtotal</option>
                      <option value="extra">Extra</option>
                    </select>
                  </td>
                  <td className="px-4 py-2">
                    <button
                      onClick={() => handleDeleteRow(row.id)}
                      className="text-zinc-300 transition-colors hover:text-red-600"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-zinc-200">
                <td colSpan={2} className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-zinc-500">Netto</td>
                <td className="px-4 py-3 text-right font-mono font-medium text-zinc-900">{formatCost(subtotal)}</td>
                <td colSpan={3} />
              </tr>
              <tr>
                <td colSpan={2} className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-zinc-500">MwSt (19%)</td>
                <td className="px-4 py-3 text-right font-mono font-medium text-zinc-900">{formatCost(taxAmount)}</td>
                <td colSpan={3} />
              </tr>
              <tr className="border-t-2 border-zinc-200 bg-zinc-50">
                <td colSpan={2} className="px-4 py-4 text-right text-sm font-bold uppercase tracking-wide text-zinc-900">Gesamt</td>
                <td className="px-4 py-4 text-right font-mono text-lg font-bold text-indigo-600">{formatCost(totalWithTax)}</td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="mt-6 flex justify-end gap-3 border-t border-zinc-100 pt-6">
          <Button
            variant="secondary"
            onClick={() => window.open(`/api/tickets/${ticket.id}/send-pdf`, '_blank', 'noopener,noreferrer')}
            title="Gespeicherte Kostenschätzung als PDF öffnen"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 12l1.5 1.5m0 0l1.5-1.5m-1.5 1.5V12m3-7.5H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
            PDF öffnen
          </Button>
          <Button onClick={handleSaveTable} loading={savingTable}>
            Tabelle speichern
          </Button>
        </div>
      </Card>
    </div>
  );
}

function ImprovedCostInput({
  label,
  value,
  onChange,
  onSave,
  onBlur,
  saving,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onSave: () => void;
  onBlur: () => void;
  saving: boolean;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 p-3 transition-all hover:border-indigo-300">
      <label className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-zinc-500">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-zinc-400">€</span>
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            className="w-full rounded-lg border border-zinc-200 bg-white py-2 pl-8 pr-3 font-mono text-sm text-zinc-900 transition-all focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            placeholder="0.00"
          />
        </div>
        <Button onClick={onSave} loading={saving} size="sm" title="Speichern">
          {!saving && (
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </Button>
      </div>
    </div>
  );
}
