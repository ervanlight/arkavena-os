import type { Tables, TablesInsert, Enums } from '@/core/db/database.types';

// Quality (Hold Points)
export type Inspection = Tables<'inspections'>;
export type NewInspection = TablesInsert<'inspections'>;
export type InspectionStatus = Enums<'inspection_status'>;

export type Nonconformity = Tables<'nonconformities'>;
export type HoldPointTemplate = Tables<'hold_point_templates'>;

// Procurement (Subcontractor Quotes)
export type VendorQuote = Tables<'vendor_quotes'>;
export type VendorQuoteStatus = Enums<'vendor_quote_status'>;
export type PurchaseOrder = Tables<'purchase_orders'>;

export type ReviewItemType = 'hold_point' | 'subcon_quote' | 'daily_report' | 'variation';

// Aggregated View for Inbox
export interface ReviewInboxItem {
  id: string; // The ID of the inspection, quote, daily_log, or change_order
  type: ReviewItemType;
  title: string;
  subtitle: string;
  status: string; // 'pending' | 'under_review' | etc
  submittedAt: string;
  projectId: string;
  projectName: string;
  zoneId?: string;
  zoneName?: string;
  amountRp?: bigint; // For quotes/variations
  submittedBy?: {
    id: string;
    name: string;
  };
}
