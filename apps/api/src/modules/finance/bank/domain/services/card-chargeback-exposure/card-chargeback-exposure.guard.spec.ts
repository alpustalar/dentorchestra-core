import { Decimal } from 'decimal.js';
import { CardChargebackExposureGuard } from './card-chargeback-exposure.guard';
import { ICardChargebackCommandRepository } from '@modules/finance/bank/domain/repositories/card-chargeback/card-chargeback.repository';
import { CollectionUnderChargebackException } from '@modules/finance/bank/domain/exceptions/bank.exceptions';

/**
 * Para geri götüren üç yol (iade, iptal, ters ibraz) aynı kümülatif tavanı
 * paylaşır. Bu kapı iade/iptal tarafına itiraz boyutunu ekler:
 *
 *   iade/iptal + aktif itirazlar + istenen ≤ tahsilat
 */
describe('CardChargebackExposureGuard', () => {
  const SOURCE_ID = '7f3a6c52-8b4e-4f0a-9d52-1c3d6e8f9a01';

  const build = (active: string) => {
    const sumActiveBySource = jest.fn(() =>
      Promise.resolve(new Decimal(active))
    );
    const repo = {
      sumActiveBySource,
    } as unknown as ICardChargebackCommandRepository;
    return { guard: new CardChargebackExposureGuard(repo), sumActiveBySource };
  };

  const params = (over: {
    collected?: string;
    reversed?: string;
    requested?: string;
  }) => ({
    sourceType: 'POS_TRANSACTION' as const,
    sourceId: SOURCE_ID,
    collectedAmount: new Decimal(over.collected ?? '1000'),
    alreadyReversedAmount: new Decimal(over.reversed ?? '0'),
    requestedAmount: new Decimal(over.requested ?? '100'),
  });

  it('aktif itirazları kaynağın türü ve kimliğiyle sorar', async () => {
    const { guard, sumActiveBySource } = build('0');

    await guard.assertReversalWithinCollection(params({}));

    expect(sumActiveBySource).toHaveBeenCalledWith({
      sourceType: 'POS_TRANSACTION',
      sourceId: SOURCE_ID,
    });
  });

  it('itiraz yoksa kapı hiçbir şeyi değiştirmez (çağıranın kendi tavanı geçerli)', async () => {
    // İade tavanı (iade ≤ satış) çağıran handler'da zaten kontrol edilir; bu
    // kapı yalnız itiraz boyutunu ekler. İtiraz yokken sessiz kalmalı.
    const { guard } = build('0');

    await expect(
      guard.assertReversalWithinCollection(
        params({ collected: '100', reversed: '150', requested: '50' })
      )
    ).resolves.toBeUndefined();
  });

  it('iade + aktif itiraz + istenen tahsilatı tam doldurursa geçer', async () => {
    const { guard } = build('300');

    await expect(
      guard.assertReversalWithinCollection(
        params({ collected: '1000', reversed: '400', requested: '300' })
      )
    ).resolves.toBeUndefined();
  });

  it('bir kuruş fazlası reddedilir — kart sahibine para iki kez giderdi', async () => {
    const { guard } = build('300');

    const error = await guard
      .assertReversalWithinCollection(
        params({ collected: '1000', reversed: '400', requested: '300.01' })
      )
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(CollectionUnderChargebackException);
    expect((error as CollectionUnderChargebackException).meta).toEqual({
      collected: '1000.00',
      alreadyReversed: '400.00',
      activeChargebacks: '300.00',
      requested: '300.01',
    });
  });

  it('açık itirazı olan satışın TAMAMI iptal edilemez', async () => {
    // İptal (void) satışın tamamını geri götürür: 400 TL'lik açık itiraz varken
    // 1000 TL'lik iptal aynı 400 TL'yi iki kez götürürdü.
    const { guard } = build('400');

    await expect(
      guard.assertReversalWithinCollection(
        params({ collected: '1000', reversed: '0', requested: '1000' })
      )
    ).rejects.toBeInstanceOf(CollectionUnderChargebackException);
  });

  it('kaybedilmiş itirazın tutarı da düşülür (aktif = açık + kaybedilen)', async () => {
    // `sumActiveBySource` OPEN + LOST toplar; kapı toplamı olduğu gibi kullanır.
    const { guard } = build('1000');

    await expect(
      guard.assertReversalWithinCollection(
        params({ collected: '1000', reversed: '0', requested: '1' })
      )
    ).rejects.toBeInstanceOf(CollectionUnderChargebackException);
  });
});
