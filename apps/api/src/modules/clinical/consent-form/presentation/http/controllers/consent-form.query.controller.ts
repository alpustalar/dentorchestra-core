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
import { PaginationDto } from '@shared';
import { GetConsentTemplatesFilterDto } from '@shared/modules/consent-form/dto/queries';
import { GetConsentTemplatesQuery } from '@modules/clinical/consent-form/application/queries/get-consent-templates/get-consent-templates.query';
import { GetConsentTemplateByIdQuery } from '@modules/clinical/consent-form/application/queries/get-consent-template-by-id/get-consent-template-by-id.query';
import { GetConsentSubmissionsByPatientQuery } from '@modules/clinical/consent-form/application/queries/get-consent-submissions-by-patient/get-consent-submissions-by-patient.query';
import { GetConsentSubmissionByIdQuery } from '@modules/clinical/consent-form/application/queries/get-consent-submission-by-id/get-consent-submission-by-id.query';
import { Serialize } from '@common/decorators/serialize.decorator';
import { ConsentFormSubmission, ConsentFormTemplate } from '@shared';
import {
  ConsentFormSubmissionListItemResponseDto,
  ConsentFormSubmissionResponseDto,
  ConsentFormTemplateResponseDto,
} from '@modules/clinical/consent-form/presentation/http/dto';
import type { ConsentFormSubmissionListItem } from '@modules/clinical/consent-form/domain/contracts';
import { CAPABILITIES } from '@src/infrastructure/persistence/prisma/data/modules';

const { CONSENTFORMSUBMISSION, CONSENTFORMTEMPLATE } = CAPABILITIES;
@UseGuards(AuthGuard, CapabilityGuard)
@Controller()
export class ConsentFormQueryController {
  constructor(private readonly queryBus: TSQueryBus) {}

  @HasCapability(CONSENTFORMTEMPLATE.read)
  @Get('consent-templates')
  @Serialize<ConsentFormTemplate, ConsentFormTemplateResponseDto>(
    ConsentFormTemplateResponseDto,
    { isArray: true }
  )
  list(
    @Query() dto: GetConsentTemplatesFilterDto,
    @Query() pagination: PaginationDto,
    @GetContext() ctx: IGetContext
  ) {
    return this.queryBus.execute(
      new GetConsentTemplatesQuery({ filter: dto, pagination, ctx })
    );
  }

  @HasCapability(CONSENTFORMTEMPLATE.read)
  @Get('consent-templates/:templateId')
  @Serialize<ConsentFormTemplate, ConsentFormTemplateResponseDto>(
    ConsentFormTemplateResponseDto
  )
  getById(
    @Param('templateId', ParseUUIDPipe) templateId: string,
    @GetContext() ctx: IGetContext
  ) {
    return this.queryBus.execute(
      new GetConsentTemplateByIdQuery(templateId, ctx)
    );
  }

  @HasCapability(CONSENTFORMSUBMISSION.read)
  @Get('patients/:patientId/consent-forms')
  @Serialize<
    ConsentFormSubmissionListItem,
    ConsentFormSubmissionListItemResponseDto
  >(ConsentFormSubmissionListItemResponseDto, { isArray: true })
  listByPatient(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Query() pagination: PaginationDto,
    @GetContext() ctx: IGetContext
  ) {
    return this.queryBus.execute(
      new GetConsentSubmissionsByPatientQuery({ patientId, pagination, ctx })
    );
  }

  @HasCapability(CONSENTFORMSUBMISSION.read)
  @Get('consent-forms/:submissionId')
  @Serialize<ConsentFormSubmission, ConsentFormSubmissionResponseDto>(
    ConsentFormSubmissionResponseDto
  )
  getSubmissionById(
    @Param('submissionId', ParseUUIDPipe) submissionId: string,
    @GetContext() ctx: IGetContext
  ) {
    return this.queryBus.execute(
      new GetConsentSubmissionByIdQuery(submissionId, ctx)
    );
  }
}
