// app/tickets/[id]/components/TicketHeader.tsx

'use client';

import { formatDate, formatDateShort, getClosedReasonLabel, formatCost } from '../utils';
import { Badge, Card, StatusBadge, priorityMeta, cn } from '@/components/ui';
import type { TicketWithMeta } from '../types';

type Props = {
  ticket: TicketWithMeta;
  isAdminAm: boolean;
};

export function TicketHeader({ ticket, isAdminAm }: Props) {
  const displayTitle =
    ticket.title.length > 100 ? `${ticket.title.slice(0, 100)}...` : ticket.title;
  const prio = priorityMeta(ticket.priority);

  return (
    <Card className="p-6">
      {/* Title & Meta */}
      <div className="mb-5 flex flex-col justify-between gap-4 border-b border-zinc-100 pb-5 md:flex-row md:items-start">
        <div>
          <h1 className="mb-1 text-lg font-semibold text-zinc-900" title={ticket.title}>
            {displayTitle}
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
            <span>Erstellt am {formatDate(ticket.created_at)}</span>
            <span>•</span>
            <span className="font-mono">#{ticket.id.slice(0, 8)}</span>
          </div>

          {ticket.expected_enddate && (
            <div className="mt-3 inline-flex items-center gap-2 rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-1.5 text-xs text-indigo-700">
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
              <span>Ziel: {formatDateShort(ticket.expected_enddate)}</span>
            </div>
          )}
        </div>

        {/* Badges */}
        <div className="flex flex-wrap gap-2">
          <Badge className="bg-zinc-100 text-zinc-600 ring-1 ring-zinc-200">
            <span className={cn('h-1.5 w-1.5 rounded-full', prio.dot)} />
            {prio.label}
          </Badge>
          <StatusBadge status={ticket.status} />
          {isAdminAm && ticket.cost_estimated && (
            <Badge className="bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
              ~{formatCost(ticket.cost_estimated)}
            </Badge>
          )}
        </div>
      </div>

      {/* Description */}
      {ticket.description && (
        <div className="text-sm leading-relaxed text-zinc-700">
          <p className="whitespace-pre-line">{ticket.description}</p>
        </div>
      )}

      {/* Closed Reason */}
      {ticket.status === 'closed' && (
        <div className="mt-5 flex items-center gap-2 rounded-lg border border-zinc-100 bg-zinc-50 p-3 text-sm font-medium text-zinc-700">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
          </svg>
          {getClosedReasonLabel(ticket.closed_reason)}
        </div>
      )}
    </Card>
  );
}
