import { z } from 'zod';

/**
 * ZOD İSTİSNASI — KASITLI: Bu şema gerçekten `.safeParse()` ile çalıştırılıyor
 * (bkz. `isOAuthStatePayload` aşağıda). Meta OAuth redirect callback'inden gelen
 * `state` parametresi güvenilmeyen (üçüncü taraf redirect) bir girdi olduğu için
 * runtime doğrulaması burada gerçek bir iş yapıyor — modülün geri kalanındaki
 * Zod şemalarının aksine (bkz. domain/contracts KURAL, CLAUDE.md).
 */
export const oAuthStatePayloadSchema = z.object({
  clinicId: z.uuid(),
  userId: z.uuid(),
  /**
   * Frontend'in `/authorize`'ı tetiklediği andaki tam sayfa yolu (locale/
   * organization-slug/clinic-slug zaten içinde). Callback bu yolu bilmeden
   * doğru sayfaya dönemez — backend bu segmentleri hiç bilmez.
   */
  returnPath: z.string(),
});

export type OAuthStatePayload = z.infer<typeof oAuthStatePayloadSchema>;

export function isOAuthStatePayload(data: unknown): data is OAuthStatePayload {
  return oAuthStatePayloadSchema.safeParse(data).success;
}
