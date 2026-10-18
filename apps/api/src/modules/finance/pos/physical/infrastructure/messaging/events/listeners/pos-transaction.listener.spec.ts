import { PosTransactionListener } from './pos-transaction.listener';
import { PosTransactionReversedEvent } from '@modules/finance/pos/physical/domain/events/pos-transaction-reversed.event';
import { PosTransactionSucceededEvent } from '@modules/finance/pos/physical/domain/events/pos-transaction-succeeded.event';
import { AuditLogService } from '@modules/platform/audit-log/audit-log.service';
import { LogAction, LogType } from '@src/domain/constants/log-action.constant';
import PosTransactionKindSchema from '@input-type-schemas/PosTransactionKindSchema';
import { Decimal } from 'decimal.js';

/**
 * Ters kaydın denetim izi yalnız uygulama log'unda kalırsa bir itiraz
 * incelemesinde kaynak olamaz (log'lar rotasyona tabi). Bu dinleyici
 * iptal/iadeyi `audit_logs`'a yazar; testler yazımın gerçekten olduğunu ve
 * aktörün taşındığını kilitler.
 */
interface AuditWrite {
  action: LogAction;
  actorId?: string;
  details: Record<string, unknown>;
}

describe('PosTransactionListener — ters kayıt denetim izi', () => {
  const REVERSER = 'firebase-uid-iptali-yapan';

  const makeEvent = (overrides: Partial<{ type: LogType }> = {}) =>
    new PosTransactionReversedEvent({
      posTransactionId: 'tx-1',
      originalPosTransactionId: 'tx-0',
      clinicId: 'clinic-1',
      kind: PosTransactionKindSchema.enum.VOID,
      paymentId: 'pay-1',
      externalRef: 'HOSTREF-1',
      amount: '75.50',
      currency: 'TRY',
      action: LogAction.POS_TRANSACTION_REVERSED,
      type: overrides.type ?? LogType.INFO,
      actorId: REVERSER,
    });

  const build = () => {
    const info = jest.fn(() => Promise.resolve());
    const error = jest.fn(() => Promise.resolve());
    const auditLogService = { info, error } as unknown as AuditLogService;
    return {
      listener: new PosTransactionListener(auditLogService),
      info,
      error,
    };
  };

  it('iptali audit log a aktör ve tutarla birlikte yazar', async () => {
    const { listener, info } = build();

    await listener.handleReversed(makeEvent());

    expect(info).toHaveBeenCalledTimes(1);
    const payload = (info.mock.calls[0] as unknown as [AuditWrite])[0];
    expect(payload.action).toBe(LogAction.POS_TRANSACTION_REVERSED);
    expect(payload.actorId).toBe(REVERSER);
    expect(payload.details.kind).toBe(PosTransactionKindSchema.enum.VOID);
    expect(payload.details.originalPosTransactionId).toBe('tx-0');
    expect(payload.details.amount).toBe('75.50');
  });

  it('audit yazımı patlasa bile dinleyici hata fırlatmaz', async () => {
    // Ters kayıt zaten yazıldı; audit hatası onu geri almaz. Fırlatmak
    // in-memory event kanalında işi yarıda bırakmaktan başka şey yapmaz.
    const { listener, info } = build();
    info.mockRejectedValueOnce(new Error('mongo düştü') as never);

    await expect(listener.handleReversed(makeEvent())).resolves.toBeUndefined();
  });

  it('başarı olayı audit log a yazılmaz (yalnız uygulama log u)', () => {
    // Her başarılı çekim denetim kaydı üretirse asıl olaylar gürültüye boğulur.
    const { listener, info, error } = build();

    listener.handleSuccess(
      new PosTransactionSucceededEvent({
        posTransactionId: 'tx-2',
        clinicId: 'clinic-1',
        paymentId: null,
        externalRef: 'HOSTREF-2',
        amount: new Decimal('10.00'),
        currency: 'TRY',
      })
    );

    expect(info).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });
});
