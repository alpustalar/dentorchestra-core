import { ClinicGovernmentSpecs as IClinicGovernmentSpecs } from '@shared/generated-zod';
import {
  ClinicLegalTypeSchema,
  ClinicLegalTypeType as ClinicLegalType,
} from '@input-type-schemas/ClinicLegalTypeSchema';
import { AggregateRoot } from '@common/domain/aggregate-root';
import { Vkn } from '@src/domain/value-objects/vkn.vo';
import {
  CreateClinicGovernmentSpecsProps,
  UpdateClinicGovernmentSpecsProps,
} from '@modules/organization/clinic-governance/domain/contracts/clinic-government-specs';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';

/**
 * Kliniğin devlet/regülasyon kimliği (platform/governance bounded-context).
 * Clinic'ten ayrıştırılmış 1:1 satellite; SKRS tesis kodu, USS (e nabız için) şifresi ve
 * kliniğin kendi vergi numarasını (fatura için) barındırır.
 */
export class ClinicGovernmentSpecs extends AggregateRoot {
  constructor(data: IClinicGovernmentSpecs) {
    super();

    this._id = data.id;
    this._healthFacilityCode = data.healthFacilityCode;
    this._ussPassword = data.ussPassword;
    this._companyTaxNumber = data.companyTaxNumber
      ? Vkn.create(data?.companyTaxNumber).orThrow()
      : null;
    this._legalType = data.legalType;
    this._clinicId = data.clinicId;
    this._createdAt = data.createdAt;
    this._updatedAt = data.updatedAt;
  }

  private _id: string;
  get id(): string {
    return this._id;
  }

  private _healthFacilityCode: string;
  get healthFacilityCode(): string {
    return this._healthFacilityCode;
  }

  private _ussPassword: string | null;
  get ussPassword(): string | null {
    return this._ussPassword;
  }

  private _companyTaxNumber: Vkn | null;
  get companyTaxNumber(): Vkn | null {
    return this._companyTaxNumber;
  }

  private _legalType: ClinicLegalType;
  get legalType(): ClinicLegalType {
    return this._legalType;
  }

  private _clinicId: string;
  get clinicId(): string {
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
    props: CreateClinicGovernmentSpecsProps
  ): ClinicGovernmentSpecs {
    const now = DateTimeManager.create();
    return new ClinicGovernmentSpecs({
      id: UUID.createOrGenerate(props.id).value,
      clinicId: props.clinicId,
      healthFacilityCode: props.healthFacilityCode,
      ussPassword: props.ussPassword ?? null,
      companyTaxNumber: props.companyTaxNumber ?? null,
      legalType: props.legalType ?? ClinicLegalTypeSchema.enum.KURUM,
      createdAt: now,
      updatedAt: now,
    });
  }

  public update(props: UpdateClinicGovernmentSpecsProps): void {
    if (props.healthFacilityCode !== undefined) {
      this._healthFacilityCode = props.healthFacilityCode;
    }
    if (props.ussPassword !== undefined) this._ussPassword = props.ussPassword;
    if (props.companyTaxNumber !== undefined) {
      this._companyTaxNumber = props.companyTaxNumber
        ? Vkn.create(props.companyTaxNumber).orThrow()
        : null;
    }
    if (props.legalType !== undefined) this._legalType = props.legalType;
  }

  public toPersistence(): IClinicGovernmentSpecs {
    return {
      id: this.id,
      healthFacilityCode: this.healthFacilityCode,
      ussPassword: this.ussPassword,
      companyTaxNumber: this.companyTaxNumber
        ? this.companyTaxNumber.value
        : null,
      legalType: this.legalType,
      clinicId: this.clinicId,
      createdAt: this.createdAt,
      updatedAt: DateTimeManager.create(),
    };
  }
}
