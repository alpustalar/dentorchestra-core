import {
  Body,
  Controller,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, CapabilityGuard } from '@modules/identity/auth/auth/guards';
import { GetContext, HasCapability, IGetContext } from '@common/decorators';
import { CAPABILITIES } from '@src/infrastructure/persistence/prisma/data/modules';
import { TSCommandBus } from '@common/cqrs/type-safe-command-bus';
import { ScheduleAppointmentDto } from '@shared/modules/appointment/dto/commands/schedule-appointment.dto';
import { StaffRescheduleDto } from '@shared/modules/appointment/dto/commands/staff-reschedule.dto';
import { CancelAppointmentDto } from '@shared/modules/appointment/dto/commands/cancel-appointment.dto';
import { UpdateAppointmentDetailsDto } from '@shared/modules/appointment/dto/commands/update-appointment-details.dto';
import { CancelProviderDayDto } from '@shared/modules/appointment/dto/commands/cancel-provider-day.dto';
import { AppointmentSlotDto } from '@shared/modules/appointment/dto/commands/appointment-slot.dto';
import { UpdateAppointmentDetailsCommand } from '@modules/clinical/appointment/application/commands/update-appointment-details/update-appointment-details.command';
import { CancelProviderDayCommand } from '@modules/clinical/appointment/application/commands/cancel-provider-day/cancel-provider-day.command';
import { CheckInAppointmentCommand } from '@modules/clinical/appointment/application/commands/check-in-appointment/check-in-appointment.command';
import { LockAppointmentSlotCommand } from '@modules/clinical/appointment/application/commands/lock-appointment-slot/lock-appointment-slot.command';
import { ReleaseAppointmentSlotCommand } from '@modules/clinical/appointment/application/commands/release-appointment-slot/release-appointment-slot.command';
import { ScheduleAppointmentCommand } from '@modules/clinical/appointment/application/commands/schedule-appointment/schedule-appointment.command';
import { StaffRescheduleCommand } from '@modules/clinical/appointment/application/commands/staff-reschedule/staff-reschedule.command';
import { CancelAppointmentCommand } from '@modules/clinical/appointment/application/commands/cancel-appointment/cancel-appointment.command';
import { ConfirmAppointmentCommand } from '@modules/clinical/appointment/application/commands/confirm-appointment/confirm-appointment.command';
import { CompleteAppointmentCommand } from '@modules/clinical/appointment/application/commands/complete-appointment/complete-appointment.command';
import { MarkNoShowCommand } from '@modules/clinical/appointment/application/commands/mark-no-show/mark-no-show.command';

const { APPOINTMENT } = CAPABILITIES;

@UseGuards(AuthGuard, CapabilityGuard)
@Controller()
export class AppointmentCommandController {
  constructor(private readonly commandBus: TSCommandBus) {}

  @Post('schedule')
  @HasCapability(APPOINTMENT.create)
  schedule(
    @Body() dto: ScheduleAppointmentDto,
    @GetContext() ctx: IGetContext
  ) {
    return this.commandBus.execute(new ScheduleAppointmentCommand(dto, ctx));
  }

  @Post('slots/lock')
  @HasCapability(APPOINTMENT.create)
  lockSlot(@Body() dto: AppointmentSlotDto, @GetContext() ctx: IGetContext) {
    return this.commandBus.execute(
      new LockAppointmentSlotCommand({ data: dto, ctx })
    );
  }

  @Post('slots/release')
  @HasCapability(APPOINTMENT.create)
  releaseSlot(@Body() dto: AppointmentSlotDto, @GetContext() ctx: IGetContext) {
    // Kilit sahibi aktörün userId'sinden türer (handler fallback'i); hasta/AI
    // akışı holderId'yi bus üzerinden açıkça geçer.
    return this.commandBus.execute(
      new ReleaseAppointmentSlotCommand({ data: dto, ctx })
    );
  }

  @Patch('provider/cancel-day')
  @HasCapability(APPOINTMENT.update)
  cancelProviderDay(
    @Body() dto: CancelProviderDayDto,
    @GetContext() ctx: IGetContext
  ) {
    return this.commandBus.execute(new CancelProviderDayCommand(dto, ctx));
  }

  @Patch(':id/details')
  @HasCapability(APPOINTMENT.update)
  updateDetails(
    @Param('id') id: string,
    @Body() dto: UpdateAppointmentDetailsDto,
    @GetContext() ctx: IGetContext
  ) {
    return this.commandBus.execute(
      new UpdateAppointmentDetailsCommand({ appointmentId: id, data: dto, ctx })
    );
  }

  @Patch(':id/reschedule')
  @HasCapability(APPOINTMENT.update)
  reschedule(
    @Param('id') id: string,
    @Body() dto: StaffRescheduleDto,
    @GetContext() ctx: IGetContext
  ) {
    return this.commandBus.execute(
      new StaffRescheduleCommand({ ...dto, appointmentId: id }, ctx)
    );
  }

  @Patch(':id/cancel')
  @HasCapability(APPOINTMENT.update)
  cancel(
    @Param('id') id: string,
    @Body() dto: CancelAppointmentDto,
    @GetContext() ctx: IGetContext
  ) {
    const data = { ...dto, appointmentId: id };
    return this.commandBus.execute(new CancelAppointmentCommand(data, ctx));
  }

  @Patch(':id/confirm')
  @HasCapability(APPOINTMENT.update)
  confirm(@Param('id') id: string, @GetContext() ctx: IGetContext) {
    return this.commandBus.execute(new ConfirmAppointmentCommand(id, ctx));
  }

  @Patch(':id/complete')
  @HasCapability(APPOINTMENT.update)
  complete(@Param('id') id: string, @GetContext() ctx: IGetContext) {
    return this.commandBus.execute(new CompleteAppointmentCommand(id, ctx));
  }

  @Patch(':id/no-show')
  @HasCapability(APPOINTMENT.update)
  noShow(@Param('id') id: string, @GetContext() ctx: IGetContext) {
    return this.commandBus.execute(new MarkNoShowCommand(id, ctx));
  }

  @Patch(':id/check-in')
  @HasCapability(APPOINTMENT.update)
  checkIn(@Param('id') id: string, @GetContext() ctx: IGetContext) {
    return this.commandBus.execute(new CheckInAppointmentCommand(id, ctx));
  }
}
