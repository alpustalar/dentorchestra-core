import { ClinicPaymentGateway as IClinicPaymentGateway } from '@shared/generated-zod';
import { AggregateRoot } from '@common/domain/aggregate-root';
import {
  CreateClinicPaymentGatewayProps,
  UpdateClinicPaymentGatewayProps,
} from '@modules/finance/payment-gateway/domain/contracts/clinic-payment-gateway';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';
import { ClinicPaymentGatewayRegisteredEvent } from '@modules/finance/payment-gateway/domain/events';
import { LogAction, LogType } from '@src/domain/constants/log-action.constant';

/**
 * Kliniğin ödeme altyapısı (finance bounded-context). Clinic'ten ayrıştırılmış
 * 1:1 satellite; Iyzico marketplace alt üye işyeri anahtarını barındırır.
 */
export class ClinicPaymentGateway extends AggregateRoot {
  constructor(data: IClinicPaymentGateway) {
    super();
    this._id = UUID.fromTrusted(data.id);
    this._iyzicoSubMerchantKey = data.iyzicoSubMerchantKey;
    this._clinicId = UUID.fromTrusted(data.clinicId);
    this._createdAt = data.createdAt;
    this._updatedAt = data.updatedAt;
  }

  private _id: UUID;
  get id(): UUID {
    return this._id;
  }

  private _iyzicoSubMerchantKey: string;
  get iyzicoSubMerchantKey(): string {
    return this._iyzicoSubMerchantKey;
  }

  private _clinicId: UUID;
  get clinicId(): UUID {
    return this._clinicId;
  }

  private _createdAt: Date;
  get createdAt(): Date {
    return this._createdAt;
  }

  private _updatedAt: Date;
  get updatedAt(): Date {
    return this._updatedAt;
  }

  public static create(
    props: CreateClinicPaymentGatewayProps
  ): ClinicPaymentGateway {
    const now = DateTimeManager.create();

    const gateway = new ClinicPaymentGateway({
      id: UUID.createOrGenerate(props.id).value,
      clinicId: UUID.create(props.clinicId).orThrow().value,
      iyzicoSubMerchantKey: props.iyzicoSubMerchantKey,
      createdAt: now,
      updatedAt: now,
    });

    gateway.raiseRegistered({
      isNew: true,
      maskedIban: props.maskedIban,
      actorId: props.actorId,
      source: props.source,
    });

    return gateway;
  }

  /** Iyzico alt üye işyeri kaydını günceller (yeniden kayıt akışı). */
  public updateSubMerchantKey(props: UpdateClinicPaymentGatewayProps): void {
    this._iyzicoSubMerchantKey = props.iyzicoSubMerchantKey;
    this._updatedAt = DateTimeManager.create();

    this.raiseRegistered({
      isNew: false,
      maskedIban: props.maskedIban,
      actorId: props.actorId,
      source: props.source,
    });
  }

  public toPersistence(): IClinicPaymentGateway {
    return {
      id: this._id.value,
      iyzicoSubMerchantKey: this._iyzicoSubMerchantKey,
      clinicId: this._clinicId.value,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
    };
  }

  private raiseRegistered(props: {
    isNew: boolean;
    maskedIban: string;
    actorId: string;
    source: UpdateClinicPaymentGatewayProps['source'];
  }): void {
    this.addDomainEvent(
      new ClinicPaymentGatewayRegisteredEvent({
        clinicId: this._clinicId.value,
        subMerchantKey: this._iyzicoSubMerchantKey,
        isNew: props.isNew,
        maskedIban: props.maskedIban,
        actorId: props.actorId,
        source: props.source,
        action: LogAction.PAYMENT_GATEWAY_REGISTERED,
        type: LogType.INFO,
        details: props.isNew
          ? 'Klinik ödeme altyapısı (iyzico alt üye işyeri) kuruldu.'
          : 'Klinik ödeme altyapısı (iyzico alt üye işyeri) güncellendi.',
      })
    );
  }
}
