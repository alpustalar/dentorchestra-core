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
import { PaginationDto } from '@shared';
import { TSQueryBus } from '@common/cqrs/type-safe-query-bus';
import { GetLedgerByClinicIdQuery } from '@modules/finance/finance-ledger/application/queries/get-ledger-by-clinic-id/get-ledger-by-clinic-id.query';
import { GetClinicFinanceSummaryQuery } from '@modules/finance/finance-ledger/application/queries/get-clinic-finance-summary/get-clinic-finance-summary.query';
import { GetPatientFinanceSummaryQuery } from '@modules/finance/finance-ledger/application/queries/get-patient-finance-summary/get-patient-finance-summary.query';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';
import { Serialize } from '@common/decorators/serialize.decorator';
import {
  FinanceLedgerResponseDto,
  LedgerMismatchResponseDto,
  LedgerSummaryResponseDto,
  PatientFinanceSummaryResponseDto,
  PatientLedgerItemResponseDto,
} from '@modules/finance/finance-ledger/presentation/http/dto/finance-ledger-response.dto';
import type { FinanceLedger } from '@shared';
import type {
  LedgerMismatchRow,
  LedgerSummary,
  PatientFinanceSummary,
  PatientLedgerItem,
} from '@modules/finance/finance-ledger/domain/contracts/finance-ledger';
import { FindLedgerMismatchesQuery } from '@modules/finance/finance-ledger/application/queries/find-ledger-mismatches/find-ledger-mismatches.query';
import { FindLedgerMismatchesFilterDto } from '@shared/modules/finance-ledger/dto/queries';
import { GetLedgerByPatientIdQuery } from '@modules/finance/finance-ledger/application/queries/get-ledger-by-patient-id/get-ledger-by-patient-id.query';
import { CAPABILITIES } from '@src/infrastructure/persistence/prisma/data/modules';

const { FINANCELEDGER } = CAPABILITIES;
@UseGuards(AuthGuard, CapabilityGuard)
@HasCapability(FINANCELEDGER.read)
@Controller('finance-ledger')
export class FinanceLedgerQueryController {
  constructor(private readonly queryBus: TSQueryBus) {}

  /**
   * Kaynak (taksit) ↔ cari defter farkı: tahsilatı/iadesi defterde eksik ya da
   * durumu kaymış kayıtlar. Telafi yolu `POST reconciliation/backfill`.
   *
   * Rota sabit segmentli ve `clinic/:clinicId` kalıplarından ÖNCE tanımlı
   * olmalı (`reconciliation` bir UUID olarak eşleşmeye çalışmasın).
   */
  @Get('reconciliation/mismatches')
  @Serialize<LedgerMismatchRow, LedgerMismatchResponseDto>(
    LedgerMismatchResponseDto,
    { isArray: true }
  )
  getMismatches(
    @GetContext() ctx: IGetContext,
    @Query() filter: FindLedgerMismatchesFilterDto
  ) {
    return this.queryBus.execute(
      new FindLedgerMismatchesQuery({ filter, ctx })
    );
  }

  @Get('clinic/:clinicId')
  @Serialize<FinanceLedger, FinanceLedgerResponseDto>(
    FinanceLedgerResponseDto,
    { isArray: true }
  )
  getClinicLedger(
    @GetContext() ctx: IGetContext,
    @Param('clinicId', ParseUUIDPipe) clinicId: string,
    @Query() pagination: PaginationDto
  ) {
    return this.queryBus.execute(
      new GetLedgerByClinicIdQuery(clinicId, pagination, ctx)
    );
  }

  @Get('clinic/:clinicId/summary')
  @Serialize<LedgerSummary, LedgerSummaryResponseDto>(LedgerSummaryResponseDto)
  getClinicSummary(
    @GetContext() ctx: IGetContext,
    @Param('clinicId', ParseUUIDPipe) clinicId: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string
  ) {
    return this.queryBus.execute(
      new GetClinicFinanceSummaryQuery({
        clinicId,
        ctx,
        dateFrom: dateFrom ? DateTimeManager.create(dateFrom) : undefined,
        dateTo: dateTo ? DateTimeManager.create(dateTo) : undefined,
      })
    );
  }

  @Get('patient/:patientId/summary')
  @Serialize<PatientFinanceSummary, PatientFinanceSummaryResponseDto>(
    PatientFinanceSummaryResponseDto
  )
  getPatientSummary(
    @GetContext() ctx: IGetContext,
    @Param('patientId', ParseUUIDPipe) patientId: string
  ) {
    return this.queryBus.execute(
      new GetPatientFinanceSummaryQuery(patientId, ctx)
    );
  }

  /** Hastanın cari hareket dökümü (sayfalı). */
  @Get('patient/:patientId')
  @Serialize<PatientLedgerItem, PatientLedgerItemResponseDto>(
    PatientLedgerItemResponseDto,
    { isArray: true }
  )
  getPatientLedger(
    @GetContext() ctx: IGetContext,
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Query() pagination: PaginationDto
  ) {
    return this.queryBus.execute(
      new GetLedgerByPatientIdQuery({ patientId, pagination, ctx })
    );
  }
}
