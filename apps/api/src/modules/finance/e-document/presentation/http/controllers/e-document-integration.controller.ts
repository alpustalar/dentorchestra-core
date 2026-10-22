import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, CapabilityGuard } from '@modules/identity/auth/auth/guards';
import { GetContext, HasCapability, IGetContext } from '@common/decorators';
import { Serialize } from '@common/decorators/serialize.decorator';
import { TSCommandBus } from '@common/cqrs/type-safe-command-bus';
import { TSQueryBus } from '@common/cqrs/type-safe-query-bus';
import { CAPABILITIES } from '@src/infrastructure/persistence/prisma/data/modules';
import { UpsertEDocumentIntegrationDto } from '@shared/modules/e-document/dto';
import { UpsertEDocumentIntegrationCommand } from '@modules/finance/e-document/application/commands/upsert-e-document-integration/upsert-e-document-integration.command';
import { TestEDocumentIntegrationCommand } from '@modules/finance/e-document/application/commands/test-e-document-integration/test-e-document-integration.command';
import { RemoveEDocumentIntegrationCommand } from '@modules/finance/e-document/application/commands/remove-e-document-integration/remove-e-document-integration.command';
import { GetEDocumentIntegrationQuery } from '@modules/finance/e-document/application/queries/get-e-document-integration/get-e-document-integration.query';
import type { EDocumentIntegrationView } from '@modules/finance/e-document/domain/contracts/e-document.contracts';
import { EDocumentIntegrationResponseDto } from '../dto/e-document-integration-response.dto';

const { INVOICE } = CAPABILITIES;

@Controller('integrations')
@UseGuards(AuthGuard, CapabilityGuard)
export class EDocumentIntegrationController {
  constructor(
    private readonly commandBus: TSCommandBus,
    private readonly queryBus: TSQueryBus
  ) {}

  @Get('clinics/:clinicId')
  @HasCapability(INVOICE.read)
  @Serialize<EDocumentIntegrationView, EDocumentIntegrationResponseDto>(
    EDocumentIntegrationResponseDto
  )
  getClinicIntegration(
    @Param('clinicId', ParseUUIDPipe) clinicId: string,
    @GetContext() ctx: IGetContext
  ) {
    return this.queryBus.execute(
      new GetEDocumentIntegrationQuery({
        scope: 'CLINIC',
        sourceId: clinicId,
        ctx,
      })
    );
  }

  @Get('organizations/:organizationId')
  @HasCapability(INVOICE.read)
  @Serialize<EDocumentIntegrationView, EDocumentIntegrationResponseDto>(
    EDocumentIntegrationResponseDto
  )
  getOrganizationIntegration(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @GetContext() ctx: IGetContext
  ) {
    return this.queryBus.execute(
      new GetEDocumentIntegrationQuery({
        scope: 'ORGANIZATION',
        sourceId: organizationId,
        ctx,
      })
    );
  }

  @Put('clinics/:clinicId')
  @HasCapability(INVOICE.update)
  upsertClinicIntegration(
    @Param('clinicId', ParseUUIDPipe) clinicId: string,
    @Body() dto: UpsertEDocumentIntegrationDto,
    @GetContext() ctx: IGetContext
  ) {
    return this.commandBus.execute(
      new UpsertEDocumentIntegrationCommand({
        scope: 'CLINIC',
        sourceId: clinicId,
        data: dto,
        ctx,
      })
    );
  }

  @Put('organizations/:organizationId')
  @HasCapability(INVOICE.update)
  upsertOrganizationIntegration(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Body() dto: UpsertEDocumentIntegrationDto,
    @GetContext() ctx: IGetContext
  ) {
    return this.commandBus.execute(
      new UpsertEDocumentIntegrationCommand({
        scope: 'ORGANIZATION',
        sourceId: organizationId,
        data: dto,
        ctx,
      })
    );
  }

  @Post('clinics/:clinicId/test')
  @HasCapability(INVOICE.update)
  testClinicIntegration(
    @Param('clinicId', ParseUUIDPipe) clinicId: string,
    @GetContext() ctx: IGetContext
  ) {
    return this.commandBus.execute(
      new TestEDocumentIntegrationCommand({
        scope: 'CLINIC',
        sourceId: clinicId,
        ctx,
      })
    );
  }

  @Post('organizations/:organizationId/test')
  @HasCapability(INVOICE.update)
  testOrganizationIntegration(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @GetContext() ctx: IGetContext
  ) {
    return this.commandBus.execute(
      new TestEDocumentIntegrationCommand({
        scope: 'ORGANIZATION',
        sourceId: organizationId,
        ctx,
      })
    );
  }

  @Delete('clinics/:clinicId')
  @HasCapability(INVOICE.delete)
  removeClinicIntegration(
    @Param('clinicId', ParseUUIDPipe) clinicId: string,
    @GetContext() ctx: IGetContext
  ) {
    return this.commandBus.execute(
      new RemoveEDocumentIntegrationCommand({
        scope: 'CLINIC',
        sourceId: clinicId,
        ctx,
      })
    );
  }

  @Delete('organizations/:organizationId')
  @HasCapability(INVOICE.delete)
  removeOrganizationIntegration(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @GetContext() ctx: IGetContext
  ) {
    return this.commandBus.execute(
      new RemoveEDocumentIntegrationCommand({
        scope: 'ORGANIZATION',
        sourceId: organizationId,
        ctx,
      })
    );
  }
}
