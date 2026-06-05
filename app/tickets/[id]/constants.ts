// app/tickets/[id]/constants.ts

export const PM_STEPS = [
  { key: 'lease_checked', label: 'Mietvertrag auf Zuständigkeit geprüft' },
  { key: 'urgency_evaluated', label: 'Dringlichkeit bewertet' },
  { key: 'first_estimate_done', label: 'Erste Kostenschätzung erstellt' },
  { key: 'tenant_informed', label: 'Mieter über Entscheidung informiert' },
  { key: 'sent_to_fm', label: 'Bei Annahme: an Facility Manager weitergeleitet' },
] as const;

export const FM_STEPS = [
  { key: 'visit_done', label: 'Vor-Ort-Besichtigung durchgeführt oder Remote-Analyse' },
  { key: 'solution_defined', label: 'Technische Lösung definiert' },
  { key: 'vendors_selected', label: 'Geeignete Dienstleister ausgewählt' },
  { key: 'budget_estimated', label: 'Kostenrahmen festgelegt' },
  { key: 'dates_coordinated', label: 'Termine koordiniert' },
  { key: 'order_sent', label: 'Auftrag erstellt und versandt' },
] as const;

export const CONTRACTOR_STEPS = [
  { key: 'order_received', label: 'Auftrag und Objektzugang erhalten' },
  { key: 'photos_before', label: 'Vorher-Fotos gemacht' },
  { key: 'works_done', label: 'Arbeiten gemäß Auftrag durchgeführt' },
  { key: 'photos_after', label: 'Nachher-Fotos gemacht' },
  { key: 'digital_report_sent', label: 'Digitale Fertigmeldung abgesetzt' },
  { key: 'invoice_sent', label: 'Rechnung erstellt und übermittelt' },
  { key: 'invoice_paid_odoo', label: 'Invoice paid & registered in Odoo' },
] as const;

export const STATUS_LABELS: Record<string, string> = {
  new: 'Neu',
  open: 'Offen',
  in_progress: 'In Bearbeitung',
  closed: 'Geschlossen',
};

export const PRIORITY_LABELS: Record<string, string> = {
  low: 'Niedrig',
  medium: 'Normal',
  high: 'Hoch',
};

export const CLOSED_REASON_LABELS: Record<string, string> = {
  over_5000: 'Geschlossen wegen Schäden > 5.000 €',
  tenant_liability: 'Geschlossen, da vom Mieter zu tragen',
};
