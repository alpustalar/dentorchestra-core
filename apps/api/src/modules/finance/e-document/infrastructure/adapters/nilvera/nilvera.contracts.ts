import { z } from 'zod';

export const NilveraIssueResponseSchema = z.object({
  UUID: z.uuid(),
  InvoiceNumber: z.string().nullable().optional(),
});
export type NilveraIssueResponse = z.infer<typeof NilveraIssueResponseSchema>;

export const NilveraStatusResponseSchema = z.object({
  StatusCode: z.string().nullable().optional(),
  StatusDetail: z.string().nullable().optional(),
  CancelStatus: z.boolean().optional(),
});
export type NilveraStatusResponse = z.infer<typeof NilveraStatusResponseSchema>;

export const NilveraTaxpayerCheckResponseSchema = z.object({
  TaxNumber: z.string().nullable().optional(),
  Title: z.string().nullable().optional(),
});

export const NilveraCompanyResponseSchema = z.object({
  Name: z.string().nullable().optional(),
  Title: z.string().nullable().optional(),
  TaxNumber: z.string().nullable().optional(),
});

export interface NilveraPartyData {
  TaxNumber: string;
  Name: string;
  TaxOffice?: string;
  Address?: string;
  District?: string;
  City?: string;
  Country: string;
  Phone?: string;
  Mail?: string;
}

export interface NilveraInvoiceLineData {
  Index: string;
  Name: string;
  Quantity: number;
  UnitType: 'C62';
  Price: number;
  AllowanceTotal: 0;
  KDVPercent: number;
  KDVTotal: number;
}
