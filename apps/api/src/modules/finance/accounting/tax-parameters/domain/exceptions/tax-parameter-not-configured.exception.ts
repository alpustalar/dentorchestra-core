import { HttpStatus } from '@nestjs/common';
import { DomainException } from '@src/domain/exceptions';
import { ERROR_CODES } from '@common/constants/error-codes.constant';
import { TaxParameterKeyType as TaxParameterKey } from '@input-type-schemas/TaxParameterKeySchema';

/**
 * Şubede bu vergi parametresi hiç yapılandırılmamış.
 *
 * Eskiden çıplak `Error` idi: 500 dönüyor, `errorCode` taşımıyordu ve arayüz bunu
 * "sunucu hatası"ndan ayırt edemiyordu. Oysa aksiyonu net ve operasyoneldir —
 * kayıt akışında `InitializeTaxParametersCommand` çalışmamış; parametre kurulmalı.
 * Bu hata faturalamayı durdurur, dolayısıyla teşhis edilebilir olması şart.
 */
export class TaxParameterNotConfiguredException extends DomainException<{
  clinicId: string;
  key: TaxParameterKey;
}> {
  public readonly errorCode = ERROR_CODES.TAX_PARAMETER.NOT_CONFIGURED;
  public override readonly httpStatus = HttpStatus.UNPROCESSABLE_ENTITY;

  constructor(clinicId: string, key: TaxParameterKey) {
    super(
      `Vergi parametresi yapılandırılmamış: key=${key}. Şube kayıt akışında vergi parametreleri kurulmamış olabilir.`,
      { clinicId, key }
    );
  }
}
