import { z } from 'zod';

/**
 * `returnPath` OAuth sonrası dönülecek frontend yoludur (locale/org-slug/
 * clinic-slug zaten içinde — backend bu segmentleri bilmez). Open-redirect'i
 * engellemek için tek `/` ile açılan, protokolsüz bir relative path olmak
 * zorundadır (`//evil.com` gibi protocol-relative yollar da reddedilir).
 */
export const InitiateMetaOAuthSchema = z.object({
  clinicId: z.uuid(),
  returnPath: z
    .string()
    .regex(/^\/(?!\/)[\w\-/]*$/)
    .optional(),
});
