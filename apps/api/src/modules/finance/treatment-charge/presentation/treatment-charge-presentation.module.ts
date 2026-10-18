import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TreatmentChargeCommandController } from './http/controllers/treatment-charge.command.controller';
import { TreatmentChargeQueryController } from './http/controllers/treatment-charge.query.controller';

@Module({
  imports: [CqrsModule],
  controllers: [
    TreatmentChargeCommandController,
    TreatmentChargeQueryController,
  ],
})
export class TreatmentChargePresentationModule {}
