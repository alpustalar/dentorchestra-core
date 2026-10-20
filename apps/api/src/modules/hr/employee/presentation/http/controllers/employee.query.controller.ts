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
import { Employee, PaginationDto } from '@shared';
import { EmployeeResponseDto } from '@modules/hr/employee/presentation/http/dto';
import { GetEmployeesDto } from '@shared/modules/employee/dto/queries';
import { GetEmployeesQuery } from '@modules/hr/employee/application/queries/get-employees/get-employees.query';
import { GetEmployeeByIdQuery } from '@modules/hr/employee/application/queries/get-employee-by-id/get-employee-by-id.query';
import { CAPABILITIES } from '@src/infrastructure/persistence/prisma/data/modules';

const { EMPLOYEE } = CAPABILITIES;
@UseGuards(AuthGuard, CapabilityGuard)
@HasCapability(EMPLOYEE.read)
@Controller()
export class EmployeeQueryController {
  constructor(private readonly queryBus: TSQueryBus) {}
  @Get()
  @Serialize<Employee, EmployeeResponseDto>(EmployeeResponseDto, {
    isArray: true,
  })
  list(
    @Query() dto: GetEmployeesDto,
    @Query() pagination: PaginationDto,
    @Query('clinicId', ParseUUIDPipe) clinicId: string,
    @GetContext() ctx: IGetContext
  ) {
    return this.queryBus.execute(
      new GetEmployeesQuery({ clinicId, filter: dto, pagination, ctx })
    );
  }
  @Get(':employeeId')
  @Serialize<Employee, EmployeeResponseDto>(EmployeeResponseDto)
  getById(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @GetContext() ctx: IGetContext
  ) {
    return this.queryBus.execute(new GetEmployeeByIdQuery(employeeId, ctx));
  }
}
