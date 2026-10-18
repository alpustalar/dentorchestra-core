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
import { Serialize } from '@common/decorators/serialize.decorator';
import { TSQueryBus } from '@common/cqrs/type-safe-query-bus';
import { GetAppointmentChargesFilterDto } from '@shared/modules/treatment-charge/dto/queries';
import { GetAppointmentChargesQuery } from '@modules/finance/treatment-charge/application/queries/get-appointment-charges/get-appointment-charges.query';
import { AppointmentChargesResponseDto } from '@modules/finance/treatment-charge/presentation/http/dto/treatment-charge-response.dto';
import { CAPABILITIES } from '@src/infrastructure/persistence/prisma/data/modules';

const { TREATMENTCHARGE } = CAPABILITIES;

/**
 * Randevunun fiyatlı işlem satırlarının okunması. Satırlar indirim oranı ve
 * onaylayan bilgisini taşıdığı için yanıt her zaman serileştirmeden geçer.
 */
@UseGuards(AuthGuard, CapabilityGuard)
@Controller('treatment-charges')
export class TreatmentChargeQueryController {
  constructor(private readonly queryBus: TSQueryBus) {}

  @HasCapability(TREATMENTCHARGE.read)
  @Get('appointments/:appointmentId')
  @Serialize<
    { items: unknown[]; summary: unknown },
    AppointmentChargesResponseDto
  >(AppointmentChargesResponseDto)
  findByAppointment(
    @Param('appointmentId', ParseUUIDPipe) appointmentId: string,
    @Query() filter: GetAppointmentChargesFilterDto,
    @GetContext() ctx: IGetContext
  ) {
    return this.queryBus.execute(
      new GetAppointmentChargesQuery({ appointmentId, filter, ctx })
    );
  }
}
