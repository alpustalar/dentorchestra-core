import { Decimal } from 'decimal.js';
import { VoidTreatmentChargeHandler } from './void-treatment-charge.handler';
import { VoidTreatmentChargeCommand } from './void-treatment-charge.command';
import { TreatmentCharge } from '@modules/finance/treatment-charge/domain/entities/treatment-charge.entity';
import { ITreatmentChargeCommandRepository } from '@modules/finance/treatment-charge/domain/repositories/treatment-charge/treatment-charge.command.repository';
import { TreatmentChargeNotFoundException } from '@modules/finance/treatment-charge/domain/exceptions/treatment-charge.exceptions';
import { AppointmentAlreadyInvoicedException } from '@modules/finance/invoice/domain/exceptions/invoice.exceptions';
import { IInvoiceIssuanceService } from '@modules/finance/invoice/domain/services/invoice-issuance/invoice-issuance.service.interface';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction/transaction.manager';
import { Money } from '@src/domain/value-objects/money.vo';
import { VatRate } from '@src/domain/value-objects/vat-rate.vo';
import { IGetContext } from '@common/decorators';
import { ExecutionSources } from '../../../../../../../../../packages/shared/common/constants/execution-source.constant';

describe('VoidTreatmentChargeHandler — satır iptali (kilit + fatura kapısı)', () => {
  const CLINIC_ID = '11111111-1111-4111-8111-111111111111';
  const ORG_ID = '22222222-2222-4222-8222-222222222222';
  const APPOINTMENT_ID = '33333333-3333-4333-8333-333333333333';
  const PATIENT_ID = '44444444-4444-4444-8444-444444444444';
  const TREATMENT_ID = '55555555-5555-4555-8555-555555555555';

  const ctx: IGetContext = {
    actor: {
      userId: 'user-1',
      clinicId: CLINIC_ID,
      organizationId: ORG_ID,
      managedClinics: [{ id: CLINIC_ID }],
    } as IGetContext['actor'],
    source: ExecutionSources.USER_ACTION,
  };

  const makeCharge = (): TreatmentCharge =>
    TreatmentCharge.create({
      organizationId: ORG_ID,
      clinicId: CLINIC_ID,
      appointmentId: APPOINTMENT_ID,
      patientId: PATIENT_ID,
      treatmentId: TREATMENT_ID,
      quantity: new Decimal(1),
      listPrice: Money.create(1000, 'TRY').orThrow(),
      discountRate: new Decimal(0),
      maxDiscountPercent: new Decimal(20),
      canExceedDiscountLimit: false,
      vatRate: VatRate.create(20).orThrow(),
    });

  const build = (charge: TreatmentCharge | null, invoiced = false) => {
    let txDepth = 0;
    const depthAtCall: Record<string, number> = {};

    const findByIdForUpdate = jest.fn(() => {
      depthAtCall.load = txDepth;
      return Promise.resolve(charge);
    });
    const update = jest.fn((e: TreatmentCharge) => Promise.resolve(e));

    // Kilitsiz `findById` bilerek tanımsız: handler kullanırsa test patlar.
    const chargeRepo = {
      findByIdForUpdate,
      update,
    } as unknown as ITreatmentChargeCommandRepository;

    const assertAppointmentNotInvoiced = jest.fn((appointmentId: string) => {
      depthAtCall.invoiceGuard = txDepth;
      return invoiced
        ? Promise.reject(new AppointmentAlreadyInvoicedException(appointmentId))
        : Promise.resolve();
    });
    const invoiceIssuance = {
      assertAppointmentNotInvoiced,
    } as unknown as IInvoiceIssuanceService;

    const policyFactory = {
      finance: jest.fn().mockReturnValue({
        evaluator: {
          check: jest.fn().mockReturnValue({ orThrow: () => undefined }),
        },
      }),
    } as never;

    const txManager = {
      run: jest.fn(async (cb: () => Promise<unknown>) => {
        txDepth++;
        try {
          return await cb();
        } finally {
          txDepth--;
        }
      }),
    } as unknown as TransactionManager;

    return {
      handler: new VoidTreatmentChargeHandler(
        chargeRepo,
        policyFactory,
        invoiceIssuance,
        txManager
      ),
      chargeRepo,
      findByIdForUpdate,
      update,
      assertAppointmentNotInvoiced,
      depthAtCall,
    };
  };

  const command = (chargeId: string) =>
    new VoidTreatmentChargeCommand({
      chargeId,
      data: { reason: 'yanlış işlem' },
      ctx,
    });

  it('satırı iptal eder ve kaydeder', async () => {
    const charge = makeCharge();
    const { handler, update } = build(charge);

    await handler.execute(command(charge.id.value));

    expect(charge.voidedAt).not.toBeNull();
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('okuma kilitli ve fatura kontrolü aynı transaction içinde yapılır', async () => {
    const charge = makeCharge();
    const {
      handler,
      chargeRepo,
      findByIdForUpdate,
      assertAppointmentNotInvoiced,
      depthAtCall,
    } = build(charge);

    await handler.execute(command(charge.id.value));

    expect(findByIdForUpdate).toHaveBeenCalledWith(charge.id.value);
    // Kilitsiz okuma yolu hiç kullanılmaz.
    expect((chargeRepo as { findById?: unknown }).findById).toBeUndefined();
    // Fatura kapısı QueryBus'tan değil domain servisinden, kilit kapsamında.
    expect(assertAppointmentNotInvoiced).toHaveBeenCalledWith(APPOINTMENT_ID);
    expect(depthAtCall.load).toBe(1);
    expect(depthAtCall.invoiceGuard).toBe(1);
  });

  it('randevu faturalanmışsa satır iptal edilmez', async () => {
    const charge = makeCharge();
    const { handler, update } = build(charge, true);

    await expect(handler.execute(command(charge.id.value))).rejects.toThrow(
      AppointmentAlreadyInvoicedException
    );

    expect(charge.voidedAt).toBeNull();
    expect(update).not.toHaveBeenCalled();
  });

  it('satır yoksa TreatmentChargeNotFoundException', async () => {
    const { handler } = build(null);

    await expect(
      handler.execute(command('66666666-6666-4666-8666-666666666666'))
    ).rejects.toBeInstanceOf(TreatmentChargeNotFoundException);
  });
});
