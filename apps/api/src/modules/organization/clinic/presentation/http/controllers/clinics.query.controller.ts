import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, CapabilityGuard } from '@modules/identity/auth/auth/guards';
import { CAPABILITIES } from '@src/infrastructure/persistence/prisma/data/modules';
import { HasCapability } from '@common/decorators';
import { Serialize } from '@common/decorators/serialize.decorator';
import {
  GetContext,
  IGetContext,
} from '@common/decorators/get-context.decorator';
import { TSQueryBus } from '@common/cqrs/type-safe-query-bus';
import { GetClinicAppointmentSettingsQuery } from '@modules/organization/clinic/application/queries/get-clinic-appointment-settings/get-clinic-appointment-settings.query';
import { ClinicAppointmentSettingsView } from '@modules/organization/clinic/application/queries/get-clinic-appointment-settings/get-clinic-appointment-settings.response';
import { ClinicAppointmentSettingsResponseDto } from '@modules/organization/clinic/presentation/http/dto/clinic-appointment-settings-response.dto';

const { CLINICAPPOINTMENTSETTINGS } = CAPABILITIES;

@UseGuards(AuthGuard, CapabilityGuard)
@Controller()
@HasCapability(CLINICAPPOINTMENTSETTINGS.read)
export class ClinicQueryController {
  constructor(private readonly queryBus: TSQueryBus) {}

  @Get(':id/appointment-settings')
  @Serialize<
    ClinicAppointmentSettingsView,
    ClinicAppointmentSettingsResponseDto
  >(ClinicAppointmentSettingsResponseDto)
  getAppointmentSettings(
    @Param('id', ParseUUIDPipe) clinicId: string,
    @GetContext() _ctx: IGetContext
  ) {
    return this.queryBus.execute(
      new GetClinicAppointmentSettingsQuery(clinicId)
    );
  }
}
