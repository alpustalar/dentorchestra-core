import { ForbiddenException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { RecordProductUsageHandler } from './record-product-usage.handler';
import { RecordProductUsageCommand } from './record-product-usage.command';
import { PolicyFactory } from '@modules/platform/policy/staff/application/policy-factory';
import { ExecutionSources } from '../../../../../../../../../packages/shared/common/constants/execution-source.constant';
import {
  NoAvailableStockException,
  ProductNotFoundException,
  ProductNotUsableInClinicException,
} from '@modules/supply/inventory/domain/exceptions/inventory.exceptions';
import { ActorContext } from '@common/interfaces';
import { LogSource } from '@src/domain/constants/log-action.constant';
import type { IGetContext } from '@common/decorators/get-context.decorator';
import type { RecordProductUsageDto } from '@shared/modules/inventory/dto/commands';

/**
 * Tüketim düşümü de `clinics/:clinicId/stock/usage` altında; kiracı sınırı
 * yalnız burada doğrulanır (guard yeteneğe bakar, kiracıya bakmaz).
 */
describe('RecordProductUsageHandler — klinik kapsamı', () => {
  const CLINIC_A = 'clinic-a';
  const ORG_1 = 'org-1';

  const buildActor = (overrides: Partial<ActorContext>): ActorContext => ({
    userId: 'user-1',
    email: 'staff@clinic.com',
    source: LogSource.WEB,
    capabilities: ['stockmovement:create'],
    rolePriority: 50,
    managedClinics: [],
    ownedOrganizations: [],
    ...overrides,
  });

  const run = (actor: ActorContext, clinicId: string) => {
    const productRepo = {
      findByIdForUpdate: jest.fn().mockResolvedValue(null),
    };
    const txManager = { outboxRun: jest.fn((cb: () => unknown) => cb()) };

    const handler = new RecordProductUsageHandler(
      productRepo as never,
      { findById: jest.fn(), findAvailableByProduct: jest.fn() } as never,
      { create: jest.fn() } as never,
      { resolve: jest.fn().mockResolvedValue(ORG_1) } as never,
      new PolicyFactory(new EventEmitter2()),
      txManager as never
    );

    const ctx: IGetContext = { actor, source: ExecutionSources.USER_ACTION };
    const dto = {
      productId: 'product-1',
      quantity: 1,
    } as RecordProductUsageDto;

    return {
      txManager,
      execute: () =>
        handler.execute(new RecordProductUsageCommand(clinicId, dto, ctx)),
    };
  };

  it('başka kiracının kliniğinden stok düşümü reddedilir — transaction açılmaz', async () => {
    const { execute, txManager } = run(
      buildActor({ clinicId: CLINIC_A, organizationId: ORG_1 }),
      'other-tenant-clinic'
    );

    await expect(execute()).rejects.toThrow(ForbiddenException);
    expect(txManager.outboxRun).not.toHaveBeenCalled();
  });

  it('kendi kliniğinde düşüm kapıdan geçer', async () => {
    const { execute, txManager } = run(
      buildActor({ clinicId: CLINIC_A, organizationId: ORG_1 }),
      CLINIC_A
    );

    await expect(execute()).rejects.toThrow(ProductNotFoundException);
    expect(txManager.outboxRun).toHaveBeenCalled();
  });

  it('organizasyon sahibi kendi org’undaki klinikte düşüm yapabilir', async () => {
    const { execute } = run(
      buildActor({
        clinicId: undefined,
        ownedOrganizations: [{ id: ORG_1 }],
        organizationId: ORG_1,
      }),
      CLINIC_A
    );

    await expect(execute()).rejects.toThrow(ProductNotFoundException);
  });
});

/**
 * Tüketimin **sebebi** (hangi randevu) ve kaynağı (hangi parti) ayrı bir kayıtta
 * tutulur; uç `appointmentId` alıyor ama hiçbir yere yazmıyordu.
 */
describe('RecordProductUsageHandler — tüketim kaydı ve parti seçimi', () => {
  const CLINIC_A = '11111111-1111-4111-8111-111111111111';
  const CLINIC_B = '22222222-2222-4222-8222-222222222222';
  const ORG_1 = '33333333-3333-4333-8333-333333333333';
  const PRODUCT_ID = '44444444-4444-4444-8444-444444444444';
  const BATCH_ID = '55555555-5555-4555-8555-555555555555';
  const FOREIGN_BATCH_ID = '66666666-6666-4666-8666-666666666666';
  const APPOINTMENT_ID = '77777777-7777-4777-8777-777777777777';

  const actor: ActorContext = {
    userId: 'aB3xY9zQ7wE1rT5yU8iO2pL4kJ6h',
    email: 'staff@clinic.com',
    source: LogSource.WEB,
    capabilities: ['stockmovement:create'],
    rolePriority: 50,
    managedClinics: [{ id: CLINIC_A }],
    ownedOrganizations: [],
    clinicId: CLINIC_A,
    organizationId: ORG_1,
  };

  const build = (
    options: {
      productClinicId?: string;
      available?: { id: string; quantity: number }[];
      batchId?: string | null;
    } = {}
  ) => {
    const deductQuantity = jest.fn<void, [{ movementId: string }]>();
    const batch = {
      id: { value: options.available?.[0]?.id ?? BATCH_ID },
      deductQuantity,
    };

    const productRepo = {
      findByIdForUpdate: jest.fn().mockResolvedValue({
        id: { value: PRODUCT_ID },
        clinicId: { value: options.productClinicId ?? CLINIC_A },
        isActive: true,
        deletedAt: null,
      }),
    };

    const batchRepo = {
      findById: jest.fn(),
      findAvailableByProduct: jest
        .fn()
        .mockResolvedValue(options.available === undefined ? [batch] : []),
      update: jest.fn(),
    };

    const usageCreate = jest.fn((u: unknown) => Promise.resolve(u));

    const handler = new RecordProductUsageHandler(
      productRepo as never,
      batchRepo as never,
      { create: usageCreate } as never,
      { resolve: jest.fn().mockResolvedValue(ORG_1) } as never,
      new PolicyFactory(new EventEmitter2()),
      { outboxRun: jest.fn((cb: () => unknown) => cb()) } as never
    );

    const ctx: IGetContext = { actor, source: ExecutionSources.USER_ACTION };
    const dto = {
      productId: PRODUCT_ID,
      quantity: 2,
      appointmentId: APPOINTMENT_ID,
      batchId: options.batchId ?? null,
      notes: 'Dolgu işleminde kullanıldı',
    } as RecordProductUsageDto;

    return {
      deductQuantity,
      batchRepo,
      usageCreate,
      execute: () =>
        handler.execute(new RecordProductUsageCommand(CLINIC_A, dto, ctx)),
    };
  };

  it('tüketim kaydı randevu + parti + hareket kimliğiyle yazılır', async () => {
    const { execute, usageCreate, deductQuantity } = build();

    await execute();

    expect(usageCreate).toHaveBeenCalledTimes(1);
    const usage = usageCreate.mock.calls[0][0] as {
      appointmentId: string | null;
      batchId: string | null;
      stockMovementId: string | null;
      quantity: { value: { toNumber(): number } };
    };

    expect(usage.appointmentId).toBe(APPOINTMENT_ID);
    expect(usage.batchId).toBe(BATCH_ID);
    expect(usage.quantity.value.toNumber()).toBe(2);

    // Hareket kimliği hem partiye hem tüketim kaydına aynı değerle geçer:
    // hareket kaydını dinleyici yazar, bağ bu kimlikle kurulur.
    expect(usage.stockMovementId).toBe(
      deductQuantity.mock.calls[0][0].movementId
    );
  });

  it('yabancı parti kimliği verilse bile o partiden düşülmez', async () => {
    // Regresyon: `findById(dto.batchId)` çağrılıyordu — kapsam kontrolü
    // olmadığı için başka ürünün/kliniğin partisinden düşülebiliyordu.
    const { execute, batchRepo } = build({ batchId: FOREIGN_BATCH_ID });

    await expect(execute()).rejects.toBeInstanceOf(NoAvailableStockException);
    expect(batchRepo.findById).not.toHaveBeenCalled();
    expect(batchRepo.update).not.toHaveBeenCalled();
  });

  it('kullanılabilir parti yoksa domain hatası (HTTP exception değil)', async () => {
    const { execute } = build({ available: [] });

    await expect(execute()).rejects.toBeInstanceOf(NoAvailableStockException);
  });

  it('başka kliniğin ürününden tüketim yapılamaz', async () => {
    const { execute, batchRepo } = build({ productClinicId: CLINIC_B });

    await expect(execute()).rejects.toBeInstanceOf(
      ProductNotUsableInClinicException
    );
    expect(batchRepo.update).not.toHaveBeenCalled();
  });
});
