import { Injectable } from '@nestjs/common';
import { CriticalFailurePublisher } from '@common/observability/critical-failure.publisher';
import {
  AssertQuoteOptionOwnedParams,
  IQuoteOptionOwnershipService,
} from '@modules/crm/health-tourism/shared/domain/quote-option/quote-option-ownership.service.interface';
import { checkQuoteOptionOwnership } from '@modules/crm/health-tourism/shared/domain/quote-option/quote-option-ownership.rule';
import { QuoteOptionRejectedException } from '@modules/crm/health-tourism/shared/domain/quote-option/quote-option-rejected.exception';

@Injectable()
export class QuoteOptionOwnershipService implements IQuoteOptionOwnershipService {
  constructor(private readonly criticalFailure: CriticalFailurePublisher) {}

  assertOwned({
    kind,
    optionId,
    stored,
    claimed,
  }: AssertQuoteOptionOwnedParams): void {
    const rejection = checkQuoteOptionOwnership({ stored, claimed });
    if (!rejection) return;

    // Kiracı uyuşmazlığı güvenlik olayıdır: başka bir kiracının teklifiyle
    // rezervasyon açılmaya çalışılmış. Diğer ikisi aynı kiracı içinde kalır
    // (modelin başka bir görüşmeden kimlik taşıması ya da kural öncesi kayıt).
    const isCrossTenant = rejection === 'CLINIC_MISMATCH';

    this.criticalFailure.publish({
      operation: 'health-tourism.quote-option.ownership',
      severity: isCrossTenant ? 'CRITICAL' : 'WARNING',
      summary: isCrossTenant
        ? 'Başka bir kiracının fiyat teklifiyle rezervasyon denendi.'
        : 'Fiyat teklifi bu görüşmeye ait değil; kullanım reddedildi.',
      errorMessage: rejection,
      context: {
        kind,
        optionId,
        reason: rejection,
        claimedClinicId: claimed.clinicId,
        claimedConversationId: claimed.conversationId,
        // Kaydın sahibi bilerek **kimlik olarak** yazılır: hangi kiracının
        // teklifinin okunmaya çalışıldığı olay incelemesinin tek ipucudur.
        storedClinicId: stored?.clinicId ?? null,
        storedConversationId: stored?.conversationId ?? null,
      },
      clinicId: claimed.clinicId,
      dedupeKey: `quote-option-rejected:${optionId}`,
    });

    throw new QuoteOptionRejectedException(kind, rejection);
  }
}
