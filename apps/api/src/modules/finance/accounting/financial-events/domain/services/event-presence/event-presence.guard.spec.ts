import { FinancialEventPresenceGuard } from './event-presence.guard';
import { IFinancialEventCommandRepository } from '@modules/finance/accounting/financial-events/domain/repositories/financial-event/financial-event.command.repository';
import { FinancialEvent } from '@modules/finance/accounting/financial-events/domain/entities/financial-event.entity';
import { FinancialEventNotRecordedException } from '@modules/finance/accounting/financial-events/domain/exceptions';

/**
 * Bir kaydı (kart itirazı) defterdeki başka bir olaya dayandırmadan önce o
 * olayın YAZILDIĞI kanıtlanır. `dedupeKey` global tekildir ama kiracı doğrulanır.
 */
describe('FinancialEventPresenceGuard', () => {
  const CLINIC_ID = '11111111-1111-4111-8111-111111111111';
  const OTHER_CLINIC_ID = '22222222-2222-4222-8222-222222222222';
  const KEY = 'payment-received:pos:abc';

  const build = (event: Pick<FinancialEvent, 'clinicId'> | null) => {
    // Kilitsiz/başka okuma yolu bilerek tanımsız.
    const findByDedupeKey = jest.fn(() =>
      Promise.resolve(event as FinancialEvent | null)
    );
    const repo = {
      findByDedupeKey,
    } as unknown as IFinancialEventCommandRepository;
    return { guard: new FinancialEventPresenceGuard(repo), findByDedupeKey };
  };

  const eventOf = (clinicId: string) =>
    ({ clinicId: { value: clinicId } }) as unknown as FinancialEvent;

  it('olay aynı kliniğe yazılmışsa geçer', async () => {
    const { guard, findByDedupeKey } = build(eventOf(CLINIC_ID));

    await expect(
      guard.assertRecorded({ clinicId: CLINIC_ID, dedupeKey: KEY })
    ).resolves.toBeUndefined();
    expect(findByDedupeKey).toHaveBeenCalledWith(KEY);
  });

  it('olay yoksa varsayılan hata fırlar (kanıt yok)', async () => {
    const { guard } = build(null);

    await expect(
      guard.assertRecorded({ clinicId: CLINIC_ID, dedupeKey: KEY })
    ).rejects.toBeInstanceOf(FinancialEventNotRecordedException);
  });

  it('çağıran kendi bağlamının hatasını geçebilir', async () => {
    const { guard } = build(null);
    class ContextError extends Error {}

    await expect(
      guard.assertRecorded(
        { clinicId: CLINIC_ID, dedupeKey: KEY },
        new ContextError('bağlam hatası')
      )
    ).rejects.toBeInstanceOf(ContextError);
  });

  it('BAŞKA kliniğin olayı bu kliniğin kanıtı sayılmaz (dedupeKey global tekil)', async () => {
    const { guard } = build(eventOf(OTHER_CLINIC_ID));

    await expect(
      guard.assertRecorded({ clinicId: CLINIC_ID, dedupeKey: KEY })
    ).rejects.toBeInstanceOf(FinancialEventNotRecordedException);
  });

  describe('isRecorded (salt-okur)', () => {
    it('aynı kliniğe yazılmış olay → true', async () => {
      const { guard } = build(eventOf(CLINIC_ID));
      await expect(
        guard.isRecorded({ clinicId: CLINIC_ID, dedupeKey: KEY })
      ).resolves.toBe(true);
    });

    it('olay yok → false (fırlatmaz)', async () => {
      const { guard } = build(null);
      await expect(
        guard.isRecorded({ clinicId: CLINIC_ID, dedupeKey: KEY })
      ).resolves.toBe(false);
    });

    it('başka kliniğin olayı → false (kiracı doğrulanır)', async () => {
      const { guard } = build(eventOf(OTHER_CLINIC_ID));
      await expect(
        guard.isRecorded({ clinicId: CLINIC_ID, dedupeKey: KEY })
      ).resolves.toBe(false);
    });
  });
});
