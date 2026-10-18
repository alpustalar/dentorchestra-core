/*
 * Jest mock'ları tiplenmemiş (`any`) nesneler taşır: bus/repo taklitleri gerçek
 * sözleşmeyi değil yalnız testin ihtiyaç duyduğu yüzeyi kurar. Aşağıdaki
 * kurallar YALNIZ bu dosyada kapatılır; üretim kodunda açık kalır.
 */
/* eslint-disable @typescript-eslint/require-await */
import { randomUUID } from 'crypto';
import { Decimal } from 'decimal.js';
import { SyncInstallmentLedgerEntryHandler } from './sync-installment-ledger-entry.handler';
import { SyncInstallmentLedgerEntryCommand } from './sync-installment-ledger-entry.command';
import { GetInstallmentForLedgerQuery } from '@modules/finance/payment/application/queries/get-installment-for-ledger/get-installment-for-ledger.query';
import { FinanceLedgerEntity } from '@modules/finance/finance-ledger/domain/entities/finance-ledger.entity';
import { Money } from '@src/domain/value-objects/money.vo';
import {
  InstallmentStatusSchema,
  LedgerCategorySchema,
  LedgerSourceSchema,
  LedgerStatusSchema,
  LedgerTypeSchema,
} from '@shared';
import {
  LedgerEntryAlreadyExistsException,
  LedgerSourceInstallmentNotFoundException,
} from '@modules/finance/finance-ledger/domain/exceptions/finance-ledger.exceptions';
import type { InstallmentStatusType } from '@input-type-schemas/InstallmentStatusSchema';
import type { LedgerStatusType } from '@input-type-schemas/LedgerStatusSchema';

/**
 * Cari defterin tek yazma yolu. Kritik davranış **sıraya duyarsızlık**: iade
 * olayı tahsilat kaydından önce işlenirse bile defter iade olarak kapanmalı.
 */
describe('SyncInstallmentLedgerEntryHandler', () => {
  const clinicId = randomUUID();
  const patientId = randomUUID();
  const paymentId = randomUUID();
  const installmentId = randomUUID();
  const organizationId = randomUUID();
  const paidAt = new Date('2026-09-30T21:45:00.000Z');
  const ctx = { actor: { userId: 'system' } } as never;

  const installmentRow = (status: InstallmentStatusType) => ({
    installmentId,
    paymentId,
    clinicId,
    patientId,
    amount: new Decimal('1500.50'),
    currency: 'TRY' as const,
    status,
    paidAt,
  });

  const existingEntry = (status: LedgerStatusType) =>
    FinanceLedgerEntity.create({
      organizationId,
      clinicId,
      patientId,
      paymentId,
      installmentId,
      type: LedgerTypeSchema.enum.INCOME,
      source: LedgerSourceSchema.enum.PAYMENT_MODULE,
      category: LedgerCategorySchema.enum.TREATMENT_PAYMENT,
      money: Money.create('1500.50', 'TRY').orThrow(),
      status,
    });

  const make = (opts: {
    installment: ReturnType<typeof installmentRow> | null;
    existing?: FinanceLedgerEntity | null;
    createThrows?: Error;
    racedEntry?: FinanceLedgerEntity | null;
  }) => {
    let findCalls = 0;
    const ledgerRepo = {
      findByInstallmentId: jest.fn(async () => {
        findCalls += 1;
        if (findCalls === 1) return opts.existing ?? null;
        return opts.racedEntry ?? opts.existing ?? null;
      }),
      create: jest.fn(async (entry: FinanceLedgerEntity) => {
        if (opts.createThrows) throw opts.createThrows;
        return entry;
      }),
      update: jest.fn(async (entry: FinanceLedgerEntity) => entry),
    };

    const queryBus = {
      execute: jest.fn(async (q: unknown) => {
        if (q instanceof GetInstallmentForLedgerQuery) {
          return { data: opts.installment };
        }
        return { data: null };
      }),
    };

    const tenantScopeResolver = {
      resolve: jest.fn().mockResolvedValue(organizationId),
    };

    const txManager = {
      run: jest.fn(async (work: () => Promise<unknown>) => work()),
    };

    const handler = new SyncInstallmentLedgerEntryHandler(
      ledgerRepo as never,
      tenantScopeResolver as never,
      queryBus as never,
      txManager as never
    );

    return { handler, ledgerRepo, queryBus, tenantScopeResolver };
  };

  const run = (handler: SyncInstallmentLedgerEntryHandler, actorId = 'uid-1') =>
    handler.execute(
      new SyncInstallmentLedgerEntryCommand({ installmentId, actorId, ctx })
    );

  it('tahsil edilmiş taksit için kaydı yazar; tarih tahsilat tarihidir', async () => {
    const { handler, ledgerRepo } = make({
      installment: installmentRow(InstallmentStatusSchema.enum.COMPLETED),
    });

    const result = await run(handler);

    expect(result).toEqual({ outcome: 'RECORDED' });
    const written = ledgerRepo.create.mock.calls[0][0];
    expect(written.status).toBe(LedgerStatusSchema.enum.COMPLETED);
    expect(written.amount.value.toFixed(2)).toBe('1500.50');
    expect(written.currency.value).toBe('TRY');
    // Kaydın tarihi kaydın yazıldığı an DEĞİL, tahsilatın tarihi.
    expect(written.entryDate).toEqual(paidAt);
    // Tahsilatı yapan personel damgası taşınır.
    expect(written.performedById).toBe('uid-1');
  });

  it('iade önce işlenirse kayıt doğrudan REFUNDED yazılır (sıraya duyarsız)', async () => {
    const { handler, ledgerRepo } = make({
      installment: installmentRow(InstallmentStatusSchema.enum.REFUNDED),
    });

    const result = await run(handler);

    expect(result).toEqual({ outcome: 'RECORDED' });
    const written = ledgerRepo.create.mock.calls[0][0];
    expect(written.status).toBe(LedgerStatusSchema.enum.REFUNDED);
  });

  it('geç gelen tahsilat işi iade edilmiş kaydı gelire çeviremez', async () => {
    const { handler, ledgerRepo } = make({
      // Kaynak zaten iade: tahsilat işi geç çalışsa da kaynaktan okuyor.
      installment: installmentRow(InstallmentStatusSchema.enum.REFUNDED),
      existing: existingEntry(LedgerStatusSchema.enum.REFUNDED),
    });

    const result = await run(handler);

    expect(result).toEqual({ outcome: 'UNCHANGED' });
    expect(ledgerRepo.update).not.toHaveBeenCalled();
    expect(ledgerRepo.create).not.toHaveBeenCalled();
  });

  it('mevcut kaydın durumu kaynaktan kaymışsa hizalar', async () => {
    const { handler, ledgerRepo } = make({
      installment: installmentRow(InstallmentStatusSchema.enum.REFUNDED),
      existing: existingEntry(LedgerStatusSchema.enum.COMPLETED),
    });

    const result = await run(handler);

    expect(result).toEqual({ outcome: 'SYNCED' });
    const updated = ledgerRepo.update.mock.calls[0][0];
    expect(updated.status).toBe(LedgerStatusSchema.enum.REFUNDED);
  });

  it('tahsil edilmemiş taksit için kayıt yazmaz', async () => {
    const { handler, ledgerRepo } = make({
      installment: installmentRow(InstallmentStatusSchema.enum.PENDING),
    });

    const result = await run(handler);

    expect(result).toEqual({ outcome: 'SKIPPED' });
    expect(ledgerRepo.create).not.toHaveBeenCalled();
  });

  it('eşzamanlı yazmada (unique ihlali) mevcut kaydı okuyup hizalar', async () => {
    const { handler, ledgerRepo } = make({
      installment: installmentRow(InstallmentStatusSchema.enum.REFUNDED),
      existing: null,
      createThrows: new LedgerEntryAlreadyExistsException(installmentId),
      racedEntry: existingEntry(LedgerStatusSchema.enum.COMPLETED),
    });

    const result = await run(handler);

    expect(result).toEqual({ outcome: 'SYNCED' });
    const updated = ledgerRepo.update.mock.calls[0][0];
    expect(updated.status).toBe(LedgerStatusSchema.enum.REFUNDED);
  });

  it('kaynak taksit yoksa hata fırlatır (sessizce atlamaz)', async () => {
    const { handler } = make({ installment: null });

    await expect(run(handler)).rejects.toBeInstanceOf(
      LedgerSourceInstallmentNotFoundException
    );
  });

  it('organizasyonu şubeden çözer (istekten/olaydan almaz)', async () => {
    const { handler, tenantScopeResolver, ledgerRepo } = make({
      installment: installmentRow(InstallmentStatusSchema.enum.COMPLETED),
    });

    await run(handler);

    expect(tenantScopeResolver.resolve).toHaveBeenCalledWith({ clinicId });
    const written = ledgerRepo.create.mock.calls[0][0];
    expect(written.organizationId.value).toBe(organizationId);
  });
});
