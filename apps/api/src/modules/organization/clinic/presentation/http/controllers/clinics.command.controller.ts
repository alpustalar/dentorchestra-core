import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, CapabilityGuard } from '@modules/identity/auth/auth/guards';
import {
  CreateClinicDto,
  SetClinicBusinessTypeDto,
  UpdateClinicAppointmentSettingsDto,
  UpdateClinicDto,
} from '@shared';
import { CreateClinicCommand } from '@modules/organization/clinic/application/commands/create-clinic/create-clinic.command';
import {
  GetContext,
  IGetContext,
} from '@common/decorators/get-context.decorator';
import { UpdateClinicCommand } from '@modules/organization/clinic/application/commands/update-clinic/update-clinic.command';
import { UpdateClinicAppointmentSettingsCommand } from '@modules/organization/clinic/application/commands/update-clinic-appointment-settings/update-clinic-appointment-settings.command';
import { SetClinicBusinessTypeCommand } from '@modules/organization/clinic/application/commands/set-clinic-business-type/set-clinic-business-type.command';
import { TSCommandBus } from '@common/cqrs/type-safe-command-bus';
import { HasCapability } from '@common/decorators';
import { CAPABILITIES } from '@src/infrastructure/persistence/prisma/data/modules';

const { CLINIC, CLINICAPPOINTMENTSETTINGS, CLINICFINANCESETTINGS } =
  CAPABILITIES;
@UseGuards(AuthGuard, CapabilityGuard)
@Controller()
export class ClinicCommandController {
  constructor(private readonly commandBus: TSCommandBus) {}

  @HasCapability(CLINIC.create)
  @Post('')
  create(@Body() dto: CreateClinicDto, @GetContext() ctx: IGetContext) {
    return this.commandBus.execute(new CreateClinicCommand({ data: dto, ctx }));
  }

  @HasCapability(CLINIC.update)
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateClinicDto,
    @GetContext() ctx: IGetContext
  ) {
    return this.commandBus.execute(
      new UpdateClinicCommand({ clinicId: id, data: dto, ctx })
    );
  }

  @HasCapability(CLINICAPPOINTMENTSETTINGS.update)
  @Patch(':id/appointment-settings')
  updateAppointmentSettings(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateClinicAppointmentSettingsDto,
    @GetContext() ctx: IGetContext
  ) {
    return this.commandBus.execute(
      new UpdateClinicAppointmentSettingsCommand({
        clinicId: id,
        data: dto,
        ctx,
      })
    );
  }

  @HasCapability(CLINICFINANCESETTINGS.update)
  @Patch(':id/business-type')
  setBusinessType(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetClinicBusinessTypeDto,
    @GetContext() ctx: IGetContext
  ) {
    return this.commandBus.execute(
      new SetClinicBusinessTypeCommand({ clinicId: id, data: dto, ctx })
    );
  }
}
