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
import { TSQueryBus } from '@common/cqrs/type-safe-query-bus';
import { PaginationDto, type Patient } from '@shared';
import { GetPatientsFilterDto } from '@shared/modules/patients/dto/queries';
import { GetPatientsQuery } from '@modules/crm/patient/application/queries/get-patients/get-patients.query';
import { GetPatientByIdQuery } from '@modules/crm/patient/application/queries/get-patient-by-id/get-patient-by-id.query';
import { Serialize } from '@common/decorators/serialize.decorator';
import { PatientResponseDto } from '@modules/crm/patient/presentation/http/dto/patient-response.dto';
import { CAPABILITIES } from '@src/infrastructure/persistence/prisma/data/modules';

/**
 * Hasta okuma uçları. PII ve tıbbi alanlar `PatientResponseDto` + policy
 * serileştirme gruplarıyla filtrelenir: aynı organizasyondaki bir personel
 * temel künyeyi görür, tıbbi alanları yalnız klinik personeli, mali alanları
 * yönetici görür — kolonlar cevaptan **silinerek** gelir.
 */
const { PATIENT } = CAPABILITIES;
@UseGuards(AuthGuard, CapabilityGuard)
@HasCapability(PATIENT.read)
@Controller()
export class PatientQueryController {
  constructor(private readonly queryBus: TSQueryBus) {}

  @Get()
  @Serialize<Patient, PatientResponseDto>(PatientResponseDto, { isArray: true })
  list(
    @Query() dto: GetPatientsFilterDto,
    @Query() pagination: PaginationDto,
    @GetContext() ctx: IGetContext
  ) {
    return this.queryBus.execute(
      new GetPatientsQuery({ filter: dto, pagination, ctx })
    );
  }

  @Get(':patientId')
  @Serialize<Patient, PatientResponseDto>(PatientResponseDto)
  getById(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @GetContext() ctx: IGetContext
  ) {
    return this.queryBus.execute(new GetPatientByIdQuery(patientId, ctx));
  }
}
