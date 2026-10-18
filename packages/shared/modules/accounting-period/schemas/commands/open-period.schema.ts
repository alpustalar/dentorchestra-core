import { z } from 'zod';

/**
 * Muhasebe dönemi açma.
 *
 * `organizationId` **yoktur**: kiracı kimliği istemciden alınmaz, `clinicId`'den
 * çözülür (bkz. CLAUDE.md — TenantScopeResolver). Yıl aralığı hem burada (HTTP
 * sınırı) hem `AccountingPeriod.create()` içinde doğrulanır: dönem iç akışlardan
 * (klinik kaydı, zamanlanmış iş) da açılıyor ve oralarda DTO devreye girmiyor.
 */
export const OpenPeriodSchema = z.object({
  clinicId: z.uuid(),
  year: z.coerce.number().int().min(2000).max(2100),
});
