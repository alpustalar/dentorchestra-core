import { DomainException } from '@src/domain/exceptions/domain.exception';
import { ERROR_CODES } from '@common/constants/error-codes.constant';
import { HttpStatus } from '@nestjs/common';

/**
 * Aynı kaynak için cari zaten var (unique `clinicId+originType+originId`).
 *
 * `extends Error` idi: eşzamanlı `ensure` çağrısında yeniden okuma da boş
 * dönerse hata ham `Error` olarak dışarı çıkıyor, `errorCode` taşımadığı için
 * 500'e dönüşüyordu — fatura/tahsilat köprüsü sebebi görünmeyen bir hatayla
 * duruyordu.
 */
export class PartyAlreadyExistsException extends DomainException<{
  originType: string;
  originId: string;
}> {
  public readonly errorCode = ERROR_CODES.PARTY.ALREADY_EXISTS;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(originType: string, originId: string) {
    super('Bu kaynak için cari zaten mevcut.', { originType, originId });
  }
}

export class StaffNotFoundException extends DomainException {
  readonly errorCode = ERROR_CODES.PARTY.NOT_FOUND;
  public override readonly httpStatus = HttpStatus.NOT_FOUND;
  constructor() {
    super('Personel bulunamadı');
  }
}

export class PatientNotFoundForPartyException extends DomainException<{
  patientId: string;
}> {
  public readonly errorCode = ERROR_CODES.PARTY.NOT_FOUND;
  public override readonly httpStatus = HttpStatus.NOT_FOUND;

  constructor(patientId: string) {
    super(`Hasta bulunamadı: ${patientId}`, { patientId });
  }
}

/** Cari istenen rolü taşımıyor. */
export class PartyRoleMissingException extends DomainException<{
  role: string;
}> {
  public readonly errorCode = ERROR_CODES.PARTY.ROLE_MISSING;

  constructor(role: string) {
    super(`Cari bu rolü içermiyor: ${role}`, { role });
  }
}
