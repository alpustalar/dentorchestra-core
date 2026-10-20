/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
// Gerekçe: Prisma delegate'leri gevşek tiplenmiş jest mock'larıyla taklit ediliyor; amaç
// dönen veri değil, üretilen `where` süzgeci.
import { Prisma } from '@prisma/client';
import { PurchaseInvoiceQueryRepository } from './purchase-invoice.query.repository';
import { PrismaService } from '@src/infrastructure/persistence/prisma/prisma.service';

/**
 * Yıl sonu GRNI tahakkuku "31 Aralık itibarıyla ne kadar faturalıydı?" sorusunu sorar.
 * Siparişin `invoicedTotal` sayacı tarihsizdir ve bu soruyu cevaplayamaz; bu sorgu fatura
 * tarihinden ve iptal anından `asOf` fotoğrafını üretir.
 */
describe('PurchaseInvoiceQueryRepository.findAmountsByOrderIdsAsOf', () => {
  const AS_OF = new Date('2026-12-31T20:59:59.999Z');

  const build = (rows: unknown[] = []) => {
    const purchaseInvoice = { findMany: jest.fn().mockResolvedValue(rows) };
    const prisma = { purchaseInvoice } as unknown as PrismaService;
    return {
      repo: new PurchaseInvoiceQueryRepository(prisma),
      purchaseInvoice,
    };
  };

  it('sipariş kimliği yoksa DB’ye gitmez', async () => {
    const { repo, purchaseInvoice } = build();

    await expect(
      repo.findAmountsByOrderIdsAsOf({
        clinicId: 'c1',
        orderIds: [],
        asOf: AS_OF,
      })
    ).resolves.toEqual([]);
    expect(purchaseInvoice.findMany).not.toHaveBeenCalled();
  });

  it('kliniğe, siparişlere ve asOf’a göre süzer; taslak faturayı dışlar', async () => {
    const { repo, purchaseInvoice } = build();
    await repo.findAmountsByOrderIdsAsOf({
      clinicId: 'c1',
      orderIds: ['o1', 'o2'],
      asOf: AS_OF,
    });

    const where = purchaseInvoice.findMany.mock.calls[0][0].where;
    expect(where.clinicId).toBe('c1');
    expect(where.purchaseOrderId).toEqual({ in: ['o1', 'o2'] });
    // Fatura tarihi asOf'u aşamaz: ocak ayında kesilen fatura 31 Aralık tahakkukunu düşürmez.
    expect(where.invoiceDate).toEqual({ lte: AS_OF });
    // DRAFT muhasebeleşmedi.
    expect(where.status).toEqual({ not: 'DRAFT' });
  });

  it('iptal edilmiş fatura yalnız iptal asOf’tan SONRA olduysa sayılır', async () => {
    const { repo, purchaseInvoice } = build();
    await repo.findAmountsByOrderIdsAsOf({
      clinicId: 'c1',
      orderIds: ['o1'],
      asOf: AS_OF,
    });

    // O anda defterdeydi (storno sonradan atıldı) → tahakkuk hesabında faturalı sayılır.
    // Tersi (iptal asOf'tan önce) fatura hiç yokmuş gibidir.
    expect(purchaseInvoice.findMany.mock.calls[0][0].where.OR).toEqual([
      { status: { not: 'CANCELLED' } },
      { cancelledAt: { gt: AS_OF } },
    ]);
  });

  it('matrahı kuruş ölçeğinde string olarak döner', async () => {
    const { repo } = build([
      {
        id: 'inv-1',
        purchaseOrderId: 'o1',
        invoiceDate: new Date('2026-12-01'),
        netTotal: new Prisma.Decimal('1234.5'),
        currency: 'TRY',
        lineAccountCode: '150',
      },
    ]);

    await expect(
      repo.findAmountsByOrderIdsAsOf({
        clinicId: 'c1',
        orderIds: ['o1'],
        asOf: AS_OF,
      })
    ).resolves.toEqual([
      {
        invoiceId: 'inv-1',
        purchaseOrderId: 'o1',
        invoiceDate: new Date('2026-12-01'),
        netTotal: '1234.50',
        currency: 'TRY',
        lineAccountCode: '150',
      },
    ]);
  });
});
