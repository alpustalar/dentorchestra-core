import { Injectable } from '@nestjs/common';
import { BaseRepository } from '@src/infrastructure/persistence/prisma/base.repository';
import { PrismaService } from '@src/infrastructure/persistence/prisma/prisma.service';
import { txStorage } from '@src/infrastructure/transaction/als-storage';
import { Account } from '@modules/finance/accounting/chart-of-accounts/domain/entities/account.entity';
import { IAccountCommandRepository } from '@modules/finance/accounting/chart-of-accounts/domain/repositories/account/account.command.repository';

@Injectable()
export class AccountCommandRepository
  extends BaseRepository
  implements IAccountCommandRepository
{
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  async findIdByCodeMap(clinicId: string): Promise<Record<string, string>> {
    const rows = await this.db.account.findMany({
      where: { clinicId },
      select: { id: true, code: true },
    });
    return Object.fromEntries(rows.map((row) => [row.code, row.id]));
  }

  async update(account: Account): Promise<Account> {
    const data = account.toPersistence();
    const { id, ...update } = data;
    const raw = await this.db.account.update({
      where: { id },
      data: update,
    });
    account.flushEvents();
    return new Account(raw);
  }

  async updateMany(accounts: Account[]): Promise<void> {
    // `update` — `upsert` DEĞİL. Daha önce upsert'ti: "güncelle" adı altında kayıt
    // oluşturabiliyor, silinmiş bir hesabı geri diriltebiliyordu.
    const ops = accounts.map((account) => {
      const data = account.toPersistence();
      const { id, ...update } = data;
      return this.db.account.update({ where: { id }, data: update });
    });

    if (txStorage.getStore()?.tx) {
      await Promise.all(ops);
    } else {
      await this.prisma.$transaction(ops);
    }
    accounts.forEach((account) => account.flushEvents());
  }

  async createChart(accounts: Account[]): Promise<void> {
    // Self-FK ihlalini önlemek için üst hesaplar önce eklenmeli. Sıralama kod
    // DERİNLİĞİNE göre: eski hâli yalnız "kök mü değil mi" ayrımı yapıyordu, yani
    // iki seviyeli şablonda çalışıyor ama üçüncü seviye (120.01.0001 — cari alt
    // defteri) eklendiğinde torun, ebeveyninden önce gelebilip FK'yı ihlal
    // edebilirdi.
    const depth = (account: Account) => account.code.level;
    const ordered = [...accounts].sort((a, b) => depth(a) - depth(b));
    const data = ordered.map((account) => account.toPersistence());

    // `skipDuplicates` yarış koruması: iki eşzamanlı kurulum isteği de kaydı
    // görmeden geçse bile `@@unique([clinicId, code])` ikinci yazımı düşürür.
    await this.db.account.createMany({ data, skipDuplicates: true });

    accounts.forEach((account) => account.flushEvents());
  }
}
