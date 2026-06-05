// app/tickets/[id]/components/ChecklistSection.tsx

'use client';

import { useState } from 'react';
import { supabase } from '../../../../lib/supabaseClient';
import { PM_STEPS, FM_STEPS, CONTRACTOR_STEPS } from '../constants';
import { Card, Spinner, cn } from '@/components/ui';
import type { TicketWithMeta, ChecklistSection as ChecklistSectionType, ChecklistState } from '../types';

type Props = {
  ticket: TicketWithMeta;
  setTicket: React.Dispatch<React.SetStateAction<TicketWithMeta | null>>;
};

export function ChecklistSection({ ticket, setTicket }: Props) {
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const isStepChecked = (section: ChecklistSectionType, stepKey: string): boolean => {
    const checklist = (ticket.checklist || {}) as ChecklistState;
    return !!(checklist[section] || {})[stepKey];
  };

  const toggleStep = async (section: ChecklistSectionType, stepKey: string) => {
    const checklistKey = `${section}:${stepKey}`;
    setSavingKey(checklistKey);

    const currentChecklist: ChecklistState = ticket.checklist || {};
    const sectionState = { ...(currentChecklist[section] || {}) };
    const nextValue = !sectionState[stepKey];
    sectionState[stepKey] = nextValue;
    const newChecklist = { ...currentChecklist, [section]: sectionState };

    const shouldSetInProgress = section === 'pm' && stepKey === 'sent_to_fm' && nextValue && ticket.status !== 'closed';

    const payload: any = { checklist: newChecklist };
    if (shouldSetInProgress) payload.status = 'in_progress';

    const { error } = await supabase.from('tickets').update(payload).eq('id', ticket.id);

    if (!error) {
      setTicket((prev) =>
        prev
          ? {
              ...prev,
              checklist: newChecklist,
              ...(shouldSetInProgress ? { status: 'in_progress' } : {}),
            }
          : prev
      );
    }
    setSavingKey(null);
  };

  const handleFinalClose = async () => {
    if (isStepChecked('pm', 'final_closed')) return;
    if (!confirm('Sind Sie sicher, dass Sie das Ticket schließen möchten?')) return;

    setSavingKey('pm:final_closed');
    const currentChecklist = ticket.checklist || {};
    const newChecklist = {
      ...currentChecklist,
      pm: { ...(currentChecklist.pm || {}), final_closed: true },
    };

    const { error } = await supabase
      .from('tickets')
      .update({ checklist: newChecklist, status: 'closed' })
      .eq('id', ticket.id);

    if (!error) {
      setTicket((prev) => (prev ? { ...prev, checklist: newChecklist, status: 'closed' } : prev));
    }
    setSavingKey(null);
  };

  return (
    <Card className="p-6">
      {/* Header */}
      <div className="mb-8 flex items-center gap-3">
        <svg className="h-4 w-4 text-indigo-500" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Checkliste</h2>
      </div>

      {/* Checklist Columns */}
      <div className="grid gap-8 md:grid-cols-3">
        <ChecklistColumn
          title="Property Manager"
          icon={
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
          }
          steps={PM_STEPS}
          section="pm"
          isStepChecked={isStepChecked}
          onToggle={toggleStep}
          savingKey={savingKey}
          disabled={ticket.status === 'closed'}
        />

        <ChecklistColumn
          title="Facility Manager"
          icon={
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
            </svg>
          }
          steps={FM_STEPS}
          section="fm"
          isStepChecked={isStepChecked}
          onToggle={toggleStep}
          savingKey={savingKey}
          disabled={ticket.status === 'closed'}
        />

        <ChecklistColumn
          title="Dienstleister"
          icon={
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
            </svg>
          }
          steps={CONTRACTOR_STEPS}
          section="contractor"
          isStepChecked={isStepChecked}
          onToggle={toggleStep}
          savingKey={savingKey}
          disabled={ticket.status === 'closed'}
        />
      </div>

      {/* Final Close Button */}
      <div className="mt-8 border-t border-zinc-100 pt-6">
        <label
          className={cn(
            'group flex cursor-pointer items-center gap-4',
            ticket.status === 'closed' && 'cursor-not-allowed opacity-50'
          )}
        >
          <div className="relative">
            <input
              type="checkbox"
              checked={isStepChecked('pm', 'final_closed')}
              disabled={savingKey === 'pm:final_closed' || ticket.status === 'closed'}
              onChange={handleFinalClose}
              className="peer sr-only"
            />
            <div className="h-6 w-6 rounded border-2 border-zinc-300 transition-all peer-checked:border-indigo-600 peer-checked:bg-indigo-600 peer-focus:ring-2 peer-focus:ring-indigo-500/20 group-hover:border-indigo-500" />
            <svg className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 transition-opacity peer-checked:opacity-100" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <span className="text-sm font-bold uppercase tracking-[0.1em] text-zinc-900">
            Prozess abgeschlossen &amp; Ticket schließen
          </span>
        </label>
      </div>
    </Card>
  );
}

type ChecklistColumnProps = {
  title: string;
  icon: React.ReactNode;
  steps: readonly { key: string; label: string }[];
  section: ChecklistSectionType;
  isStepChecked: (section: ChecklistSectionType, key: string) => boolean;
  onToggle: (section: ChecklistSectionType, key: string) => void;
  savingKey: string | null;
  disabled: boolean;
};

function ChecklistColumn({
  title,
  icon,
  steps,
  section,
  isStepChecked,
  onToggle,
  savingKey,
  disabled,
}: ChecklistColumnProps) {
  const checkedCount = steps.filter((s) => isStepChecked(section, s.key)).length;
  const progress = (checkedCount / steps.length) * 100;

  return (
    <div className="space-y-4">
      {/* Column Header */}
      <div className="flex items-center gap-3 border-b border-zinc-100 pb-3">
        <div className="text-indigo-500">{icon}</div>
        <h3 className="text-xs font-bold uppercase tracking-[0.1em] text-zinc-900">{title}</h3>
        <span className="ml-auto font-mono text-[10px] font-medium text-zinc-500">
          {checkedCount}/{steps.length}
        </span>
      </div>

      {/* Progress Bar */}
      <div className="h-1 overflow-hidden rounded-full bg-zinc-100">
        <div
          className="h-full rounded-full bg-indigo-500 transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Steps */}
      <div className="space-y-1">
        {steps.map((step, index) => {
          const key = `${section}:${step.key}`;
          const checked = isStepChecked(section, step.key);
          const isSaving = savingKey === key;

          return (
            <label
              key={step.key}
              className={cn(
                'group flex cursor-pointer items-start gap-3 rounded-lg p-3 transition-all',
                checked ? 'bg-indigo-50' : 'hover:bg-zinc-50',
                disabled && 'cursor-not-allowed opacity-50'
              )}
            >
              <div className="relative mt-0.5">
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled || isSaving}
                  onChange={() => onToggle(section, step.key)}
                  className="peer sr-only"
                />
                <div
                  className={cn(
                    'h-4 w-4 rounded-sm border-2 transition-all',
                    checked ? 'border-indigo-600 bg-indigo-600' : 'border-zinc-300 group-hover:border-indigo-400'
                  )}
                />
                <svg
                  className={cn(
                    'absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 text-white transition-opacity',
                    checked ? 'opacity-100' : 'opacity-0'
                  )}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>

              <div className="min-w-0 flex-1">
                <span
                  className={cn(
                    'block text-xs font-medium leading-relaxed',
                    checked ? 'text-indigo-700' : 'text-zinc-700'
                  )}
                >
                  {isSaving ? (
                    <span className="flex items-center gap-2">
                      <Spinner className="h-2.5 w-2.5 text-indigo-500" />
                      Speichert...
                    </span>
                  ) : (
                    <>
                      <span className="mr-2 text-[10px] font-medium text-zinc-400">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      {step.label}
                    </>
                  )}
                </span>
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}
