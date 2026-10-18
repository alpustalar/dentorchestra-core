import { Module } from '@nestjs/common';
import { RoleQueryModule } from '@modules/identity/role/application/queries/query.module';

@Module({ imports: [RoleQueryModule] })
export class RoleModule {}
