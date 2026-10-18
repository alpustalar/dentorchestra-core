import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { BaseRepository } from '@src/infrastructure/persistence/prisma/base.repository';
import { PrismaService } from '@src/infrastructure/persistence/prisma/prisma.service';
import { FinanceLedgerEntity } from '@modules/finance/finance-ledger/domain/entities/finance-ledger.entity';
import { IFinanceLedgerCommandRepository } from '@modules/finance/finance-ledger/domain/repositories/finance-ledger/finance-ledger.command.repository';
import { LedgerEntryAlreadyExistsException } from '@modules/finance/finance-ledger/domain/exceptions/finance-ledger.exceptions';

@Injectable()
export class FinanceLedgerCommandRepository
  extends BaseRepository
  implements IFinanceLedgerCommandRepository
{
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  async create(entry: FinanceLedgerEntity): Promise<FinanceLedgerEntity> {
    const data = entry.toPersistence();
    try {
      const raw = await this.db.financeLedger.create({ data });
      entry.flushEvents();
      return new FinanceLedgerEntity(raw);
    } catch (error) {
      // `installmentId` unique: aynı taksit için ikinci kayıt denemesi
      // (olayın tekrar teslimi / telafi turu) bir hata değil, "zaten var"
      // bilgisidir. Çağıran mevcut kaydı okuyup durumunu hizalar.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new LedgerEntryAlreadyExistsException(
          data.installmentId ?? data.id
        );
      }
      throw error;
    }
  }

  async findByInstallmentId(
    installmentId: string
  ): Promise<FinanceLedgerEntity | null> {
    const raw = await this.db.financeLedger.findUnique({
      where: { installmentId },
    });
    return raw ? new FinanceLedgerEntity(raw) : null;
  }

  async update(entry: FinanceLedgerEntity): Promise<FinanceLedgerEntity> {
    const data = entry.toPersistence();
    const { id, ...update } = data;
    const raw = await this.db.financeLedger.update({
      where: { id },
      data: update,
    });
    entry.flushEvents();
    return new FinanceLedgerEntity(raw);
  }
}
