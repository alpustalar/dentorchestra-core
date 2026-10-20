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
import { GetLeavesByEmployeeQuery } from '@modules/hr/leave/application/queries/get-leaves-by-employee/get-leaves-by-employee.query';
import { GetPendingLeavesQuery } from '@modules/hr/leave/application/queries/get-pending-leaves/get-pending-leaves.query';
import { GetLeaveBalanceQuery } from '@modules/hr/leave/application/queries/get-leave-balance/get-leave-balance.query';
import { GetLeavesFilterDto } from '@shared/modules/leave/dto/queries/get-leaves.dto';
import { Serialize } from '@common/decorators/serialize.decorator';
import {
  LeaveBalanceResponseDto,
  LeaveRequestResponseDto,
} from '@modules/hr/leave/presentation/http/dto/leave-response.dto';
import type { LeaveRequest } from '@shared';
import type { LeaveBalance as LeaveBalanceView } from '@modules/hr/leave/domain/contracts/leave-request';
import { CAPABILITIES } from '@src/infrastructure/persistence/prisma/data/modules';

const { LEAVEREQUEST } = CAPABILITIES;
@UseGuards(AuthGuard, CapabilityGuard)
@HasCapability(LEAVEREQUEST.read)
@Controller()
export class LeaveQueryController {
  constructor(private readonly queryBus: TSQueryBus) {}
  @Get('employees/:employeeId/leaves')
  @Serialize<LeaveRequest, LeaveRequestResponseDto>(LeaveRequestResponseDto, {
    isArray: true,
  })
  listByEmployee(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Query() dto: GetLeavesFilterDto,
    @Query() pagination: PaginationDto,
    @GetContext() ctx: IGetContext
  ) {
    return this.queryBus.execute(
      new GetLeavesByEmployeeQuery({ employeeId, filter: dto, pagination, ctx })
    );
  }
  @Get('employees/:employeeId/leaves/balance')
  @Serialize<LeaveBalanceView, LeaveBalanceResponseDto>(LeaveBalanceResponseDto)
  balance(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @GetContext() ctx: IGetContext
  ) {
    return this.queryBus.execute(new GetLeaveBalanceQuery(employeeId, ctx));
  }
  @Get('leaves/pending')
  @Serialize<LeaveRequest, LeaveRequestResponseDto>(LeaveRequestResponseDto, {
    isArray: true,
  })
  pending(
    @Query() pagination: PaginationDto,
    @GetContext() ctx: IGetContext,
    @Query('clinicId', ParseUUIDPipe) clinicId: string
  ) {
    return this.queryBus.execute(
      new GetPendingLeavesQuery({ pagination, ctx, clinicId })
    );
  }
}
