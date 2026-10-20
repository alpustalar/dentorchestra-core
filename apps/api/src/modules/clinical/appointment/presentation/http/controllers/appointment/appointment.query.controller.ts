import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, CapabilityGuard } from '@modules/identity/auth/auth/guards';
import { GetContext, HasCapability, IGetContext } from '@common/decorators';
import { CAPABILITIES } from '@src/infrastructure/persistence/prisma/data/modules';
import { TSQueryBus } from '@common/cqrs/type-safe-query-bus';
import { Appointment, PaginationDto } from '@shared';
import { GetClinicAppointmentsDto } from '@shared/modules/appointment/dto/queries/get-clinic-appointments.dto';
import { GetOrganizationAppointmentsDto } from '@shared/modules/appointment/dto/queries/get-organization-appointments.dto';
import { GetProviderCalendarDto } from '@shared/modules/appointment/dto/queries/get-provider-calendar.dto';
import { GetClinicOpenSlotsDto } from '@shared/modules/appointment/dto/queries/get-clinic-open-slots.dto';
import { GetClinicCalendarDto } from '@shared/modules/appointment/dto/queries/get-clinic-calendar.dto';
import { SearchClinicAppointmentsDto } from '@shared/modules/appointment/dto/queries/search-clinic-appointments.dto';
import { GetUpcomingRemindersDto } from '@shared/modules/appointment/dto/queries/get-upcoming-reminders.dto';
import { GetClinicDailySummaryDto } from '@shared/modules/appointment/dto/queries/get-clinic-daily-summary.dto';
import { CheckAppointmentConflictsDto } from '@shared/modules/appointment/dto/queries/check-appointment-conflicts.dto';
import { GetWaitingRoomDto } from '@shared/modules/appointment/dto/queries/get-waiting-room.dto';
import { GetClinicAppointmentsQuery } from '@modules/clinical/appointment/application/queries/get-clinic-appointments/get-clinic-appointments.query';
import { GetOrganizationAppointmentsQuery } from '@modules/clinical/appointment/application/queries/get-organization-appointments/get-organization-appointments.query';
import { GetActionRequiredQuery } from '@modules/clinical/appointment/application/queries/get-action-required/get-action-required.query';
import { GetProviderCalendarQuery } from '@modules/clinical/appointment/application/queries/get-provider-calendar/get-provider-calendar.query';
import { GetClinicOpenSlotsQuery } from '@modules/clinical/appointment/application/queries/get-clinic-open-slots/get-clinic-open-slots.query';
import { GetClinicCalendarQuery } from '@modules/clinical/appointment/application/queries/get-clinic-calendar/get-clinic-calendar.query';
import { SearchClinicAppointmentsQuery } from '@modules/clinical/appointment/application/queries/search-clinic-appointments/search-clinic-appointments.query';
import { GetUpcomingRemindersQuery } from '@modules/clinical/appointment/application/queries/get-upcoming-reminders/get-upcoming-reminders.query';
import { GetClinicDailySummaryQuery } from '@modules/clinical/appointment/application/queries/get-clinic-daily-summary/get-clinic-daily-summary.query';
import { CheckAppointmentConflictsQuery } from '@modules/clinical/appointment/application/queries/check-appointment-conflicts/check-appointment-conflicts.query';
import { GetWaitingRoomQuery } from '@modules/clinical/appointment/application/queries/get-waiting-room/get-waiting-room.query';
import { GetAppointmentDetailQuery } from '@modules/clinical/appointment/application/queries/get-appointment-detail/get-appointment-detail.query';
import { Serialize } from '@common/decorators/serialize.decorator';
import {
  AppointmentDetailResponseDto,
  AppointmentResponseDto,
  ClinicCalendarDayResponseDto,
  ClinicDailySummaryResponseDto,
  ClinicOpenSlotsDayResponseDto,
  ConflictingAppointmentResponseDto,
  WaitingRoomEntryResponseDto,
} from '@modules/clinical/appointment/presentation/http/dto';
import {
  AppointmentWithDetails,
  ClinicCalendarDay,
  ClinicDailySummary,
  ClinicOpenSlotsDay,
  ConflictingAppointmentView,
  WaitingRoomEntry,
} from '@modules/clinical/appointment/domain/contracts/appointment';

@UseGuards(AuthGuard, CapabilityGuard)
@HasCapability(CAPABILITIES.APPOINTMENT.read)
@Controller()
export class AppointmentQueryController {
  constructor(private readonly queryBus: TSQueryBus) {}

  @Get()
  @Serialize<Appointment, AppointmentResponseDto>(AppointmentResponseDto, {
    isArray: true,
  })
  getAll(
    @Query() dto: GetClinicAppointmentsDto,
    @Query() pagination: PaginationDto,
    @GetContext() ctx: IGetContext
  ) {
    return this.queryBus.execute(
      new GetClinicAppointmentsQuery({ filter: dto, pagination, ctx })
    );
  }

  @Get('organization')
  @Serialize<Appointment, AppointmentResponseDto>(AppointmentResponseDto, {
    isArray: true,
  })
  getOrganizationAppointments(
    @Query() dto: GetOrganizationAppointmentsDto,
    @GetContext() ctx: IGetContext
  ) {
    return this.queryBus.execute(
      new GetOrganizationAppointmentsQuery(dto, ctx)
    );
  }

  @Get('action-required')
  @Serialize<Appointment, AppointmentResponseDto>(AppointmentResponseDto, {
    isArray: true,
  })
  getActionRequired(
    @Query() pagination: PaginationDto,
    @GetContext() ctx: IGetContext,
    @Query('clinicId', ParseUUIDPipe) clinicId: string
  ) {
    return this.queryBus.execute(
      new GetActionRequiredQuery({ clinicId, pagination, ctx })
    );
  }

  @Get('provider')
  @Serialize<Appointment, AppointmentResponseDto>(AppointmentResponseDto, {
    isArray: true,
  })
  getProviderCalendar(
    @Query() dto: GetProviderCalendarDto,
    @Query() pagination: PaginationDto,
    @GetContext() ctx: IGetContext
  ) {
    return this.queryBus.execute(
      new GetProviderCalendarQuery({ filter: dto, ctx, pagination })
    );
  }

  @Get('open-slots')
  @Serialize<ClinicOpenSlotsDay, ClinicOpenSlotsDayResponseDto>(
    ClinicOpenSlotsDayResponseDto,
    { isArray: true }
  )
  getClinicOpenSlots(
    @Query() dto: GetClinicOpenSlotsDto,
    @GetContext() ctx: IGetContext
  ) {
    return this.queryBus.execute(new GetClinicOpenSlotsQuery(dto, ctx));
  }

  @Get('calendar')
  @Serialize<ClinicCalendarDay, ClinicCalendarDayResponseDto>(
    ClinicCalendarDayResponseDto,
    { isArray: true }
  )
  getClinicCalendar(
    @Query() dto: GetClinicCalendarDto,
    @GetContext() ctx: IGetContext
  ) {
    return this.queryBus.execute(new GetClinicCalendarQuery(dto, ctx));
  }

  @Get('search')
  @Serialize<Appointment, AppointmentResponseDto>(AppointmentResponseDto, {
    isArray: true,
  })
  searchClinicAppointments(
    @Query() dto: SearchClinicAppointmentsDto,
    @GetContext() ctx: IGetContext
  ) {
    return this.queryBus.execute(new SearchClinicAppointmentsQuery(dto, ctx));
  }

  @Get('reminders')
  @Serialize<Appointment, AppointmentResponseDto>(AppointmentResponseDto, {
    isArray: true,
  })
  getUpcomingReminders(
    @Query() dto: GetUpcomingRemindersDto,
    @GetContext() ctx: IGetContext
  ) {
    return this.queryBus.execute(new GetUpcomingRemindersQuery(dto, ctx));
  }

  @Get('daily-summary')
  @Serialize<ClinicDailySummary, ClinicDailySummaryResponseDto>(
    ClinicDailySummaryResponseDto
  )
  getClinicDailySummary(
    @Query() dto: GetClinicDailySummaryDto,
    @GetContext() ctx: IGetContext
  ) {
    return this.queryBus.execute(new GetClinicDailySummaryQuery(dto, ctx));
  }

  @Get('conflicts')
  @Serialize<ConflictingAppointmentView, ConflictingAppointmentResponseDto>(
    ConflictingAppointmentResponseDto,
    { isArray: true }
  )
  checkConflicts(
    @Query() dto: CheckAppointmentConflictsDto,
    @GetContext() ctx: IGetContext
  ) {
    return this.queryBus.execute(
      new CheckAppointmentConflictsQuery({ filter: dto, ctx })
    );
  }

  @Get('waiting-room')
  @Serialize<WaitingRoomEntry, WaitingRoomEntryResponseDto>(
    WaitingRoomEntryResponseDto,
    { isArray: true }
  )
  getWaitingRoom(
    @Query() dto: GetWaitingRoomDto,
    @GetContext() ctx: IGetContext
  ) {
    return this.queryBus.execute(new GetWaitingRoomQuery(dto, ctx));
  }

  @Get(':id')
  @Serialize<AppointmentWithDetails, AppointmentDetailResponseDto>(
    AppointmentDetailResponseDto
  )
  getDetail(@Param('id') id: string, @GetContext() ctx: IGetContext) {
    return this.queryBus.execute(new GetAppointmentDetailQuery(id, ctx));
  }
}
