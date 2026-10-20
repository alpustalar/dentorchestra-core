import { ForbiddenException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AdjustStockHandler } from './adjust-stock.handler';
import { AdjustStockCommand } from './adjust-stock.command';
import { PolicyFactory } from '@modules/platform/policy/staff/application/policy-factory';
import { ExecutionSources } from '../../../../../../../../../packages/shared/common/constants/execution-source.constant';
import { ProductNotUsableInClinicException } from '@modules/supply/inventory/domain/exceptions/inventory.exceptions';
import { ActorContext } from '@common/interfaces';
import { LogSource } from '@src/domain/constants/log-action.constant';
import type { IGetContext } from '@common/decorators/get-context.decorator';
import type { AdjustStock } from '@shared';

/**
 * Sayım düzeltmesi stoğu belgesiz değiştiren tek uçtur: yetki **yazmanın
 * yapılacağı** klinik üzerinden değerlendirilmeli ve ürün o klinikte
 * kullanılabilir olmalı.
 */
describe('AdjustStockHandler — klinik kapsamı ve ürün kapısı', () => {
  const CLINIC_A = '11111111-1111-4111-8111-111111111111';
  const CLINIC_B = '22222222-2222-4222-8222-222222222222';
  const ORG_1 = '33333333-3333-4333-8333-333333333333';
  const PRODUCT_ID = '44444444-4444-4444-8444-444444444444';

  const buildActor = (overrides: Partial<ActorContext>): ActorContext => ({
    userId: 'aB3xY9zQ7wE1rT5yU8iO2pL4kJ6h',
    email: 'staff@clinic.com',
    source: LogSource.WEB,
    capabilities: ['stockmovement:create'],
    rolePriority: 50,
    managedClinics: [],
    ownedOrganizations: [],
    ...overrides,
  });

  const build = (
    options: {
      actor?: ActorContext;
      clinicId?: string;
      productClinicId?: string;
      deletedAt?: Date | null;
    } = {}
  ) => {
    const handleStockChange = jest.fn().mockReturnValue({ id: 'batch' });
    const product = {
      id: { value: PRODUCT_ID },
      clinicId: { value: options.productClinicId ?? CLINIC_A },
      isActive: true,
      deletedAt: options.deletedAt ?? null,
      handleStockChange,
    };

    const productRepo = {
      findById: jest.fn().mockResolvedValue(product),
      findByIdForUpdate: jest.fn().mockResolvedValue(product),
      update: jest.fn(),
    };
    const batchRepo = {
      findAvailableByProduct: jest.fn().mockResolvedValue([]),
      update: jest.fn(),
    };
    const outboxRun = jest.fn((cb: () => unknown) => cb());

    const handler = new AdjustStockHandler(
      productRepo as never,
      batchRepo as never,
      new PolicyFactory(new EventEmitter2()),
      { resolve: jest.fn().mockResolvedValue(ORG_1) } as never,
      { outboxRun } as never
    );

    const ctx: IGetContext = {
      actor:
        options.actor ??
        buildActor({
          clinicId: CLINIC_A,
          organizationId: ORG_1,
          managedClinics: [{ id: CLINIC_A }],
        }),
      source: ExecutionSources.USER_ACTION,
    };

    const data = {
      productId: PRODUCT_ID,
      quantityDelta: -2,
      notes: 'Sayım farkı',
    } as AdjustStock;

    return {
      batchRepo,
      outboxRun,
      handleStockChange,
      execute: () =>
        handler.execute(
          new AdjustStockCommand({
            clinicId: options.clinicId ?? CLINIC_A,
            data,
            ctx,
          })
        ),
    };
  };

  it('başka kiracının kliniğinde düzeltme reddedilir — transaction açılmaz', async () => {
    const { execute, outboxRun } = build({ clinicId: CLINIC_B });

    await expect(execute()).rejects.toThrow(ForbiddenException);
    expect(outboxRun).not.toHaveBeenCalled();
  });

  it('ürün başka kliniğe aitse düzeltme reddedilir', async () => {
    // Regresyon: yetki `product.clinicId` üzerinden kontrol ediliyordu; aktör
    // kendi ürününde yetkili görünüp hareketi URL'deki klinikle damgalıyordu.
    const { execute, outboxRun } = build({ productClinicId: CLINIC_B });

    await expect(execute()).rejects.toBeInstanceOf(
      ProductNotUsableInClinicException
    );
    expect(outboxRun).not.toHaveBeenCalled();
  });

  it('silinmiş ürüne düzeltme yapılamaz', async () => {
    const { execute } = build({ deletedAt: new Date() });

    await expect(execute()).rejects.toBeInstanceOf(
      ProductNotUsableInClinicException
    );
  });

  it('kendi kliniğinin ürününde düzeltme parti üzerinden yazılır', async () => {
    const { execute, batchRepo, handleStockChange } = build();

    await execute();

    expect(handleStockChange).toHaveBeenCalledTimes(1);
    // Parti her zaman döner (partisiz artış artık domain hatası): ürün değil
    // parti yazılır.
    expect(batchRepo.update).toHaveBeenCalledTimes(1);
  });
});
