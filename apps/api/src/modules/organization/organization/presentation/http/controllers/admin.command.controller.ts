import {
  Controller,
  Delete,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@modules/identity/auth/auth/guards';
import { SystemAdminGuard } from '@modules/identity/auth/auth/guards/system-admin/system-admin.guard';

@UseGuards(AuthGuard, SystemAdminGuard)
@Controller()
export class OrganizationAdminCommandController {
  constructor() {}

  @Post()
  create() {}

  @Delete(':organizationId')
  softDelete(
    @Param('organizationId', ParseUUIDPipe) organizationId: string
  ) {}
}
