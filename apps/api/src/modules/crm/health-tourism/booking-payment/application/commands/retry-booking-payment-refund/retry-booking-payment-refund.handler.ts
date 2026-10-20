import { Decimal } from 'decimal.js';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import {
  CARD_CHARGEBACK_EXPOSURE_GUARD,
  ICardChargebackExposureGuard,
} from '@modules/finance/bank/domain/services/card-chargeback-exposure/card-chargeback-exposure.guard.interface';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction/transaction.manager';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import {
  IPlatformTenantProvider,
  PLATFORM_TENANT_PROVIDER,
} from '@modules/finance/accounting/posting/domain/interfaces/platform-tenant.provider.interface';
import {
  BOOKING_PAYMENT_COMMAND_REPOSITORY,
  IBookingPaymentCommandRepository,
} from '@modules/crm/health-tourism/booking-payment/domain/repositories/booking-payment/booking-payment.command.repository';
import {
  BOOKING_PAYMENT_REFUND_COMMAND_REPOSITORY,
  IBookingPaymentRefundCommandRepository,
} from '@modules/crm/health-tourism/booking-payment/domain/repositories/booking-payment-refund/booking-payment-refund.command.repository';
import { BookingPaymentRefundNotFoundException } from '@modules/crm/health-tourism/booking-payment/domain/exceptions/booking-payment-refund.exceptions';
import { BookingPaymentNotFoundException } from '@modules/crm/health-tourism/booking-payment/domain/exceptions/booking-payment.exceptions';
import { BookingPaymentRefundExecutor } from '@modules/crm/health-tourism/booking-payment/application/services/booking-payment-refund.executor';
import { RetryBookingPaymentRefundCommand } from './retry-booking-payment-refund.command';
import { RetryBookingPaymentRefundResponse } from './retry-booking-payment-refund.response';

/**
 * Sağlayıcının REDDETTİĞİ (ya da operatörün "gerçekleşmedi" dediği) iadeyi yeniden dener.
 *
 * Yalnız `FAILED` yeniden denenir. `UNCONFIRMED` bilerek denenemez: zaman aşımı sağlayıcıda
 * başarı olabilir, yeniden denemek parayı iki kez geri götürür — önce `resolve` ile
 * doğrulanmalı. Her girişim yeni idempotency anahtarı (`${id}:${attempt}`) taşır.
 *
 * Kapı sırası (`outboxRun`): yetki → bp kilidi → iade kilidi → `retry()` (yalnız FAILED) →
 * güncelle (+ audit olayı); sağlayıcı çağrısı transaction DIŞINDA.
 */
@CommandHandler(RetryBookingPaymentRefundCommand)
export class RetryBookingPaymentRefundHandler implements ICommandHandler<
  RetryBookingPaymentRefundCommand,
  RetryBookingPaymentRefundResponse
> {
  constructor(
    @Inject(PLATFORM_TENANT_PROVIDER)
    private readonly platformTenant: IPlatformTenantProvider,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory,
    @Inject(BOOKING_PAYMENT_COMMAND_REPOSITORY)
    private readonly bookingPaymentRepo: IBookingPaymentCommandRepository,
    @Inject(BOOKING_PAYMENT_REFUND_COMMAND_REPOSITORY)
    private readonly refundRepo: IBookingPaymentRefundCommandRepository,
    @Inject(CARD_CHARGEBACK_EXPOSURE_GUARD)
    private readonly chargebackExposureGuard: ICardChargebackExposureGuard,
    private readonly refundExecutor: BookingPaymentRefundExecutor,
    private readonly txManager: TransactionManager
  ) {}

  async execute(
    command: RetryBookingPaymentRefundCommand
  ): Promise<RetryBookingPaymentRefundResponse> {
    const { refundId, ctx } = command;

    const target = await this.platformTenant.resolve();
    this.policyFactory
      .finance(ctx.actor, ctx.source)
      .evaluator.check(
        (p) => p.canAccessClinicFinances(target.clinicId),
        'Platform iadesini yeniden deneme yetkiniz yok.'
      )
      .orThrow('health-tourism.booking-payment-refund.retry');

    const probe = await this.refundRepo.findById(refundId);
    if (!probe) throw new BookingPaymentRefundNotFoundException();

    const refund = await this.txManager.outboxRun(async () => {
      const bp = await this.bookingPaymentRepo.findByIdForUpdate(
        probe.bookingPaymentId.value
      );
      if (!bp) throw new BookingPaymentNotFoundException();

      const locked = await this.refundRepo.findByIdForUpdate(refundId);
      if (!locked) throw new BookingPaymentRefundNotFoundException();

      // Yeniden deneme parayı yeniden geri götürür: reddedilen ilk denemeden sonra sağlayıcı
      // itiraz açıp parayı kesmiş olabilir (kural 17). Çift çekim iadesi (UNCLAIMED_CHARGE) bp'nin
      // KENDİ tahsilatı değil, ikinci bir çekimdir; itiraz kaynağı değildir.
      if (locked.kind !== 'UNCLAIMED_CHARGE') {
        await this.chargebackExposureGuard.assertReversalWithinCollection({
          sourceType: 'BOOKING_PAYMENT',
          sourceId: locked.bookingPaymentId.value,
          collectedAmount: locked.amount.value,
          alreadyReversedAmount: new Decimal(0),
          requestedAmount: locked.amount.value,
        });
      }

      locked.retry(ctx.actor.userId);
      return this.refundRepo.update(locked);
    });

    const execution = await this.refundExecutor.execute(refund);
    return { refundId: execution.refundId, status: execution.status };
  }
}
