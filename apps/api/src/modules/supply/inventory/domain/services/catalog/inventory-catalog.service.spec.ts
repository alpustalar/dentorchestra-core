import { randomUUID } from 'crypto';
import { InventoryCatalogService } from './inventory-catalog.service';
import {
  CategoryNotUsableInClinicException,
  ProductCategoryNotFoundException,
  ProductNotFoundException,
  ProductNotUsableInClinicException,
  SupplierNotFoundException,
  SupplierNotUsableInClinicException,
} from '@modules/supply/inventory/domain/exceptions/inventory.exceptions';

/**
 * Katalog kapısı: satın alma siparişinin tedarikçi/ürün alanları bounded-context
 * gereği FK'siz skaler. Doğrulanmadığı sürece sipariş var olmayan, başka
 * kiracıya ait ya da silinmiş bir kayda açılabiliyordu.
 */
describe('InventoryCatalogService', () => {
  const CLINIC_A = randomUUID();
  const CLINIC_B = randomUUID();
  const PRODUCT_ID = randomUUID();
  const SUPPLIER_ID = randomUUID();
  const CATEGORY_ID = randomUUID();

  const build = (options: {
    product?: { clinicId: string; isActive?: boolean; deletedAt?: Date | null };
    supplier?: { clinicId: string; isActive?: boolean };
    category?: { clinicId: string };
  }) => {
    const productFindById = jest.fn().mockResolvedValue(
      options.product
        ? {
            id: { value: PRODUCT_ID },
            clinicId: { value: options.product.clinicId },
            isActive: options.product.isActive ?? true,
            deletedAt: options.product.deletedAt ?? null,
          }
        : null
    );

    const supplierFindById = jest.fn().mockResolvedValue(
      options.supplier
        ? {
            id: { value: SUPPLIER_ID },
            clinicId: { value: options.supplier.clinicId },
            isActive: options.supplier.isActive ?? true,
          }
        : null
    );

    const categoryFindById = jest.fn().mockResolvedValue(
      options.category
        ? {
            id: { value: CATEGORY_ID },
            clinicId: { value: options.category.clinicId },
          }
        : null
    );

    return {
      service: new InventoryCatalogService(
        { findById: productFindById } as never,
        { findById: supplierFindById } as never,
        { findById: categoryFindById } as never
      ),
      productFindById,
      supplierFindById,
      categoryFindById,
    };
  };

  describe('assertProductsUsable', () => {
    it('kliniğin aktif ürünü geçer', async () => {
      const { service } = build({ product: { clinicId: CLINIC_A } });

      await expect(
        service.assertProductsUsable({
          clinicId: CLINIC_A,
          productIds: [PRODUCT_ID],
        })
      ).resolves.toBeUndefined();
    });

    it('başka kliniğin ürünü reddedilir', async () => {
      const { service } = build({ product: { clinicId: CLINIC_B } });

      await expect(
        service.assertProductsUsable({
          clinicId: CLINIC_A,
          productIds: [PRODUCT_ID],
        })
      ).rejects.toBeInstanceOf(ProductNotUsableInClinicException);
    });

    it('silinmiş ürün reddedilir (sebep: DELETED)', async () => {
      const { service } = build({
        product: { clinicId: CLINIC_A, deletedAt: new Date() },
      });

      await expect(
        service.assertProductsUsable({
          clinicId: CLINIC_A,
          productIds: [PRODUCT_ID],
        })
      ).rejects.toMatchObject({ meta: { reason: 'DELETED' } });
    });

    it('pasif ürün reddedilir (sebep: INACTIVE)', async () => {
      const { service } = build({
        product: { clinicId: CLINIC_A, isActive: false },
      });

      await expect(
        service.assertProductsUsable({
          clinicId: CLINIC_A,
          productIds: [PRODUCT_ID],
        })
      ).rejects.toMatchObject({ meta: { reason: 'INACTIVE' } });
    });

    it('olmayan ürün reddedilir', async () => {
      const { service } = build({});

      await expect(
        service.assertProductsUsable({
          clinicId: CLINIC_A,
          productIds: [PRODUCT_ID],
        })
      ).rejects.toBeInstanceOf(ProductNotFoundException);
    });

    it('aynı ürün birden çok satırda geçse bir kez okunur', async () => {
      const { service, productFindById } = build({
        product: { clinicId: CLINIC_A },
      });

      await service.assertProductsUsable({
        clinicId: CLINIC_A,
        productIds: [PRODUCT_ID, PRODUCT_ID, PRODUCT_ID],
      });

      expect(productFindById).toHaveBeenCalledTimes(1);
    });
  });

  describe('assertSupplierUsable', () => {
    it('kliniğin aktif tedarikçisi geçer', async () => {
      const { service } = build({ supplier: { clinicId: CLINIC_A } });

      await expect(
        service.assertSupplierUsable({
          clinicId: CLINIC_A,
          supplierId: SUPPLIER_ID,
        })
      ).resolves.toBeUndefined();
    });

    it('başka kliniğin tedarikçisine sipariş açılamaz', async () => {
      const { service } = build({ supplier: { clinicId: CLINIC_B } });

      await expect(
        service.assertSupplierUsable({
          clinicId: CLINIC_A,
          supplierId: SUPPLIER_ID,
        })
      ).rejects.toBeInstanceOf(SupplierNotUsableInClinicException);
    });

    it('pasif tedarikçiye sipariş açılamaz', async () => {
      const { service } = build({
        supplier: { clinicId: CLINIC_A, isActive: false },
      });

      await expect(
        service.assertSupplierUsable({
          clinicId: CLINIC_A,
          supplierId: SUPPLIER_ID,
        })
      ).rejects.toMatchObject({ meta: { reason: 'INACTIVE' } });
    });

    it('olmayan tedarikçi reddedilir', async () => {
      const { service } = build({});

      await expect(
        service.assertSupplierUsable({
          clinicId: CLINIC_A,
          supplierId: SUPPLIER_ID,
        })
      ).rejects.toBeInstanceOf(SupplierNotFoundException);
    });
  });

  describe('assertCategoryUsable', () => {
    it('kliniğin kategorisi geçer', async () => {
      const { service } = build({ category: { clinicId: CLINIC_A } });

      await expect(
        service.assertCategoryUsable({
          clinicId: CLINIC_A,
          categoryId: CATEGORY_ID,
        })
      ).resolves.toBeUndefined();
    });

    it('başka kliniğin kategorisi ürün kartına bağlanamaz', async () => {
      const { service } = build({ category: { clinicId: CLINIC_B } });

      await expect(
        service.assertCategoryUsable({
          clinicId: CLINIC_A,
          categoryId: CATEGORY_ID,
        })
      ).rejects.toBeInstanceOf(CategoryNotUsableInClinicException);
    });

    it('olmayan kategori reddedilir', async () => {
      const { service } = build({});

      await expect(
        service.assertCategoryUsable({
          clinicId: CLINIC_A,
          categoryId: CATEGORY_ID,
        })
      ).rejects.toBeInstanceOf(ProductCategoryNotFoundException);
    });
  });
});
