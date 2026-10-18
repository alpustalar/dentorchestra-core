import { Expose, Type } from 'class-transformer';
import { ResponseGroups } from '@common/constants/response-groups.constant';
import { GenderType as Gender } from '@input-type-schemas/GenderSchema';
import { BloodTypeType as BloodType } from '@input-type-schemas/BloodTypeSchema';
import { PatientStatusType as PatientStatus } from '@input-type-schemas/PatientStatusSchema';
import { PatientTypeType as PatientType } from '@input-type-schemas/PatientTypeSchema';

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
  @Expose() status: PatientStatus;
  @Expose() patientType: PatientType | null;
  @Expose() profilePhoto: string | null;

  // --- Hassas Kişisel Veriler (Hastanın Kendisi, İç Operasyon, Yönetici ve Admin) ---
  @Expose({ groups: [DATA_OWNER, INTERNAL, MANAGEMENT, ADMIN] })
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
