import { Account } from '@modules/finance/accounting/chart-of-accounts/domain/entities/account.entity';

export const ACCOUNT_COMMAND_REPOSITORY = Symbol('IAccountCommandRepository');

export interface IAccountCommandRepository {
  update(account: Account): Promise<Account>;
  updateMany(accounts: Account[]): Promise<void>;

  /**
   * Tenant açılışında hesap planı ağacını tek seferde kurar.
   * Parent FK'sini koruyabilmek için kayıtlar parent-first sırada eklenir.
   */
  createChart(accounts: Account[]): Promise<void>;

  /**
   * Şubede halihazırda duran hesapların `code -> id` eşlemesi.
   *
   * Sadece "kurulmuş mu?" sorusuna evet/hayır demek yetmiyordu: şablona sonradan
   * hesap eklendiğinde mevcut şubeler o hesabı hiç almıyordu (ve posting kuralı
   * kodu arayınca `AccountNotFoundInChartException` veriyordu). Eşleme, eksik
   * hesapların MEVCUT üst hesapların gerçek id'lerine bağlanarak eklenmesini sağlar.
   *
   * Yazmayı beslediği için Command Context'e aittir.
   */
  findIdByCodeMap(clinicId: string): Promise<Record<string, string>>;
}
