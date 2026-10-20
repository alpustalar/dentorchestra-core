import { Inject, Injectable } from '@nestjs/common';

import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';
import {
  DateRange,
  DayMinute,
  DayMinuteRange,
} from '@src/domain/value-objects';

import { ProviderNotFoundException } from '@modules/clinical/provider/domain/exceptions/provider.exceptions';
import { ProviderShiftNotFoundException } from '@modules/clinical/provider/domain/exceptions/provider-shift.exceptions';
import { ProviderSchedule } from '@modules/clinical/provider/domain/value-objects/provider-schedule.vo';
import {
  IProviderCommandRepository,
  PROVIDER_COMMAND_REPOSITORY,
} from '@modules/clinical/provider/domain/repositories/provider/provider.command.repository';
import {
  IProviderAvailabilityQueryRepository,
  PROVIDER_AVAILABILITY_QUERY_REPOSITORY,
} from '@modules/clinical/provider/domain/repositories/provider-availability/provider-availability.query.repository';
import {
  IProviderShiftCommandRepository,
  PROVIDER_SHIFT_COMMAND_REPOSITORY,
} from '@modules/clinical/provider/domain/repositories/provider-shift/provider-shift.command.repository';
import { ProviderException } from '@modules/clinical/provider/domain/entities/provider-exception.entity';
import {
  IProviderExceptionCommandRepository,
  PROVIDER_EXCEPTION_COMMAND_REPOSITORY,
} from '@modules/clinical/provider/domain/repositories/provider-exception/provider-exception.command.repository';
import { IProviderBookingService } from '@modules/clinical/provider/domain/services/provider-booking/provider-booking.service.interface';

export interface AssertCanBookParams {
  providerId: string;
  startTime: Date;
  endTime: Date;
  isConsultation?: boolean;
}

@Injectable()
export class ProviderBookingService implements IProviderBookingService {
  constructor(
    @Inject(PROVIDER_COMMAND_REPOSITORY)
    private readonly providerRepo: IProviderCommandRepository,
    @Inject(PROVIDER_EXCEPTION_COMMAND_REPOSITORY)
    private readonly providerExceptionRepo: IProviderExceptionCommandRepository,
    @Inject(PROVIDER_AVAILABILITY_QUERY_REPOSITORY)
    private readonly providerAvailabilityRepo: IProviderAvailabilityQueryRepository,
    @Inject(PROVIDER_SHIFT_COMMAND_REPOSITORY)
    private readonly providerShiftRepo: IProviderShiftCommandRepository
  ) {}

  /**
   * Uzmanın verilen zaman aralığında randevu kabul edip edemeyeceğini doğrular.
   * Herhangi bir kural ihlalinde ilgili Domain Exception fırlatır.
   */
  async assertCanBook(params: AssertCanBookParams): Promise<void> {
    const { providerId, startTime, endTime, isConsultation } = params;

    const bookingTimeRange = DateRange.create(startTime, endTime).orThrow();

    const provider = await this.providerRepo.findById(providerId);
    if (!provider) throw new ProviderNotFoundException();

    if (isConsultation) {
      provider.validate.canAcceptConsultation.orThrow();
    }

    const exceptions =
      await this.providerExceptionRepo.findExceptionsByDateRange(
        providerId,
        bookingTimeRange.startDate,
        bookingTimeRange.endDate
      );

    // 1. Vardiya (Shift) Modunda Çalışan Uzman Kontrolü
    if (provider.validate.operationMode.isShift.value) {
      await this.validateShiftBooking({
        providerId,
        startTime,
        endTime,
        bookingTimeRange,
        exceptions,
      });
      return;
    }

    // 2. Standart Çalışma Saatleri (Availability) Modunda Çalışan Uzman Kontrolü
    await this.validateStandardBooking(
      providerId,
      bookingTimeRange,
      exceptions
    );
  }

  /**
   * Shift (Vardiya) modu için mola çakışması, vardiya dışı ve izin kontrolleri
   */
  private async validateShiftBooking(params: {
    providerId: string;
    startTime: Date;
    endTime: Date;
    bookingTimeRange: DateRange;
    exceptions: ProviderException[];
  }): Promise<void> {
    const { providerId, startTime, endTime, bookingTimeRange, exceptions } =
      params;

    const providerShifts = await this.providerShiftRepo.findShiftsByDateRange(
      providerId,
      bookingTimeRange.startDate,
      bookingTimeRange.endDate
    );

    const dateKey = DateTimeManager.toDateKey(startTime);

    const providerShift = providerShifts.find(
      (shift) => DateTimeManager.toDateKey(shift.date) === dateKey
    );

    if (!providerShift) throw new ProviderShiftNotFoundException();

    const requestedRange = DayMinuteRange.create(
      DayMinute.fromDate(startTime).orThrow(),
      DayMinute.fromDate(endTime).orThrow()
    ).orThrow();

    // Mola çakışması veya vardiya dışına taşma kontrolü
    providerShift.validate.canBook(requestedRange).orThrow();

    // İzin/İstisna kontrolü
    exceptions.forEach((exception) => {
      if (exception.validate.type.isOff.value) {
        exception.dateRange.validate
          .isOverlappingWith(
            bookingTimeRange,
            'Uzmanın bu saatte izni bulunuyor'
          )
          .orThrow();
      }
    });
  }

  /**
   * Standart çalışma saatleri (Weekly Schedule) ve istisna takvimi kontrolü
   */
  private async validateStandardBooking(
    providerId: string,
    bookingTimeRange: DateRange,
    exceptions: ProviderException[]
  ): Promise<void> {
    const availabilities =
      await this.providerAvailabilityRepo.findManyByProviderId(providerId);

    const providerSchedule = ProviderSchedule.create(
      availabilities,
      exceptions
    );

    providerSchedule.validate.bookingAvailability(bookingTimeRange).orThrow();
  }
}
