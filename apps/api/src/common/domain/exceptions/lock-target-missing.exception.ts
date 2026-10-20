import { HttpStatus } from '@nestjs/common';
import { DomainException } from '@src/domain/exceptions/domain.exception';
import { ERROR_CODES } from '../../../../../../packages/shared/common/constants/error-codes.constant';

/**
 * Çapa (anchor) kilidi alınacak satır bulunamadı.
 *
 * `SELECT … FOR UPDATE` var olmayan bir satırda kilitleyecek tuple bulamaz ve
 * **sessizce no-op** kalır. Kilitlenen satırın okunduğu yerlerde bu zararsızdır
 * (okuma `null` döner, çağıran tipli bir NotFound fırlatır); ama satırın yalnız
 * *serileştirme* için kilitlendiği yerlerde — izin bakiyesi için `employees`,
 * kaynak kapasitesi için `employees`/`resources` — akış hatasız devam eder ve
 * eşzamanlılık koruması hiç kurulmamış olur. Bu hata o sessizliği sesli yapar.
 *
 * 422: istek, çözülemeyen bir kayda referans veriyor (kullanıcı `resourceId`
 * uydurmuş olabilir) ya da veri bütünlüğü bozulmuştur — ikisi de işlenemez.
 */
export class LockTargetMissingException extends DomainException {
  public readonly errorCode = ERROR_CODES.COMMON.LOCK_TARGET_MISSING;
  public override readonly httpStatus = HttpStatus.UNPROCESSABLE_ENTITY;

  constructor(table: string, id: string) {
    super(
      `Kilitlenecek kayıt bulunamadı: "${table}" (${id}). ` +
        `İşlem eşzamanlılık koruması olmadan sürdürülemez.`
    );
  }
}
