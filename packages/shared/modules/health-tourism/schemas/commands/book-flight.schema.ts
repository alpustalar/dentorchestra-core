import { z } from 'zod';

const DatePattern = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Uçuş yolcusu. Alanlar Duffel'ın `passengers` gövdesine birebir karşılık gelir;
 * havayolu bilet kesimi için ad/soyad/doğum tarihi zorunludur (otel/transferdeki
 * "holder" tek kişiden farklı olarak her koltuk ayrı kimlik ister).
 */
export const FlightPassengerSchema = z.object({
  type: z.enum(['adult', 'child', 'infant_without_seat']).default('adult'),
  title: z.enum(['mr', 'ms', 'mrs', 'miss', 'dr']).optional(),
  givenName: z.string().min(1),
  familyName: z.string().min(1),
  bornOn: z.string().regex(DatePattern, 'YYYY-MM-DD formatında olmalı'),
  gender: z.enum(['m', 'f']).optional(),
});

export const BookFlightSchema = z.object({
  /** `search_flights`'ın ürettiği kısa token (`fl_xxxxxxxx`) — Duffel offer id'si değil. */
  optionId: z.string().min(1),
  passengers: z.array(FlightPassengerSchema).min(1),
  contactEmail: z.email(),
  contactPhone: z.string().min(1),
  patientId: z.uuid().optional(),
  leadId: z.uuid().optional(),
  clinicId: z.uuid(),
  organizationId: z.string().optional().nullable(),
  // Ödeme-önce saga'yı baypas eden manuel override: ödeme kanal dışı (havale/nakit vb.)
  // tahsil edildiyse personel bilinçli olarak true gönderir; aksi halde direkt booking reddedilir.
  manualOverride: z.boolean().optional().default(false),
});
