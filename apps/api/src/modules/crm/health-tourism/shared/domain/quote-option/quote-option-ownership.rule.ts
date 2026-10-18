import {
  QuoteOptionClaim,
  QuoteOptionOwner,
  QuoteOptionRejection,
} from '@modules/crm/health-tourism/shared/domain/quote-option/quote-option.contracts';

export interface QuoteOptionOwnershipInput {
  /** Önbellekteki kaydın taşıdığı sahip; kural öncesi yazılmış kayıtlarda yok. */
  readonly stored: QuoteOptionOwner | null | undefined;
  /** Teklifi kullanmak isteyen tarafın kapsamı. */
  readonly claimed: QuoteOptionClaim;
}

/**
 * Teklif bu görüşmeye mi ait? Uyuşmazlık sebebini döner, uyuşuyorsa `null`.
 *
 * **Fail-closed:** sahip bilgisi yoksa teklif kullanılmaz. Bedeli en fazla bir
 * yeniden arama (TTL ≤ 15 dk), kazancı "anahtarı bilen kullanır"ın kapanması.
 *
 * Anahtarın kendisi yetki değildir: `optionId` bir **adres**, sahiplik ise kaydın
 * içinde yazılı olan şey. Aynı ayrım DB tarafında zaten uygulanıyor
 * (`AiToolSupport.loadOwnedAppointment` → `detail.patientId !== context.patientId`);
 * eksik olan, önbellekten okunan teklifti.
 */
export function checkQuoteOptionOwnership({
  stored,
  claimed,
}: QuoteOptionOwnershipInput): QuoteOptionRejection | null {
  if (!stored?.clinicId || !stored.conversationId) return 'OWNER_MISSING';
  if (stored.clinicId !== claimed.clinicId) return 'CLINIC_MISMATCH';
  // Görüşme bağlamı olmayan çağıran (personel ucu) yalnız kiracı eşleşmesine tabidir:
  // kliniğin kendi teklifini elle tamamlaması meşru bir akış.
  if (
    claimed.conversationId !== null &&
    stored.conversationId !== claimed.conversationId
  )
    return 'CONVERSATION_MISMATCH';
  return null;
}
