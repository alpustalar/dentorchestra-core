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
import {
  GetAttendanceFilterDto,
  GetAttendanceSummaryFilterDto,
} from '@shared/modules/attendance/dto/queries';
import { GetAttendanceByEmployeeQuery } from '@modules/hr/attendance/application/queries/get-attendance-by-employee/get-attendance-by-employee.query';
import { GetAttendanceSummaryQuery } from '@modules/hr/attendance/application/queries/get-attendance-summary/get-attendance-summary.query';
import { Serialize } from '@common/decorators/serialize.decorator';
import {
  AttendanceRecordResponseDto,
  AttendanceSummaryResponseDto,
} from '@modules/hr/attendance/presentation/http/dto/attendance-response.dto';
import type { AttendanceRecord } from '@shared';
import type { AttendanceSummary } from '@modules/hr/attendance/domain/contracts/attendance-record';
import { CAPABILITIES } from '@src/infrastructure/persistence/prisma/data/modules';

const { ATTENDANCERECORD } = CAPABILITIES;
@UseGuards(AuthGuard, CapabilityGuard)
@HasCapability(ATTENDANCERECORD.read)
@Controller()
export class AttendanceQueryController {
  constructor(private readonly queryBus: TSQueryBus) {}
  @Get('employees/:employeeId/attendance')
  @Serialize<AttendanceRecord, AttendanceRecordResponseDto>(
    AttendanceRecordResponseDto,
    { isArray: true }
  )
  list(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Query() dto: GetAttendanceFilterDto,
    @Query() pagination: PaginationDto,
    @GetContext() ctx: IGetContext
  ) {
    return this.queryBus.execute(
      new GetAttendanceByEmployeeQuery({
        employeeId,
        filter: dto,
        pagination,
        ctx,
      })
    );
  }
  @Get('employees/:employeeId/attendance/summary')
  @Serialize<AttendanceSummary, AttendanceSummaryResponseDto>(
    AttendanceSummaryResponseDto
  )
  summary(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Query() dto: GetAttendanceSummaryFilterDto,
    @GetContext() ctx: IGetContext
  ) {
    return this.queryBus.execute(
      new GetAttendanceSummaryQuery({ employeeId, filter: dto, ctx })
    );
  }
}
