/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call */
// Gerekçe: Prisma delegate'leri kasıtlı olarak gevşek tiplenmiş jest mock'larıyla taklit
// ediliyor; amaç dönen veri değil, DB'ye giden `data` yükü.
import { Decimal } from 'decimal.js';
import { PurchaseOrderCommandRepository } from './purchase-order.command.repository';
import { PrismaService } from '@src/infrastructure/persistence/prisma/prisma.service';
import { PurchaseOrder } from '@modules/supply/purchasing/domain/entities/purchase-order.entity';

/**
 * Mal kabul günlüğü mapping'i **alan-alan** yazılır (nested create). Şemaya eklenen her yeni
 * günlük kolonu buraya da eklenmek zorundadır; eklenmezse hata vermez, log üretmez ve veri
 * geri getirilemez (CLAUDE.md finans kuralı 9). Bu suite yazılan yükü kilitler.
 */
describe('PurchaseOrderCommandRepository.update — mal kabul günlüğü', () => {
  const CLINIC_ID = '11111111-1111-4111-8111-111111111111';
  const ORG_ID = '22222222-2222-4222-8222-222222222222';
  const SUPPLIER_ID = '33333333-3333-4333-8333-333333333333';

  const makeOrder = () => {
    const order = PurchaseOrder.create({
      clinicId: CLINIC_ID,
      organizationId: ORG_ID,
      supplierId: SUPPLIER_ID,
      items: [{ description: 'A', quantity: 10, unitPrice: 100, vatRate: 20 }],
    });
    order.send();
    return order;
  };

  const build = () => {
    const purchaseOrder = {
      update: jest.fn().mockImplementation(({ where }) => {
        // Repo dönüşte entity'yi yeniden kuruyor: başlık + kalemler gerekir.
        return Promise.resolve({
          ...order.toPersistence(),
          id: where.id,
          netTotal: new Decimal(1000),
          vatTotal: new Decimal(200),
          grandTotal: new Decimal(1200),
          invoicedTotal: new Decimal(0),
          items: order.lines.map((l) => ({ ...l })),
        });
      }),
    };
    const prisma = { purchaseOrder } as unknown as PrismaService;
    const order = makeOrder();
    return {
      repo: new PurchaseOrderCommandRepository(prisma),
      purchaseOrder,
      order,
    };
  };

  it('bekleyen kabul kayıtları siparişle AYNI update çağrısında nested create ile yazılır', async () => {
    const { repo, purchaseOrder, order } = build();
    order.receive([{ itemId: order.lines[0].id, quantity: 4 }], {
      receivedById: 'firebase-uid-1',
    });
    const receipt = order.pendingReceipts[0];

    await repo.update(order);

    expect(purchaseOrder.update).toHaveBeenCalledTimes(1);
    const data = purchaseOrder.update.mock.calls[0][0].data;

    expect(data.receipts.create).toEqual([
      {
        id: receipt.id,
        clinicId: CLINIC_ID,
        organizationId: ORG_ID,
        receivedAt: receipt.receivedAt,
        receivedById: 'firebase-uid-1',
        source: 'GOODS_RECEIPT',
        lines: {
          create: [
            {
              id: receipt.lines[0].id,
              itemId: order.lines[0].id,
              quantity: receipt.lines[0].quantity,
              unitPrice: receipt.lines[0].unitPrice,
            },
          ],
        },
      },
    ]);
    // Sayaç aynı yazmada ilerler.
    expect(data.items.update[0].data.quantityReceived.toNumber()).toBe(4);
  });

  it('başarılı yazmadan sonra bekleyen kayıtlar boşaltılır (çift yazım yok)', async () => {
    const { repo, order } = build();
    order.receive([{ itemId: order.lines[0].id, quantity: 4 }], {
      receivedById: null,
    });

    await repo.update(order);

    expect(order.pendingReceipts).toHaveLength(0);
  });

  it('kabulsüz güncelleme (fatura eşleştirme vb.) günlük alanı eklemez', async () => {
    const { repo, purchaseOrder, order } = build();

    await repo.update(order);

    expect(purchaseOrder.update.mock.calls[0][0].data).not.toHaveProperty(
      'receipts'
    );
  });
});
