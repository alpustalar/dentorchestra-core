import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { buildPaginationMeta } from '@src/infrastructure/persistence/prisma/helpers';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import {
  IPlatformTenantProvider,
  PLATFORM_TENANT_PROVIDER,
} from '@modules/finance/accounting/posting/domain/interfaces/platform-tenant.provider.interface';
import {
  BOOKING_PAYMENT_REFUND_QUERY_REPOSITORY,
  IBookingPaymentRefundQueryRepository,
} from '@modules/crm/health-tourism/booking-payment/domain/repositories/booking-payment-refund/booking-payment-refund.query.repository';
import {
  bookingPaymentRefundIdempotencyKey,
  BOOKING_PAYMENT_REFUND_STALE_AFTER_MINUTES,
} from '@modules/crm/health-tourism/booking-payment/domain/constants/booking-payment-refund.constant';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';
import { FindUnresolvedBookingPaymentRefundsQuery } from './find-unresolved-booking-payment-refunds.query';
import { FindUnresolvedBookingPaymentRefundsResponse } from './find-unresolved-booking-payment-refunds.response';

/**
 * Kapanmamış rezervasyon iadeleri. Salt okuma; hiçbir mutasyona karar vermez (karar
 * `resolve` / `retry` komutlarında, kilit altında yeniden okunarak verilir).
 *
 * Yetki defterin sahibinden — platform kiracısı: iade defteri klinik personelinin değil
 * platformun işidir.
 */
@QueryHandler(FindUnresolvedBookingPaymentRefundsQuery)
export class FindUnresolvedBookingPaymentRefundsHandler implements IQueryHandler<
  FindUnresolvedBookingPaymentRefundsQuery,
  FindUnresolvedBookingPaymentRefundsResponse
> {
  constructor(
    @Inject(BOOKING_PAYMENT_REFUND_QUERY_REPOSITORY)
    private readonly refundQueryRepo: IBookingPaymentRefundQueryRepository,
    @Inject(PLATFORM_TENANT_PROVIDER)
    private readonly platformTenant: IPlatformTenantProvider,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory
  ) {}

  async execute(
    query: FindUnresolvedBookingPaymentRefundsQuery
  ): Promise<FindUnresolvedBookingPaymentRefundsResponse> {
    const { filter, pagination, ctx } = query.payload;

    const target = await this.platformTenant.resolve();
    const { evaluator, policy } = this.policyFactory.finance(
      ctx.actor,
      ctx.source
    );
    evaluator
      .check(
        (p) => p.canAccessClinicFinances(target.clinicId),
        'Platform iadelerini görme yetkiniz yok.'
      )
      .orThrow('health-tourism.booking-payment-refund.list-unresolved');

    const result = await this.refundQueryRepo.findUnresolved({
      filter,
      pagination,
    });

    const now = DateTimeManager.create();
    const staleCutoff = DateTimeManager.subtractMinutes(
      now,
      BOOKING_PAYMENT_REFUND_STALE_AFTER_MINUTES
    );

    return {
      data: result.items.map((row) => ({
        id: row.id,
        bookingPaymentId: row.bookingPaymentId,
        clinicId: row.clinicId,
        kind: row.kind,
        origin: row.origin,
        provider: row.provider,
        chargeProviderRef: row.chargeProviderRef,
        amount: row.amount.toFixed(2),
        currency: row.currency,
        status: row.status,
        attemptCount: row.attemptCount,
        idempotencyKey: bookingPaymentRefundIdempotencyKey({
          refundId: row.id,
          attempt: row.attemptCount,
        }),
        failureReason: row.failureReason,
        requestedAt: row.requestedAt,
        stale:
          row.status === 'PENDING' &&
          row.requestedAt !== null &&
          DateTimeManager.isBeforeOrEqual(row.requestedAt, staleCutoff),
      })),
      meta: {
        pagination: buildPaginationMeta(pagination, result.total),
        serializationOptions: policy.getSerializationOptions({
          clinicId: target.clinicId,
        }),
      },
    };
  }
}
