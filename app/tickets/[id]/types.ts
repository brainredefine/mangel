// app/tickets/[id]/types.ts

// ==========================================
// BASE TYPES
// ==========================================

export type Profile = {
  id: string;
  tenant_id: number;
  odoo_id?: string | null;
  role: string;
  full_name?: string;
};

export type TicketStatus = 'new' | 'open' | 'in_progress' | 'closed' | 'archived';
export type Priority = 'low' | 'medium' | 'high';
export type TicketType = 'defect' | 'request';
export type ChecklistSection = 'pm' | 'fm' | 'contractor';

export type ChecklistState = Partial<
  Record<ChecklistSection, Record<string, boolean>>
>;

// ==========================================
// TICKET TYPES
// ==========================================

export type Ticket = {
  id: string;
  tenant_id: number;
  created_by: string;
  title: string;
  description: string | null;
  priority: Priority;
  status: TicketStatus;
  ticket_type: TicketType | null;
  created_at: string;
  closed_at: string | null;
  closed_reason: string | null;
  checklist: ChecklistState | null;
  admin_notes: string | null;
  cost_estimated: number | null;
  expected_enddate: string | null;
  chosen_tgm: string | null;
  made_by_pm?: boolean | null;
};

export type TicketWithMeta = Ticket & {
  odoo_tenancy_id: number | null;
  asset_id?: number | null;
  cost_analysis_text: string | null;
  cost_table: CostRow[] | null;
  tenant_message?: string | null;
  tgm_street?: string | null;
  tgm_city?: string | null;
  tgm_zip?: string | null;
  tgm_mail?: string | null;
  tgm_phone?: string | null;
  odoo_vendor_id?: number | null;
  angebotsumme?: number | null;
  beauftragungsumme?: number | null;
  rechnungsumme?: number | null;
  beauftragt_at?: string | null;
  vendor_status?: string | null;
  vendor_confirmed_at?: string | null;
  over_5k?: boolean;
  lux_approved?: boolean;
  last_admin_read_at?: string | null;
  last_message_at?: string | null;
};

// ==========================================
// COST TYPES
// ==========================================

export type CostRow = {
  id: string;
  label: string;
  kostengruppe: string;
  amount: number | null;
  notes?: string;
  rowType?: 'position' | 'subtotal' | 'extra' | 'total';
};

// ==========================================
// ATTACHMENT TYPES
// ==========================================

export type Attachment = {
  id: string;
  ticket_id: string;
  file_path: string;
  original_name: string;
  mime_type: string | null;
  created_at: string;
  privacy?: string;
};

export type AttachmentWithUrl = Attachment & {
  url: string | null;
};

// ==========================================
// ODOO / BUILDING TYPES
// ==========================================

export type BuildingInfo = {
  tenancy_id: number;
  tenancy_name: string;
  objekt_label: string;
  property_reference?: string;
  property_internal_label?: string | null;
  property_street?: string;
  property_zip?: string;
  property_city?: string;
  construction_year?: number | string | null;
  last_modernization?: number | string | null;
};

// ==========================================
// VENDOR TYPES
// ==========================================

export type OdooVendor = {
  id: number;
  name: string;
  email?: string | boolean;
  phone?: string | boolean;
  street?: string | boolean;
  zip?: string | boolean;
  city?: string | boolean;
  category_id?: any[];
};

export type ExternalVendor = {
  id: string;
  name: string;
  address?: string | null;
  phone?: string | null;
  website?: string | null;
  email?: string | null;
  rating?: number | null;
  reviewCount?: number | null;
  sourceUrl?: string | null;
  snippet?: string | null;
  source?: string | null;
};