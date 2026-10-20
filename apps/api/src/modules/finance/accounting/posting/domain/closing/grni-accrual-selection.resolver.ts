import { Decimal } from 'decimal.js';
import type { GrniAccrualCandidate } from '@shared/modules/accounting-period/interfaces';
import type { GrniAccrualSelection } from '@shared/modules/accounting-period/types/commands';
import type { ClosingAccrual } from '@modules/finance/accounting/posting/domain/closing/year-end-closing.planner';
import { GrniAccrualNotEligibleException } from '@modules/finance/accounting/posting/domain/exceptions/year-end-closing.exceptions';

/**
 * Muhasebecinin tahakkuk SEÇİMİNİ (sipariş + borç hesabı) sunucunun hesapladığı aday listesine
 * bağlar ve planlayıcının girdisi olan `ClosingAccrual`'a çevirir.
 *
 * Tutar HİÇBİR ZAMAN istemciden gelmez: seçim yalnız *hangi* adayın tahakkuk edileceğini söyler;
 * tutar adaydan alınır. İstemcinin gönderdiği bir tutar yıl sonu kapanışında deftere para
 * yazdırmanın yolu olurdu (aday listesinin dışındaki sipariş de seçilemez).
 */
export function resolveGrniAccruals(props: {
  candidates: readonly GrniAccrualCandidate[];
  selections: readonly GrniAccrualSelection[];
}): ClosingAccrual[] {
  const byOrderId = new Map(props.candidates.map((c) => [c.orderId, c]));

  return props.selections.map((selection) => {
    const candidate = byOrderId.get(selection.orderId);
    if (!candidate) {
      throw new GrniAccrualNotEligibleException({
        orderId: selection.orderId,
        reason: 'NOT_A_CANDIDATE',
      });
    }
    if (!candidate.accruable) {
      throw new GrniAccrualNotEligibleException({
        orderId: selection.orderId,
        reason: candidate.notAccruableReason ?? 'NOT_A_CANDIDATE',
      });
    }

    return {
      orderId: candidate.orderId,
      debitAccountCode: selection.debitAccountCode,
      amount: new Decimal(candidate.accrualAmount),
      label: `Sipariş ${candidate.orderId}`,
    };
  });
}
