import { ForbiddenException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ReceiveStockHandler } from './receive-stock.handler';
import { ReceiveStockCommand } from './receive-stock.command';
import { PolicyFactory } from '@modules/platform/policy/staff/application/policy-factory';
import { ExecutionSources } from '@src/domain/constants/execution-source.constant';
import {
  ProductNotFoundException,
  ProductNotUsableInClinicException,
} from '@modules/supply/inventory/domain/exceptions/inventory.exceptions';
import { ActorContext } from '@common/interfaces';
import { LogSource } from '@src/domain/constants/log-action.constant';
import type { IGetContext } from '@common/decorators/get-context.decorator';
import type { ReceiveStockDto } from '@shared/modules/inventory/dto/commands';

/**
 * `clinicId` URL parametresinden gelir; `CapabilityGuard` yalnız aktörde
 * `stockmovement:create` var mı diye bakar, hangi kiracının kliniği olduğuna
 * bakmaz. Kiracı sınırı bu yüzden handler'da doğrulanır.
 */
describe('ReceiveStockHandler — klinik kapsamı', () => {
  const CLINIC_A = 'clinic-a';
  const CLINIC_B = 'clinic-b';
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
    const productRepo = { findById: jest.fn().mockResolvedValue(null) };
    const handler = new ReceiveStockHandler(
      productRepo as never,
      { create: jest.fn() } as never,
      { create: jest.fn() } as never,
      { resolve: jest.fn().mockResolvedValue(ORG_1) } as never,
      new PolicyFactory(new EventEmitter2()),
      { run: jest.fn((cb: () => unknown) => cb()) } as never
    );

    const ctx: IGetContext = { actor, source: ExecutionSources.USER_ACTION };
    const dto = { productId: 'product-1', quantity: 1 } as ReceiveStockDto;

    return {
      productRepo,
      execute: () =>
        handler.execute(new ReceiveStockCommand(clinicId, dto, ctx)),
    };
  };

  it('başka kiracının kliniğine mal kabulü reddedilir — ürüne bile bakılmaz', async () => {
    const { execute, productRepo } = run(
      buildActor({ clinicId: CLINIC_A, organizationId: ORG_1 }),
      'other-tenant-clinic'
    );

    await expect(execute()).rejects.toThrow(ForbiddenException);
    expect(productRepo.findById).not.toHaveBeenCalled();
  });

  it('aynı organizasyondaki KARDEŞ kliniğe yazma da reddedilir', async () => {
    // Org üyeliği tek başına yetmez; yoksa çok klinikli organizasyonda klinik
    // yalıtımı tamamen kalkardı.
    const { execute } = run(
      buildActor({ clinicId: CLINIC_B, organizationId: ORG_1 }),
      CLINIC_A
    );

    await expect(execute()).rejects.toThrow(ForbiddenException);
  });

  it('kendi kliniğine mal kabulü kapıdan geçer', async () => {
    const { execute, productRepo } = run(
      buildActor({ clinicId: CLINIC_A, organizationId: ORG_1 }),
      CLINIC_A
    );

    // Kapıyı geçtiğinin kanıtı: akış ürün aramaya kadar ilerledi.
    await expect(execute()).rejects.toThrow(ProductNotFoundException);
    expect(productRepo.findById).toHaveBeenCalledWith('product-1');
  });

  it('organizasyon sahibi, yönetmediği ama sahibi olduğu kliniğe yazabilir', async () => {
    // (b) seçeneğinin tam olarak çözdüğü durum: `create-clinic` yeni kliniği
    // sahibin managedClinics'ine bağlamaz, sahiplik org seviyesinde kalır.
    const { execute } = run(
      buildActor({
        clinicId: undefined,
        managedClinics: [],
        ownedOrganizations: [{ id: ORG_1 }],
        organizationId: ORG_1,
      }),
      CLINIC_A
    );

    await expect(execute()).rejects.toThrow(ProductNotFoundException);
  });

  it('başka organizasyonun sahibi bu kliniğe yazamaz', async () => {
    const { execute } = run(
      buildActor({
        clinicId: undefined,
        ownedOrganizations: [{ id: 'org-2' }],
        organizationId: 'org-2',
      }),
      CLINIC_A
    );

    await expect(execute()).rejects.toThrow(ForbiddenException);
  });
});

/**
 * Ürünün bu klinikte kullanılabilir olması zorunlu. Kapı yokken parti
 * `clinicId`'si mal kabul edilen kliniğe yazılırken ürün kaydı başka kliniğe
 * ait olabiliyordu: iki tarafın da listeleri kendi kliniğiyle süzdüğü için
 * ortaya çıkan stok hiçbir ekranda görünmezdi (ödenen mal bedeli envanterden
 * düşerdi). Silinmiş/pasif ürün de aynı sonuca yol açar.
 */
describe('ReceiveStockHandler — ürün kullanılabilirliği', () => {
  // Parti/hareket entity'leri klinik ve organizasyonu UUID olarak doğruluyor
  // (kayıt kimlikleri UUID'dir; personel kimliği değildir).
  const CLINIC_A = '44444444-4444-4444-8444-444444444444';
  const CLINIC_B = '55555555-5555-4555-8555-555555555555';
  const ORG_1 = '66666666-6666-4666-8666-666666666666';

  const actor: ActorContext = {
    userId: 'nQ7wE1rT5yU8iO2pL4kJ6hA3xY9z', // Firebase UID — UUID DEĞİL
    email: 'staff@clinic.com',
    source: LogSource.WEB,
    capabilities: ['stockmovement:create'],
    rolePriority: 50,
    managedClinics: [],
    ownedOrganizations: [],
    clinicId: CLINIC_A,
    organizationId: ORG_1,
  };

  const run = (product: {
    clinicId: string;
    isActive?: boolean;
    deletedAt?: Date | null;
  }) => {
    const batchCreate = jest.fn((batch: unknown) => Promise.resolve(batch));
    const movementCreate = jest.fn((m: unknown) => Promise.resolve(m));

    const productRepo = {
      findById: jest.fn().mockResolvedValue({
        id: { value: '11111111-1111-4111-8111-111111111111' },
        clinicId: { value: product.clinicId },
        isActive: product.isActive ?? true,
        deletedAt: product.deletedAt ?? null,
      }),
    };

    const handler = new ReceiveStockHandler(
      productRepo as never,
      { create: batchCreate } as never,
      { create: movementCreate } as never,
      { resolve: jest.fn().mockResolvedValue(ORG_1) } as never,
      new PolicyFactory(new EventEmitter2()),
      { run: jest.fn((cb: () => unknown) => cb()) } as never
    );

    const ctx: IGetContext = { actor, source: ExecutionSources.USER_ACTION };
    const dto = {
      productId: '11111111-1111-4111-8111-111111111111',
      quantity: 2,
      purchasePrice: 100,
      currency: 'TRY',
    } as ReceiveStockDto;

    return {
      batchCreate,
      movementCreate,
      execute: () =>
        handler.execute(new ReceiveStockCommand(CLINIC_A, dto, ctx)),
    };
  };

  it('başka kliniğin ürününe stok girilemez — parti hiç yazılmaz', async () => {
    const { execute, batchCreate } = run({ clinicId: CLINIC_B });

    await expect(execute()).rejects.toBeInstanceOf(
      ProductNotUsableInClinicException
    );
    expect(batchCreate).not.toHaveBeenCalled();
  });

  it('silinmiş ürüne stok girilemez (girilen mal hiçbir listede görünmezdi)', async () => {
    const { execute } = run({ clinicId: CLINIC_A, deletedAt: new Date() });

    await expect(execute()).rejects.toBeInstanceOf(
      ProductNotUsableInClinicException
    );
  });

  it('pasif ürüne stok girilemez', async () => {
    const { execute } = run({ clinicId: CLINIC_A, isActive: false });

    await expect(execute()).rejects.toBeInstanceOf(
      ProductNotUsableInClinicException
    );
  });

  it('kliniğin aktif ürününe mal kabul yapılır — personel kimliği Firebase UID', async () => {
    // Regresyon: `StockMovement.performedById` UUID VO'sundan geçiriliyordu;
    // gerçek personel kimliği 28 karakterli Firebase UID olduğu için mal kabul
    // (ve dolayısıyla satın almanın teslim akışı) HİÇ tamamlanamıyordu.
    const { execute, batchCreate, movementCreate } = run({
      clinicId: CLINIC_A,
    });

    await expect(execute()).resolves.toBeDefined();
    expect(batchCreate).toHaveBeenCalledTimes(1);

    const movement = movementCreate.mock.calls[0][0] as {
      performedById: string | null;
    };
    expect(movement.performedById).toBe(actor.userId);
  });
});
