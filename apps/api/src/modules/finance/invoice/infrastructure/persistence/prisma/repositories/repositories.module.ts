import { Module } from '@nestjs/common';
import { InvoiceRepositoryModule } from '@modules/finance/invoice/infrastructure/persistence/prisma/repositories/invoice/invoice.repository.module';

const RepositoriesModules = [InvoiceRepositoryModule];

@Module({
  imports: [...RepositoriesModules],
  exports: [...RepositoriesModules],
})
export class InvoiceRepositoriesModule {}
