// app/tickets/[id]/types.ts

export type Profile = {
  id: string;
  tenant_id: string;
  role: string;
};

export type TicketStatus = 'new' | 'open' | 'in_progress' | 'closed';

export type ChecklistSection = 'pm' | 'fm' | 'contractor';

export type ChecklistState = Partial<
  Record<ChecklistSection, Record<string, boolean>>
>;

export type Ticket = {
  id: string;
  tenant_id: string;
  created_by: string;
  title: string;
  description: string | null;
  priority: 'low' | 'medium' | 'high';
  status: TicketStatus;
  created_at: string;
  closed_reason: string | null;
  checklist: ChecklistState | null;
  admin_notes: string | null;
  cost_estimated: number | null;
  expected_enddate: string | null;
  chosen_tgm: string | null;
  
};

export type Attachment = {
  id: string;
  ticket_id: string;
  file_path: string;
  original_name: string;
  mime_type: string | null;
  created_at: string;
};

export type AttachmentWithUrl = Attachment & { url: string | null };

export type Message = {
  id: string;
  ticket_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};
