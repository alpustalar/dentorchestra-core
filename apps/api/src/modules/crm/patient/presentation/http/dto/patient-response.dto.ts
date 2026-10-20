import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { ResponseGroups } from '../../../../../../../../../packages/shared/common/constants/response-groups.constant';
import { GenderType as Gender, GenderSchema } from '@input-type-schemas/GenderSchema';
import { BloodTypeType as BloodType, BloodTypeSchema } from '@input-type-schemas/BloodTypeSchema';
import { PatientStatusType as PatientStatus, PatientStatusSchema } from '@input-type-schemas/PatientStatusSchema';
import { PatientTypeType as PatientType, PatientTypeSchema } from '@input-type-schemas/PatientTypeSchema';

const { INTERNAL, MANAGEMENT, DATA_OWNER, ADMIN } = ResponseGroups;

export class PatientResponseDto {
  @Expose() id: string;
  @Expose() organizationId: string;
  @Expose() clinicId: string | null;
  @Expose() sectorId: string | null;

  // --- Temel Kimlik Künyesi (Dışarıya ve Herkese Açık) ---
  @Expose() firstName: string;
  @Expose() lastName: string | null;
  @Expose() protocolNo: string | null;
  @ApiProperty({ enum: PatientStatusSchema.options })
  @Expose() status: PatientStatus;
  @ApiProperty({ enum: PatientTypeSchema.options, nullable: true })
  @Expose() patientType: PatientType | null;
  @Expose() profilePhoto: string | null;

  // --- Hassas Kişisel Veriler (Hastanın Kendisi, İç Operasyon, Yönetici ve Admin) ---
  @Expose({ groups: [DATA_OWNER, INTERNAL, MANAGEMENT, ADMIN] })
  @ApiProperty({ enum: GenderSchema.options, nullable: true })
  gender: Gender | null;

  @Expose({ groups: [DATA_OWNER, INTERNAL, MANAGEMENT, ADMIN] })
  @Type(() => Date)
  birthDate: Date | null;

  @Expose({ groups: [DATA_OWNER, INTERNAL, MANAGEMENT, ADMIN] })
  phone: string | null;

  @Expose({ groups: [DATA_OWNER, INTERNAL, MANAGEMENT, ADMIN] })
  alternativePhone: string | null;

  @Expose({ groups: [DATA_OWNER, INTERNAL, MANAGEMENT, ADMIN] })
  email: string | null;

  @Expose({ groups: [DATA_OWNER, INTERNAL, MANAGEMENT, ADMIN] })
  address: string | null;

  // --- Refakatçi ve Acil Durum Verileri (İç Operasyon, Yönetim ve Admin) ---
  @Expose({ groups: [INTERNAL, MANAGEMENT, ADMIN] })
  emergencyContact: string | null;

  @Expose({ groups: [INTERNAL, MANAGEMENT, ADMIN] })
  companionName: string | null;

  @Expose({ groups: [INTERNAL, MANAGEMENT, ADMIN] })
  companionPhone: string | null;

  @Expose({ groups: [INTERNAL, MANAGEMENT, ADMIN] })
  responsibleProviderId: string | null;

  @Expose({ groups: [INTERNAL, MANAGEMENT, ADMIN] })
  @Type(() => Date)
  checkupDate: Date | null;

  // --- Ulusal Kimlik Zırhı (Sadece Hastanın Kendisi, Üst Yönetim ve Admin - KVKK) ---
  @Expose({ groups: [DATA_OWNER, MANAGEMENT, ADMIN] })
  tcNo: string | null;

  // --- Tıbbi Mahremiyet Bilgileri (Sadece Hastanın Kendisi, Klinik İç Personeli ve Admin) ---
  @Expose({ groups: [DATA_OWNER, INTERNAL, ADMIN] })
  allergies: string | null;

  @Expose({ groups: [DATA_OWNER, INTERNAL, ADMIN] })
  chronicDiseases: string | null;

  @Expose({ groups: [DATA_OWNER, INTERNAL, ADMIN] })
  @ApiProperty({ enum: BloodTypeSchema.options, nullable: true })
  bloodType: BloodType | null;

  // NOT: Hastaya bağlı kalıcı `discountRate` kaldırıldı. İndirim işlem bazında
  // TreatmentCharge satırında yaşıyor; hasta detayında gösterilecek bir "indirim
  // hakkı" yok.

  // --- Sistem ve Kimlik Doğrulama Bağlantıları (Sadece Yönetim ve Admin) ---
  @Expose({ groups: [MANAGEMENT, ADMIN] })
  firebaseUid: string | null;

  // --- Audit Zaman Damgaları ---
  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @Type(() => Date)
  createdAt: Date;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @Type(() => Date)
  updatedAt: Date;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @Type(() => Date)
  deletedAt: Date | null;
}
