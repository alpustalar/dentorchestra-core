import { Decimal } from 'decimal.js';
import { z } from 'zod';
import type {
  EDocumentRequest,
  PartyTaxInfo,
} from '@modules/finance/e-document/domain/contracts/e-document.contracts';
import type {
  NilveraInvoiceLineData,
  NilveraPartyData,
} from './nilvera.contracts';

const RequiredTaxIdSchema = z.string().min(10).max(11);

const moneyToNumber = (value: string, field: string): number => {
  const amount = new Decimal(value);
  if (!amount.isFinite() || amount.isNegative()) {
    throw new Error(`Nilvera ${field} geçersiz: ${value}`);
  }
  return amount.toNumber();
};

const compact = <T extends Record<string, unknown>>(value: T): T =>
  Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined)
  ) as T;

const partyData = (party: PartyTaxInfo, role: string): NilveraPartyData => {
  const taxId = RequiredTaxIdSchema.parse(party.taxId);
  if (!party.name.trim()) {
    throw new Error(`Nilvera ${role} unvanı/adı zorunludur.`);
  }

  return compact({
    TaxNumber: taxId,
    Name: party.name.trim(),
    TaxOffice: party.taxOffice?.trim() || undefined,
    Address: party.address?.trim() || undefined,
    District: party.district?.trim() || undefined,
    City: party.city?.trim() || undefined,
    Country: 'Türkiye',
    Phone: party.phone?.trim() || undefined,
    Mail: party.email?.trim() || undefined,
  });
};

const invoiceLines = (req: EDocumentRequest): NilveraInvoiceLineData[] =>
  req.lines.map((line, index) => ({
    Index: String(index + 1),
    Name: line.name,
    Quantity: line.quantity,
    UnitType: 'C62',
    Price: moneyToNumber(line.unitPrice, `satır ${index + 1} fiyatı`),
    AllowanceTotal: 0,
    KDVPercent: line.vatRate,
    KDVTotal: moneyToNumber(line.vatAmount, `satır ${index + 1} KDV'si`),
  }));

const invoiceInfo = (req: EDocumentRequest) => ({
  UUID: z.uuid().parse(req.idempotencyKey),
  InvoiceType: 'SATIS',
  IssueDate: req.issueDate.toISOString(),
  CurrencyCode: req.currency,
  LineExtensionAmount: moneyToNumber(req.totals.net, 'net toplamı'),
  GeneralAllowanceTotal: 0,
  PayableAmount: moneyToNumber(req.totals.payable, 'ödenecek toplamı'),
  KdvTotal: moneyToNumber(req.totals.vat, 'KDV toplamı'),
});

export const mapNilveraEInvoicePayload = (req: EDocumentRequest) => ({
  EInvoice: {
    InvoiceInfo: {
      ...invoiceInfo(req),
      InvoiceProfile: 'TEMELFATURA',
    },
    CompanyInfo: partyData(req.seller, 'satıcı'),
    CustomerInfo: partyData(req.buyer, 'alıcı'),
    InvoiceLines: invoiceLines(req),
    Notes: req.note ? [req.note] : [],
  },
  CustomerAlias: req.buyer.alias ?? null,
});

export const mapNilveraEArchivePayload = (req: EDocumentRequest) => ({
  ArchiveInvoice: {
    InvoiceInfo: {
      ...invoiceInfo(req),
      SalesPlatform: 'NORMAL',
      SendType: 'ELEKTRONIK',
    },
    CompanyInfo: partyData(req.seller, 'satıcı'),
    CustomerInfo: partyData(req.buyer, 'alıcı'),
    InvoiceLines: invoiceLines(req),
    Notes: req.note ? [req.note] : [],
  },
});
