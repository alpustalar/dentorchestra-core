/*
 * Jest mock'ları tiplenmemiş (`any`) nesneler taşır: bus/repo taklitleri gerçek
 * sözleşmeyi değil yalnız testin ihtiyaç duyduğu yüzeyi kurar. Aşağıdaki kurallar
 * YALNIZ bu dosyada kapatılır; üretim kodunda açık kalır.
 */
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import { IssueInvoiceHandler } from './issue-invoice.handler';
import { IssueInvoiceCommand } from './issue-invoice.command';
import { Money } from '@src/domain/value-objects/money.vo';
import { LogAction, LogType } from '@src/domain/constants/log-action.constant';
import { InvoiceStatusSchema } from '@input-type-schemas/InvoiceStatusSchema';
import { GetTaxRateQuery } from '@modules/finance/accounting/tax-parameters/application/queries/get-tax-rate/get-tax-rate.query';
import { EnsurePartyForPatientCommand } from '@modules/finance/party/application/commands/ensure-party-for-patient/ensure-party-for-patient.command';
import { RecordFinancialEventCommand } from '@modules/finance/accounting/financial-events/application/commands/record-financial-event/record-financial-event.command';
import { QueueEDocumentCommand } from '@modules/finance/e-document/application/commands/queue-e-document/queue-e-document.command';
import {
  InvoiceCurrencyMismatchException,
  InvoiceDuplicateException,
} from '@modules/finance/invoice/domain/exceptions/invoice.exceptions';
import { Decimal } from 'decimal.js';
import { AppointmentChargeTotals } from '@modules/finance/treatment-charge/domain/value-objects/appointment-charge-totals.vo';
import { InvalidVatRateException } from '@src/domain/exceptions';

describe('IssueInvoiceHandler', () => {
  const input = {
    clinicId: 'clinic-1',
    patientId: 'patient-1',
    appointmentId: 'appt-1',
    paymentId: null,
    totalAmount: Money.fromTrusted(1000, 'TRY'),
    action: LogAction.INVOICE_ISSUED,
    type: LogType.INFO,
  };

  const make = (
    existingInvoice: unknown = null,
    options: { charges?: unknown; taxRate?: number } = {}
  ) => {
    // Mükerrer fatura kontrolü yazma kararını beslediği için Command Repo'dan okunur.
    const invoiceCommandRepo = {
      create: jest.fn().mockResolvedValue(undefined),
      update: jest.fn(),
      findById: jest.fn(),
      findByIdForUpdate: jest.fn(),
      findByAppointmentId: jest.fn().mockResolvedValue(existingInvoice),
      findByPaymentId: jest.fn().mockResolvedValue(existingInvoice),
      claimForEDocumentDispatch: jest.fn(),
    };
    const txManager = {
      outboxRun: jest.fn((cb: () => Promise<unknown>) => cb()),
    };
    const commandBus = {
      execute: jest.fn((cmd: unknown) => {
        if (cmd instanceof EnsurePartyForPatientCommand) {
          return Promise.resolve({
            partyId: 'party-1',
            organizationId: 'org-1',
          });
        }
        return Promise.resolve(undefined);
      }),
    };
    const queryBus = {
      execute: jest.fn((query: unknown) => {
        if (query instanceof GetTaxRateQuery) {
          return Promise.resolve({ data: { rate: options.taxRate ?? 10 } });
        }
        return Promise.resolve({ data: null });
      }),
    };
    /**
     * Satır toplamı artık **kilitli** domain servisinden okunuyor (fatura
     * transaction'ının içinde): kilitsiz okuma, okuma ile yazma arasında iptal
     * edilen bir satırı faturada bırakabiliyordu.
     */
    const chargeTotals = {
      lockAndGetAppointmentTotals: jest
        .fn()
        .mockResolvedValue(
          options.charges
            ? AppointmentChargeTotals.fromSummary(options.charges as never)
            : null
        ),
    };
    const tenantScopeResolver = {
      resolve: jest.fn().mockResolvedValue('org-1'),
    };
    // e-Belge kuyruğa alınamazsa operatöre uyarı gider.
    const criticalFailure = { publish: jest.fn() };

    const handler = new IssueInvoiceHandler(
      invoiceCommandRepo as never,
      tenantScopeResolver as never,
      chargeTotals as never,
      txManager as never,
      commandBus as never,
      queryBus as never,
      criticalFailure as never
    );

    return {
      criticalFailure,
      handler,
      invoiceCommandRepo,
      txManager,
      commandBus,
      queryBus,
      tenantScopeResolver,
      chargeTotals,
    };
  };

  it('mevcut fatura yoksa yeni fatura oluşturur, ekonomik olayı kaydeder ve e-belgeyi kuyruğa alır', async () => {
    const {
      handler,
      invoiceCommandRepo,
      txManager,
      commandBus,
      tenantScopeResolver,
    } = make(null);

    const result = await handler.execute(new IssueInvoiceCommand(input));

    expect(txManager.outboxRun).toHaveBeenCalledTimes(1);
    expect(invoiceCommandRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        clinicId: 'clinic-1',
        patientId: 'patient-1',
        appointmentId: 'appt-1',
        paymentId: null,
        organizationId: 'org-1',
        vatRate: 10,
        currency: 'TRY',
        status: InvoiceStatusSchema.enum.PENDING,
      })
    );

    // Tutarlar Decimal: brüt toplamın `number`'a çevrilmesi aynı satırda iki ayrı
    // hassasiyet rejimi demekti (§12 P1-5).
    const createProps = invoiceCommandRepo.create.mock.calls[0][0];
    expect(createProps.amount).toBeInstanceOf(Decimal);
    expect(createProps.amount.toFixed(2)).toBe('1000.00');
    expect(createProps.netTotal.toFixed(2)).toBe('909.09');
    expect(createProps.vatTotal.toFixed(2)).toBe('90.91');

    const recordFinancialEventCall = (
      commandBus.execute as jest.Mock
    ).mock.calls.find(([c]) => c instanceof RecordFinancialEventCommand);
    expect(recordFinancialEventCall).toBeDefined();

    const queueEDocumentCall = (
      commandBus.execute as jest.Mock
    ).mock.calls.find(([c]) => c instanceof QueueEDocumentCommand);
    expect(queueEDocumentCall).toBeDefined();

    expect(tenantScopeResolver.resolve).toHaveBeenCalledWith({
      clinicId: 'clinic-1',
    });

    expect(result).toEqual({
      invoiceId: expect.any(String),
      invoiceNumber: null,
      status: InvoiceStatusSchema.enum.PENDING,
    });
  });

  it('fatura tarihi, defterdeki olayın tarihiyle AYNI an olarak damgalanır', async () => {
    // Üç tarih tek kaynaktan gelmek zorunda: fatura kaydının `issuedAt`'i,
    // ekonomik olayın `occurredAt`'i ve (processor'ın okuduğu) e-belge tarihi.
    // `issuedAt` eskiden NULL kaydedilip e-belge sonucu dönünce damgalanıyordu:
    // kuyruk beklediğinde belge tarihi defter tarihinden kopuyor, gönderim
    // FAILED kalırsa `issuedAt` sonsuza dek NULL kalıyordu.
    const { handler, invoiceCommandRepo, commandBus } = make(null);

    await handler.execute(new IssueInvoiceCommand(input));

    const createProps = invoiceCommandRepo.create.mock.calls[0][0];
    expect(createProps.issuedAt).toBeInstanceOf(Date);

    const eventCall = (commandBus.execute as jest.Mock).mock.calls.find(
      ([c]) => c instanceof RecordFinancialEventCommand
    );
    const cmd = eventCall![0] as RecordFinancialEventCommand;
    expect(cmd.data.occurredAt).toEqual(createProps.issuedAt);
  });

  it('randevu için zaten fatura varsa yeni kayıt oluşturmadan mevcut faturayı döner', async () => {
    const existingInvoice = {
      id: { value: 'inv-existing' },
      invoiceNumber: null,
      status: InvoiceStatusSchema.enum.ISSUED,
    };
    const { handler, invoiceCommandRepo, txManager, commandBus } =
      make(existingInvoice);

    const result = await handler.execute(new IssueInvoiceCommand(input));

    expect(invoiceCommandRepo.create).not.toHaveBeenCalled();
    expect(txManager.outboxRun).not.toHaveBeenCalled();
    expect(commandBus.execute).not.toHaveBeenCalled();
    expect(result).toEqual({
      invoiceId: 'inv-existing',
      invoiceNumber: null,
      status: InvoiceStatusSchema.enum.ISSUED,
    });
  });

  it('yarışı kaybeden istek (unique kısıt) hata yükseltmez, kazananın faturasını döner', async () => {
    const winner = {
      id: { value: 'inv-winner' },
      invoiceNumber: 'FTR-1',
      status: InvoiceStatusSchema.enum.ISSUED,
    };
    // Baştaki kontrol "fatura yok" der (yarış henüz kaybedilmedi), yazma anında
    // DB kısıtı patlar, ardından kazananın kaydı okunur.
    const { handler, invoiceCommandRepo, commandBus } = make(null);
    invoiceCommandRepo.create.mockRejectedValue(
      new InvoiceDuplicateException()
    );
    invoiceCommandRepo.findByAppointmentId
      .mockResolvedValueOnce(null)
      .mockResolvedValue(winner);

    const result = await handler.execute(new IssueInvoiceCommand(input));

    expect(result).toEqual({
      invoiceId: 'inv-winner',
      invoiceNumber: 'FTR-1',
      status: InvoiceStatusSchema.enum.ISSUED,
    });
    // Kaybeden taraf e-belge kuyruğuna İKİNCİ kez iş atmaz.
    const queued = (commandBus.execute as jest.Mock).mock.calls.filter(
      ([c]) => c instanceof QueueEDocumentCommand
    );
    expect(queued).toHaveLength(0);
  });

  it('unique kısıt dışındaki hatalar yutulmaz', async () => {
    const { handler, invoiceCommandRepo } = make(null);
    invoiceCommandRepo.create.mockRejectedValue(new Error('db down'));

    await expect(
      handler.execute(new IssueInvoiceCommand(input))
    ).rejects.toThrow('db down');
  });

  // --- Para birimi muhasebe olayına geçer (§12 P0-2) ---

  it("ekonomik olay payload'ında faturanın para birimi bulunur", async () => {
    const { handler, commandBus } = make(null);

    await handler.execute(
      new IssueInvoiceCommand({
        ...input,
        totalAmount: Money.fromTrusted(1000, 'EUR'),
      })
    );

    const call = (commandBus.execute as jest.Mock).mock.calls.find(
      ([c]) => c instanceof RecordFinancialEventCommand
    );
    const cmd = call![0] as RecordFinancialEventCommand;
    // Eksik bırakılırsa posting defterin fonksiyonel parasını (TRY) varsayar ve
    // 1.000 EUR'luk fatura deftere 1.000 TRY olarak düşer.
    expect((cmd.data.payload as { currency?: string }).currency).toBe('EUR');
  });

  // --- KDV oranı yasal kümeye zorlanır (§12 P1-2) ---

  it('yasal olmayan KDV oranı (%8) ile fatura kesilmez', async () => {
    const { handler, invoiceCommandRepo } = make(null, { taxRate: 8 });

    await expect(
      handler.execute(new IssueInvoiceCommand(input))
    ).rejects.toThrow(InvalidVatRateException);

    expect(invoiceCommandRepo.create).not.toHaveBeenCalled();
  });

  // --- Satır/tahsilat para birimi uyuşmazlığı (§12 P1-7) ---

  it('işlem satırlarının para birimi tahsilattan farklıysa fatura kesilmez', async () => {
    const { handler, invoiceCommandRepo } = make(null, {
      charges: {
        appointmentId: 'appt-1',
        clinicId: 'clinic-1',
        patientId: 'patient-1',
        currency: 'EUR',
        listTotal: '1000.00',
        discountTotal: '0.00',
        netTotal: '909.09',
        vatTotal: '90.91',
        grandTotal: '1000.00',
        vatRate: 10,
        lineCount: 1,
      },
    });

    await expect(
      handler.execute(new IssueInvoiceCommand(input))
    ).rejects.toThrow(InvoiceCurrencyMismatchException);

    expect(invoiceCommandRepo.create).not.toHaveBeenCalled();
  });

  it('işlem satırları varsa fatura tutarı satırlardan türer (brüt yeniden bölünmez)', async () => {
    const { handler, invoiceCommandRepo } = make(null, {
      charges: {
        appointmentId: 'appt-1',
        clinicId: 'clinic-1',
        patientId: 'patient-1',
        currency: 'TRY',
        listTotal: '1200.00',
        discountTotal: '0.00',
        netTotal: '1090.91',
        vatTotal: '109.09',
        grandTotal: '1200.00',
        vatRate: 10,
        lineCount: 2,
      },
    });

    await handler.execute(new IssueInvoiceCommand(input));

    const createProps = invoiceCommandRepo.create.mock.calls[0][0];
    expect(createProps.netTotal.toFixed(2)).toBe('1090.91');
    expect(createProps.vatTotal.toFixed(2)).toBe('109.09');
    expect(createProps.amount.toFixed(2)).toBe('1200.00');
  });

  it("satır toplamı fatura transaction'ının İÇİNDE ve kilitli okunur", async () => {
    const { handler, txManager, chargeTotals } = make(null, {
      charges: {
        appointmentId: 'appt-1',
        clinicId: 'clinic-1',
        patientId: 'patient-1',
        currency: 'TRY',
        listTotal: '1000.00',
        discountTotal: '0.00',
        netTotal: '909.09',
        vatTotal: '90.91',
        grandTotal: '1000.00',
        vatRate: 10,
        lineCount: 1,
      },
    });

    // outboxRun çağrılmadan önce satır okuması YAPILMAMIŞ olmalı: kilit ancak
    // transaction içinde tutulur.
    txManager.outboxRun.mockImplementation(
      async (cb: () => Promise<unknown>) => {
        expect(chargeTotals.lockAndGetAppointmentTotals).not.toHaveBeenCalled();
        return cb();
      }
    );

    await handler.execute(new IssueInvoiceCommand(input));

    expect(chargeTotals.lockAndGetAppointmentTotals).toHaveBeenCalledWith(
      'appt-1'
    );
  });
});
