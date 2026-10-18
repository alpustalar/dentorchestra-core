import { BookFlightHandler } from './book-flight.handler';
import { BookFlightCommand } from './book-flight.command';
import { DuffelFlightBooking } from '@modules/crm/health-tourism/flight/domain/entities/duffel-flight-booking.entity';
import {
  FlightOrderResult,
  IDuffelApiService,
} from '@modules/crm/health-tourism/flight/domain/interfaces/duffel-api.interface';
import { IDuffelFlightBookingCommandRepository } from '@modules/crm/health-tourism/flight/domain/repositories/duffel-flight-booking/duffel-flight-booking.command.repository';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction/transaction.manager';
import { TSQueryBus } from '@common/cqrs/type-safe-query-bus';
import { ITenantScopeResolver } from '@shared';
import { IPolicyFactory } from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import { CriticalFailurePublisher } from '@common/observability/critical-failure.publisher';
import { CriticalFailurePayload } from '@common/observability/critical-failure.event';
import { IGetContext } from '@common/decorators';
import { ExecutionSources } from '@src/domain/constants/execution-source.constant';
import { LogSource } from '@src/domain/constants/log-action.constant';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import { BookFlight } from '@shared/modules/health-tourism/types/commands';

const CLINIC_ID = '11111111-1111-4111-8111-111111111111';
const ORG_ID = '22222222-2222-4222-8222-222222222222';

const ctx: IGetContext = {
  actor: {
    userId: UUID.generate().value,
    clinicId: CLINIC_ID,
    organizationId: ORG_ID,
    managedClinics: [{ id: CLINIC_ID }],
    source: LogSource.SYSTEM,
  } as unknown as IGetContext['actor'],
  source: ExecutionSources.INTERNAL_CASCADE,
};

/**
 * Teklif (önbellek) ile SİPARİŞ (sağlayıcı) tutarları bilerek FARKLI: havayolu
 * fiyatı arama ile sipariş arasında değişebilir ve `createInstantOrder` ödemeyi
 * teklifi yeniden çekerek gönderir — yani ödenen tutar sipariş tutarıdır.
 */
const OFFER_AMOUNT = 349.9;
const ORDER_AMOUNT = '361.40';

describe('BookFlightHandler — kayda SİPARİŞİN tutarı yazılır', () => {
  const build = (opts: { createFails?: boolean } = {}) => {
    const saved: DuffelFlightBooking[] = [];

    const duffelApi = {
      createInstantOrder: jest.fn(
        async (): Promise<FlightOrderResult> => ({
          orderId: 'ord_1',
          bookingReference: 'PNR123',
          totalAmount: ORDER_AMOUNT,
          currency: 'EUR',
          paymentRequiredBy: null,
        })
      ),
    } as unknown as IDuffelApiService;

    const flightBookingRepo = {
      create: jest.fn(async (b: DuffelFlightBooking) => {
        if (opts.createFails) throw new Error('db down');
        saved.push(b);
        return b;
      }),
    } as unknown as IDuffelFlightBookingCommandRepository;

    const queryBus = {
      execute: jest.fn(async () => ({
        data: {
          offerId: 'off_1',
          totalAmount: OFFER_AMOUNT,
          currency: 'EUR',
          requiresInstantPayment: true,
          paymentRequiredBy: null,
          expiresAt: '2026-07-01T00:00:00.000Z',
          ownerName: 'TK',
          summary: 'IST → AMS',
          originIata: 'IST',
          destinationIata: 'AMS',
          departingAt: '2026-07-01T08:00:00.000Z',
          slices: [],
        },
      })),
    } as unknown as TSQueryBus;

    const tenantScopeResolver = {
      resolve: jest.fn(async () => ORG_ID),
    } as unknown as ITenantScopeResolver;

    const policyFactory = {
      clinic: jest.fn().mockReturnValue({
        evaluator: {
          check: jest.fn().mockReturnValue({ orThrow: () => undefined }),
        },
      }),
    } as unknown as IPolicyFactory;

    const txManager = {
      run: jest.fn(async (cb: () => Promise<unknown>) => cb()),
    } as unknown as TransactionManager;

    const publish = jest.fn<void, [CriticalFailurePayload]>();
    const criticalFailure = { publish } as unknown as CriticalFailurePublisher;

    return {
      handler: new BookFlightHandler(
        duffelApi,
        flightBookingRepo,
        tenantScopeResolver,
        policyFactory,
        queryBus,
        txManager,
        criticalFailure
      ),
      saved,
      publish,
      duffelApi,
    };
  };

  const command = new BookFlightCommand(
    {
      optionId: 'opt_1',
      passengers: [],
      contactEmail: 'a@b.c',
      contactPhone: '+90555',
      clinicId: CLINIC_ID,
    } as unknown as BookFlight,
    ctx
  );

  it('kayda ve dönüşe SİPARİŞİN tutarı yazılır, önbellekteki teklifin tutarı değil', async () => {
    // Regresyon: sipariş yanıtının `totalAmount`'ı atılıyor, kayda teklif tutarı
    // yazılıyordu. Bu kolon aynı zamanda hold yolunda ödeme talimatıdır ve
    // defterdeki tedarikçi borcunu besler → bayat tutar yanlış borç demektir.
    const { handler, saved } = build();

    const result = await handler.execute(command);

    expect(saved[0].totalAmount.toApiFormat()).toBe(ORDER_AMOUNT);
    expect(saved[0].totalAmount.value.toNumber()).not.toBe(OFFER_AMOUNT);
    expect(result).toEqual({
      bookingId: saved[0].id.value,
      supplierAmount: ORDER_AMOUNT,
      supplierCurrency: 'EUR',
    });
  });

  it('sipariş açıldıktan sonra yerel kayıt yazılamazsa CRITICAL yayınlanır ve hata yükselir', async () => {
    // Bilet kesilmiş ve ödenmiştir; yerel hata yalnız kaydı düşürür. Saga bunu
    // "book başarısız" sayıp tahsilatı iade eder → bilet havayolunda kalır.
    // Alarm olmadan bu yalnız bir logger.error olarak kaybolurdu.
    const { handler, publish } = build({ createFails: true });

    await expect(handler.execute(command)).rejects.toThrow('db down');

    expect(publish).toHaveBeenCalledTimes(1);
    const alert = publish.mock.calls[0][0];
    expect(alert.severity).toBe('CRITICAL');
    expect(alert.operation).toBe('health-tourism.flight.booking-record');
    expect(alert.context).toMatchObject({ duffelOrderId: 'ord_1' });
  });
});
