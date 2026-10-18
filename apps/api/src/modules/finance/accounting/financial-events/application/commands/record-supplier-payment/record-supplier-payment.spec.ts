/*
 * Jest taklitleri senkron gövde taşır ve mock metodları `this` bağlamından ayrı
 * okunur (`jest.mocked(x.y).mock.calls`). İki kural YALNIZ bu dosyada kapatılır;
 * üretim kodunda açık kalır.
 */
/* eslint-disable @typescript-eslint/require-await, @typescript-eslint/unbound-method */
import { RecordSupplierPaymentHandler } from './record-supplier-payment.handler';
import { RecordSupplierPaymentCommand } from './record-supplier-payment.command';
import { RecordFinancialEventCommand } from '../record-financial-event/record-financial-event.command';
import {
  SupplierPartyClinicMismatchException,
  SupplierPartyNotSupplierException,
} from '@modules/finance/accounting/financial-events/domain/exceptions';
import { IPolicyFactory } from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import { TSCommandBus } from '@common/cqrs/type-safe-command-bus';
import { TSQueryBus } from '@common/cqrs/type-safe-query-bus';
import { IGetContext } from '@common/decorators';
import { ExecutionSources } from '@src/domain/constants/execution-source.constant';
import { LogSource } from '@src/domain/constants/log-action.constant';
import { PartyRoleSchema } from '@shared';
import type { RecordSupplierPayment } from '@shared/modules/financial-event/types/commands';
import { IPeriodGateService } from '@modules/finance/accounting/periods/domain/services/period-gate/period-gate.service.interface';
import { PeriodSealedForDateException } from '@modules/finance/accounting/periods/domain/exceptions/period.exceptions';

const CLINIC_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_CLINIC_ID = '33333333-3333-4333-8333-333333333333';
const PARTY_ID = '44444444-4444-4444-8444-444444444444';
const ACTOR_ID = '55555555-5555-4555-8555-555555555555';

const ctx: IGetContext = {
  actor: {
    userId: ACTOR_ID,
    clinicId: CLINIC_ID,
    managedClinics: [{ id: CLINIC_ID }, { id: OTHER_CLINIC_ID }],
    source: LogSource.SYSTEM,
  } as unknown as IGetContext['actor'],
  source: ExecutionSources.USER_ACTION,
};

interface BuildOptions {
  party?: { clinicId: string; roles: string[] } | null;
  policyDenies?: boolean;
  /** Ödeme tarihi mühürlenmiş döneme düşüyor. */
  periodSealed?: boolean;
}

const build = (options: BuildOptions = {}) => {
  const dispatched: RecordFinancialEventCommand[] = [];

  const commandBus = {
    execute: jest.fn(async (command: RecordFinancialEventCommand) => {
      dispatched.push(command);
      return 'event-1';
    }),
  } as unknown as TSCommandBus;

  const queryBus = {
    execute: jest.fn(async () => ({
      data:
        options.party === undefined
          ? { clinicId: CLINIC_ID, roles: [PartyRoleSchema.enum.SUPPLIER] }
          : options.party,
    })),
  } as unknown as TSQueryBus;

  const policyFactory = {
    finance: jest.fn().mockReturnValue({
      evaluator: {
        check: jest.fn().mockReturnValue({
          orThrow: () => {
            if (options.policyDenies) throw new Error('forbidden');
          },
        }),
      },
    }),
  } as unknown as IPolicyFactory;

  const periodGate = {
    assertPeriodNotSealedAt: jest.fn(async () => {
      if (options.periodSealed) {
        throw new PeriodSealedForDateException({
          clinicId: CLINIC_ID,
          date: new Date('2025-06-15'),
          year: 2025,
          currentStatus: 'CLOSED',
        });
      }
    }),
  } as unknown as IPeriodGateService;

  return {
    handler: new RecordSupplierPaymentHandler(
      policyFactory,
      periodGate,
      commandBus,
      queryBus
    ),
    commandBus,
    periodGate,
    dispatched,
  };
};

const commandOf = (data: Partial<RecordSupplierPayment> = {}) =>
  new RecordSupplierPaymentCommand({
    data: {
      clinicId: CLINIC_ID,
      partyId: PARTY_ID,
      amount: '250.00',
      method: 'BANK_TRANSFER',
      reference: 'DEKONT-1',
      ...data,
    } as RecordSupplierPayment,
    ctx,
  });

describe('RecordSupplierPaymentHandler — cari doğrulaması', () => {
  it('cari başka kliniğe aitse ödeme kaydedilmez', async () => {
    // Aktör iki kliniği de yönetiyor: yetki kontrolü tek başına bu hatayı
    // yakalayamaz, cari-klinik eşleşmesi ayrıca doğrulanmalıdır.
    const { handler, commandBus } = build({
      party: {
        clinicId: OTHER_CLINIC_ID,
        roles: [PartyRoleSchema.enum.SUPPLIER],
      },
    });

    await expect(handler.execute(commandOf())).rejects.toBeInstanceOf(
      SupplierPartyClinicMismatchException
    );
    expect(commandBus.execute).not.toHaveBeenCalled();
  });

  it('cari bulunamazsa ödeme kaydedilmez', async () => {
    const { handler } = build({ party: null });

    await expect(handler.execute(commandOf())).rejects.toBeInstanceOf(
      SupplierPartyClinicMismatchException
    );
  });

  it('cari SUPPLIER rolünde değilse ödeme kaydedilmez', async () => {
    // Müşteri (120) carisine satıcı ödemesi yazmak alacak bakiyesini eritirdi.
    const { handler } = build({
      party: { clinicId: CLINIC_ID, roles: [PartyRoleSchema.enum.PATIENT] },
    });

    await expect(handler.execute(commandOf())).rejects.toBeInstanceOf(
      SupplierPartyNotSupplierException
    );
  });
});

describe('RecordSupplierPaymentHandler — idempotentlik', () => {
  it('dekont numarası verilirse idempotency anahtarı klinikle daraltılır', async () => {
    const { handler, dispatched } = build();

    await handler.execute(commandOf());

    expect(dispatched[0].data.dedupeKey).toBe(
      `supplier-payment:${CLINIC_ID}:DEKONT-1`
    );
  });

  it('dekont yoksa dedupe edilmez — aynı gün iki ayrı ödeme meşrudur', async () => {
    const { handler, dispatched } = build();

    await handler.execute(commandOf({ reference: undefined }));

    expect(dispatched[0].data.dedupeKey).toBeUndefined();
  });
});

describe('RecordSupplierPaymentHandler — kapsam', () => {
  it('yetki yoksa cari bile sorgulanmaz', async () => {
    const { handler, commandBus } = build({ policyDenies: true });

    await expect(handler.execute(commandOf())).rejects.toThrow('forbidden');
    expect(commandBus.execute).not.toHaveBeenCalled();
  });
});

describe('RecordSupplierPaymentHandler — dönem kapısı', () => {
  it('ödeme tarihi mühürlenmiş döneme düşüyorsa olay hiç yazılmaz', async () => {
    // Kabul edilse olay defterine (append-only) yazılır ama fişi hiç
    // üretilemezdi: 320 borcu defterde kapanmamış kalır ve tarih sonradan
    // düzeltilemediği için backfill her turda aynı hatayla patlar.
    const { handler, commandBus } = build({ periodSealed: true });

    await expect(
      handler.execute(commandOf({ paidAt: new Date('2025-06-15') }))
    ).rejects.toBeInstanceOf(PeriodSealedForDateException);
    expect(commandBus.execute).not.toHaveBeenCalled();
  });

  it('tarih verilmezse kapı bugünün dönemine bakar ve olaya aynı an damgalanır', async () => {
    const { handler, periodGate, dispatched } = build();

    await handler.execute(commandOf({ paidAt: undefined }));

    const asserted = jest.mocked(periodGate.assertPeriodNotSealedAt).mock
      .calls[0][0];
    expect(asserted.clinicId).toBe(CLINIC_ID);
    // Kapının baktığı tarih ile olaya yazılan tarih aynı olmalı: iki ayrı
    // `now` çağrısı gece yarısında farklı döneme düşebilir.
    expect(dispatched[0].data.occurredAt).toEqual(asserted.date);
  });
});
