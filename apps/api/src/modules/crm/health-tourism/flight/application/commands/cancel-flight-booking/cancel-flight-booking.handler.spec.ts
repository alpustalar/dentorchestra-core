import { CancelFlightBookingHandler } from './cancel-flight-booking.handler';
import { CancelFlightBookingCommand } from './cancel-flight-booking.command';
import { DuffelFlightBooking } from '@modules/crm/health-tourism/flight/domain/entities/duffel-flight-booking.entity';
import {
  FlightCancellationResult,
  IDuffelApiService,
} from '@modules/crm/health-tourism/flight/domain/interfaces/duffel-api.interface';
import { IDuffelFlightBookingCommandRepository } from '@modules/crm/health-tourism/flight/domain/repositories/duffel-flight-booking/duffel-flight-booking.command.repository';
import {
  FlightBookingNotFoundException,
  FlightPaymentInProgressException,
} from '@modules/crm/health-tourism/flight/domain/exceptions/duffel-flight.exceptions';
import { IPolicyFactory } from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction/transaction.manager';
import { IGetContext } from '@common/decorators';
import { ExecutionSources } from '../../../../../../../../../../packages/shared/common/constants/execution-source.constant';
import { LogSource } from '@src/domain/constants/log-action.constant';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import { CancelFlightBookingDto } from '@shared/modules/health-tourism/dto/commands';

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
  source: ExecutionSources.USER_ACTION,
};

const makeBooking = () =>
  DuffelFlightBooking.create({
    duffelOrderId: 'ord_1',
    offerId: 'off_1',
    mode: 'INSTANT',
    passengers: [],
    slices: [],
    totalAmount: 100,
    currency: 'EUR',
    organizationId: ORG_ID,
    clinicId: CLINIC_ID,
    actorId: ctx.actor.userId,
    logSource: LogSource.SYSTEM,
  });

const build = (
  booking: DuffelFlightBooking | null,
  cancellation: Partial<FlightCancellationResult> = {}
) => {
  let txDepth = 0;
  const depthAtCall: Record<string, number> = {};

  const duffelApi = {
    cancelOrder: jest.fn(async () => {
      depthAtCall.cancelOrder = txDepth;
      return {
        cancellationId: 'can_1',
        refundAmount: null,
        refundCurrency: null,
        ...cancellation,
      };
    }),
  } as unknown as IDuffelApiService;

  const repo = {
    findByIdForUpdate: jest.fn(async () => booking),
    update: jest.fn(async (e: DuffelFlightBooking) => e),
  } as unknown as IDuffelFlightBookingCommandRepository;

  const policyFactory = {
    clinic: jest.fn().mockReturnValue({
      evaluator: {
        check: jest.fn().mockReturnValue({ orThrow: () => undefined }),
      },
    }),
  } as unknown as IPolicyFactory;

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
    handler: new CancelFlightBookingHandler(
      duffelApi,
      repo,
      policyFactory,
      txManager
    ),
    duffelApi,
    repo,
    depthAtCall,
  };
};

const dto = (bookingId: string) =>
  ({ bookingId, reason: 'hasta talebi' }) as CancelFlightBookingDto;

describe('CancelFlightBookingHandler', () => {
  it('kaydı iptal eder ve Duffel siparişini iptal eder', async () => {
    const booking = makeBooking();
    const { handler, duffelApi, repo } = build(booking);

    await handler.execute(
      new CancelFlightBookingCommand(dto(booking.id.value), ctx)
    );

    expect(booking.status).toBe('CANCELLED');
    expect(repo.update).toHaveBeenCalled();
    expect(duffelApi.cancelOrder).toHaveBeenCalledWith('ord_1');
  });

  it('zaten iptal edilmiş kayıtta Duffel’a ikinci iptal GİTMEZ (çift iade önlenir)', async () => {
    const booking = makeBooking();
    booking.cancel({ actorId: ctx.actor.userId, logSource: LogSource.SYSTEM });

    const { handler, duffelApi, repo } = build(booking);

    await handler.execute(
      new CancelFlightBookingCommand(dto(booking.id.value), ctx)
    );

    expect(duffelApi.cancelOrder).not.toHaveBeenCalled();
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('Duffel iptal çağrısı kilit DIŞINDA yapılır', async () => {
    const booking = makeBooking();
    const { handler, depthAtCall } = build(booking);

    await handler.execute(
      new CancelFlightBookingCommand(dto(booking.id.value), ctx)
    );

    expect(depthAtCall.cancelOrder).toBe(0);
  });

  describe('iptal ekonomisi (havayolunun alıkoyduğu tutar)', () => {
    const cancel = (cancellation: Partial<FlightCancellationResult>) => {
      const booking = makeBooking(); // sipariş tutarı 100 EUR
      const { handler } = build(booking, cancellation);
      return handler.execute(
        new CancelFlightBookingCommand(dto(booking.id.value), ctx)
      );
    };

    it('alıkoyulan = sipariş tutarı − iade edilecek tutar', async () => {
      // Duffel İADE EDİLECEĞİ tutarı bildirir, alıkoyduğunu değil. Yanıtı
      // atmak, platform defterinde cezanın hiç görünmemesi demekti.
      const result = await cancel({
        refundAmount: '70.00',
        refundCurrency: 'EUR',
      });

      expect(result.retained).toEqual({ amount: '30.00', currency: 'EUR' });
    });

    it('tam iade → alıkoyulan sıfır (bilinmiyor DEĞİL)', async () => {
      const result = await cancel({
        refundAmount: '100.00',
        refundCurrency: 'EUR',
      });

      expect(result.retained).toEqual({ amount: '0.00', currency: 'EUR' });
    });

    it('iade tutarı bildirilmediyse "bilinmiyor" taşınır (0 varsayılmaz)', async () => {
      // 0 kabul etmek "havayolu hiçbir şey iade etmiyor, tamamı ceza" demek
      // olurdu ve maliyetin tamamını zarara yazardı.
      const result = await cancel({ refundAmount: null });

      expect(result.retained).toBeNull();
    });

    it('iade farklı para biriminde → çıkarılamaz, bilinmiyor', async () => {
      const result = await cancel({
        refundAmount: '3000.00',
        refundCurrency: 'TRY',
      });

      expect(result.retained).toBeNull();
    });

    it('iade sipariş tutarını aşıyorsa tutarsız → bilinmiyor', async () => {
      const result = await cancel({
        refundAmount: '150.00',
        refundCurrency: 'EUR',
      });

      expect(result.retained).toBeNull();
    });

    it('zaten iptalliyse sağlayıcıya gidilmez → ekonomi bilinmiyor', async () => {
      const booking = makeBooking();
      booking.cancel({
        actorId: ctx.actor.userId,
        logSource: LogSource.SYSTEM,
      });
      const { handler } = build(booking);

      const result = await handler.execute(
        new CancelFlightBookingCommand(dto(booking.id.value), ctx)
      );

      expect(result).toEqual({ orderId: null, retained: null });
    });
  });

  it('kayıt yoksa FlightBookingNotFoundException', async () => {
    const { handler } = build(null);

    await expect(
      handler.execute(
        new CancelFlightBookingCommand(
          dto('00000000-0000-4000-8000-000000000000'),
          ctx
        )
      )
    ).rejects.toBeInstanceOf(FlightBookingNotFoundException);
  });
});

describe('CancelFlightBookingHandler — ödeme ile yarış', () => {
  const makeHeldBooking = () =>
    DuffelFlightBooking.create({
      duffelOrderId: 'ord_1',
      offerId: 'off_1',
      mode: 'HOLD',
      passengers: [],
      slices: [],
      totalAmount: 100,
      currency: 'EUR',
      organizationId: ORG_ID,
      clinicId: CLINIC_ID,
      actorId: ctx.actor.userId,
      logSource: LogSource.SYSTEM,
    });

  it('ödeme sürerken iptal REDDEDİLİR ve Duffel’a iptal gitmez', async () => {
    // Regresyon: iptal ile ödeme aynı anda ilerlerse kayıt CANCELLED, Duffel
    // siparişi PAID kalabiliyordu (para gitti, sistemde iptal görünüyor).
    const booking = makeHeldBooking();
    booking.markPaymentInProgress();

    const { handler, duffelApi, repo } = build(booking);

    await expect(
      handler.execute(
        new CancelFlightBookingCommand(dto(booking.id.value), ctx)
      )
    ).rejects.toBeInstanceOf(FlightPaymentInProgressException);

    expect(duffelApi.cancelOrder).not.toHaveBeenCalled();
    expect(repo.update).not.toHaveBeenCalled();
    expect(booking.status).toBe('PAYMENT_IN_PROGRESS');
  });
});
