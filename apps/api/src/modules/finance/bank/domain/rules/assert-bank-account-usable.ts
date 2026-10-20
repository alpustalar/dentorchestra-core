import { BankAccountStatusSchema } from '@input-type-schemas/BankAccountStatusSchema';
import { IBankAccountCommandRepository } from '@modules/finance/bank/domain/repositories/bank-account/bank-account.command.repository';
import {
  BankAccountArchivedException,
  BankAccountNotFoundException,
} from '@modules/finance/bank/domain/exceptions/bank.exceptions';

export interface AssertBankAccountUsableParams {
  bankAccountRepo: IBankAccountCommandRepository;
  /** Banka hesabı opsiyoneldir; verilmediyse kontrol yapılmaz. */
  bankAccountId: string | null | undefined;
  clinicId: string;
  /**
   * Hesap başka bir kliniğe aitse fırlatılacak, bağlama özgü hata. Kiracı sınırı
   * ihlalinin hata kodu çağıran akışa göre değişir (hesap kapaması, kart itirazı).
   */
  onClinicMismatch: (bankAccountId: string) => Error;
}

/**
 * Banka hesabı opsiyoneldir ama verildiyse **aynı kliniğin** ve **kullanımda**
 * olmak zorundadır: başka kiracının hesabı seçilirse kayıt o hesabın mutabakatına
 * karışır; arşivlenmiş hesaba yeni hareket bağlanamaz.
 *
 * Hesap kapaması ve kart itirazı aynı kuralı paylaşır — kopyalanırsa biri
 * düzeltildiğinde diğeri kiracı sınırını açık bırakır.
 */
export async function assertBankAccountUsableByClinic(
  params: AssertBankAccountUsableParams
): Promise<void> {
  if (!params.bankAccountId) return;

  const account = await params.bankAccountRepo.findById(params.bankAccountId);
  if (!account) {
    throw new BankAccountNotFoundException(params.bankAccountId);
  }

  if (account.clinicId.value !== params.clinicId) {
    throw params.onClinicMismatch(params.bankAccountId);
  }

  if (account.status === BankAccountStatusSchema.enum.ARCHIVED) {
    throw new BankAccountArchivedException(account.id.value);
  }
}
