import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { AuthGuard, CapabilityGuard } from '@modules/identity/auth/auth/guards';
import {
  GetContext,
  IGetContext,
} from '@common/decorators/get-context.decorator';
import { FindPosDevicesQuery } from '@modules/finance/pos/physical/application/queries/find-pos-devices/find-pos-devices.query';
import { TSQueryBus } from '@common/cqrs/type-safe-query-bus';
import { Serialize } from '@common/decorators/serialize.decorator';
import { PosDeviceResponseDto } from '@modules/finance/pos/physical/presentation/http/dto/pos-device-response.dto';
import type { PosDeviceItem } from '@modules/finance/pos/physical/application/queries/find-pos-devices/find-pos-devices.response';
import { HasCapability } from '@common/decorators';
import { CAPABILITIES } from '@src/infrastructure/persistence/prisma/data/modules';

const { POSDEVICE } = CAPABILITIES;
@Controller('devices')
@UseGuards(AuthGuard, CapabilityGuard)
@HasCapability(POSDEVICE.read)
export class PosDeviceQueryController {
  constructor(private readonly queryBus: TSQueryBus) {}
  @Get(':clinicId')
  @Serialize<PosDeviceItem, PosDeviceResponseDto>(PosDeviceResponseDto, {
    isArray: true,
  })
  findByClinic(
    @Param('clinicId') clinicId: string,
    @GetContext() ctx: IGetContext
  ) {
    return this.queryBus.execute(new FindPosDevicesQuery(clinicId, ctx));
  }
}
