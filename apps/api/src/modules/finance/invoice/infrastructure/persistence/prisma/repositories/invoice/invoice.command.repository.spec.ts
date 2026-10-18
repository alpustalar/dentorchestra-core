/*
 * Prisma delegesi taklit edildiği için mock nesneleri `any` taşır; bu iki kural
 * yalnız bu dosyada kapatılır (üretim kodunda açık kalır).
 */

import { Decimal } from 'decimal.js';
import { InvoiceCommandRepository } from './invoice.command.repository';
import { PrismaService } from '@src/infrastructure/persistence/prisma/prisma.service';
import { Invoice } from '@modules/finance/invoice/domain/entities/invoice.entity';
import { Invoice as IInvoice } from '@model-schema/InvoiceSchema';
import { CreateInvoiceProps } from '@modules/finance/invoice/domain/contracts/invoice';
import { InvoiceDuplicateException } from '@modules/finance/invoice/domain/exceptions/invoice.exceptions';
import { Prisma } from '@prisma/client';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import { InvoiceStatusSchema } from '@input-type-schemas/InvoiceStatusSchema';
import { ACTIVE_INVOICE_STATUSES } from '@modules/finance/invoice/domain/constants/invoice-status.constant';
import { EDocumentStatusSchema } from '@input-type-schemas/EDocumentStatusSchema';
import { EDocumentTypeSchema } from '@input-type-schemas/EDocumentTypeSchema';
import { txStorage } from '@src/infrastructure/transaction/als-storage';

/**
 * Mapping'i kilitleyen repository testi (CLAUDE.md finans kuralı 9): para/kur
 * taşıyan kolonlar `create`/`update` payload'ından düşerse hata vermez, log
 * üretmez ve geri getirilemez. Burada hangi kolonun yazıldığı açıkça sabitlenir.
 */
describe('InvoiceCommandRepository (mapping + gönderim hakkı)', () => {
  const row = (overrides: Partial<IInvoice> = {}): IInvoice =>
    ({
      id: UUID.generate().value,
      organizationId: UUID.generate().value,
      clinicId: UUID.generate().value,
      patientId: UUID.generate().value,
      appointmentId: null,
      paymentId: null,
      amount: new Decimal('1100.00'),
      currency: 'TRY',
      vatRate: 10,
      netTotal: new Decimal('1000.00'),
      vatTotal: new Decimal('100.00'),
      status: InvoiceStatusSchema.enum.PENDING,
      invoiceNumber: null,
      issuedAt: null,
      documentType: null,
      einvoiceUuid: null,
      einvoiceStatus: EDocumentStatusSchema.enum.DRAFT,
      cancelledAt: null,
      cancelledById: null,
      cancelReason: null,
      providerRef: null,
      rawResponse: null,
      createdAt: new Date('2026-05-01'),
      updatedAt: new Date('2026-05-01'),
      isDeleted: false,
      ...overrides,
    }) as IInvoice;

  const buildDb = (overrides: Record<string, unknown> = {}) => {
    const db = {
      invoice: {
        create: jest.fn(({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({ ...row(), ...data })
        ),
        update: jest.fn(({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({ ...row(), ...data })
        ),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        ...((overrides.invoice as Record<string, unknown>) ?? {}),
      },
      $queryRaw: jest.fn().mockResolvedValue([{ id: 'inv-1' }]),
    };
    return db;
  };

  const buildRepo = (db: ReturnType<typeof buildDb>) =>
    new InvoiceCommandRepository(db as unknown as PrismaService);

  const inTransaction = <T>(db: unknown, work: () => Promise<T>): Promise<T> =>
    txStorage.run({ tx: db, events: [], correlationId: 'c-1' } as never, work);

  const createProps = (): CreateInvoiceProps => ({
    id: UUID.generate().value,
    organizationId: UUID.generate().value,
    clinicId: UUID.generate().value,
    patientId: UUID.generate().value,
    appointmentId: 'appt-1',
    paymentId: 'pay-1',
    amount: new Decimal('1100.00'),
    currency: 'TRY',
    vatRate: 10,
    netTotal: new Decimal('1000.00'),
    vatTotal: new Decimal('100.00'),
    status: InvoiceStatusSchema.enum.PENDING,
  });

  it('create: para kolonlarının tamamı Decimal olarak yazılır', async () => {
    const db = buildDb();
    const repo = buildRepo(db);
    const props = createProps();

    await repo.create(props);

    const written = db.invoice.create.mock.calls[0][0].data as Record<
      string,
      Decimal
    >;
    // Tutar/kur taşıyan kolonların hepsi payload'da olmak ZORUNDA (kural 9).
    expect(written.amount).toBeInstanceOf(Decimal);
    expect(written.amount.toFixed(2)).toBe('1100.00');
    expect(written.netTotal.toFixed(2)).toBe('1000.00');
    expect(written.vatTotal.toFixed(2)).toBe('100.00');
    expect(written.vatRate as unknown).toBe(10);
    expect(written.currency as unknown).toBe('TRY');
  });

  it('create: doğal anahtar çakışması tipli domain hatasına çevrilir', async () => {
    const db = buildDb({
      invoice: {
        create: jest.fn().mockRejectedValue(
          new Prisma.PrismaClientKnownRequestError('dup', {
            code: 'P2002',
            clientVersion: 'test',
          })
        ),
      },
    });
    const repo = buildRepo(db);

    await expect(repo.create(createProps())).rejects.toThrow(
      InvoiceDuplicateException
    );
  });

  it('update: para kolonlarına DOKUNULMAZ (kesilmiş belge tutarı donar)', async () => {
    const db = buildDb();
    const repo = buildRepo(db);
    const invoice = new Invoice(row());

    invoice.applyEDocumentResult({
      documentType: EDocumentTypeSchema.enum.E_ARSIV,
      uuid: UUID.generate().value,
      status: EDocumentStatusSchema.enum.ACCEPTED,
      invoiceNumber: 'ABC2026000000001',
    });

    await repo.update(invoice);

    const written = db.invoice.update.mock.calls[0][0].data;
    // Belge sonucu yazılır…
    expect(written.status).toBe(InvoiceStatusSchema.enum.ISSUED);
    expect(written.invoiceNumber).toBe('ABC2026000000001');
    expect(written.einvoiceStatus).toBe(EDocumentStatusSchema.enum.ACCEPTED);
    // …tutarlar yazılmaz: faturanın parası kesildikten sonra değişmez ve bu
    // yolun onu güncellemesi sessiz bir tutar değişikliği olurdu.
    expect(written).not.toHaveProperty('amount');
    expect(written).not.toHaveProperty('netTotal');
    expect(written).not.toHaveProperty('vatTotal');
    expect(written).not.toHaveProperty('vatRate');
    expect(written).not.toHaveProperty('currency');
  });

  it('claimForEDocumentDispatch: yalnız DRAFT + ETKİN faturayı hedefler', async () => {
    const db = buildDb();
    const repo = buildRepo(db);

    const claimed = await repo.claimForEDocumentDispatch('inv-1');

    expect(claimed).toBe(true);
    // Durum süzgeci kritik: iptal edilmiş bir fatura için entegratöre yasal
    // belge göndermek geri alınamaz. Koşul hakkı veren UPDATE'in kendisinde.
    expect(db.invoice.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'inv-1',
        isDeleted: false,
        status: { in: [...ACTIVE_INVOICE_STATUSES] },
        einvoiceStatus: EDocumentStatusSchema.enum.DRAFT,
      },
      data: { einvoiceStatus: EDocumentStatusSchema.enum.QUEUED },
    });
  });

  it('claimForEDocumentDispatch: hak alınamazsa false döner (gönderim atlanır)', async () => {
    const db = buildDb();
    db.invoice.updateMany.mockResolvedValue({ count: 0 });
    const repo = buildRepo(db);

    await expect(repo.claimForEDocumentDispatch('inv-1')).resolves.toBe(false);
  });

  it("update: iptal damgası payload'a yazılır (mapping kaybı sessiz veri kaybı)", async () => {
    const db = buildDb();
    const repo = buildRepo(db);
    const invoice = new Invoice(
      row({ status: InvoiceStatusSchema.enum.ISSUED })
    );

    invoice.cancel({
      reason: 'Tutar hatalı girildi',
      cancelledById: 'firebase-uid-1',
    });

    await repo.update(invoice);

    const written = db.invoice.update.mock.calls[0][0].data;
    expect(written.status).toBe(InvoiceStatusSchema.enum.CANCELLED);
    expect(written.cancelledAt).toBeInstanceOf(Date);
    expect(written.cancelledById).toBe('firebase-uid-1');
    expect(written.cancelReason).toBe('Tutar hatalı girildi');
  });

  it('findByAppointmentId / findByPaymentId: yalnız ETKİN faturayı arar', async () => {
    const db = buildDb();
    const repo = buildRepo(db);

    await repo.findByAppointmentId('appt-1');
    await repo.findByPaymentId('pay-1');

    // İptal edilmiş fatura "bu kayıt faturalanmış" cevabını vermemeli: yoksa
    // hatalı kesilip iptal edilmiş belge, doğrusunun kesilmesini kalıcı engeller.
    expect(db.invoice.findFirst).toHaveBeenNthCalledWith(1, {
      where: {
        appointmentId: 'appt-1',
        isDeleted: false,
        status: { in: [...ACTIVE_INVOICE_STATUSES] },
      },
    });
    expect(db.invoice.findFirst).toHaveBeenNthCalledWith(2, {
      where: {
        paymentId: 'pay-1',
        isDeleted: false,
        status: { in: [...ACTIVE_INVOICE_STATUSES] },
      },
    });
  });

  it('findByIdForUpdate: satırı kilitler ve ardından okur', async () => {
    const db = buildDb();
    db.invoice.findUnique.mockResolvedValue(row());
    const repo = buildRepo(db);

    const invoice = await inTransaction(db, () =>
      repo.findByIdForUpdate('inv-1')
    );

    expect(db.$queryRaw).toHaveBeenCalled();
    expect(invoice).toBeInstanceOf(Invoice);
  });
});
