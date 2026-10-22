import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

import { TimeZone } from '@src/domain/value-objects/timezone.vo';
import {
  AppointmentStatusSchema,
  AppointmentStatusType,
} from '@input-type-schemas/AppointmentStatusSchema';
import {
  AppointmentSourceSchema,
  AppointmentSourceType,
} from '@input-type-schemas/AppointmentSourceSchema';
import {
  VisitTypeSchema,
  VisitTypeType,
} from '@input-type-schemas/VisitTypeSchema';
import {
  ExaminationTypeSchema,
  ExaminationTypeType as ExaminationType,
} from '@input-type-schemas/ExaminationTypeSchema';
import {
  AppointmentCreatorTypeSchema,
  AppointmentCreatorTypeType as AppointmentCreatorType,
} from '@input-type-schemas/AppointmentCreatorTypeSchema';
import { AppointmentsResponseGroups } from '@shared/modules/appointment/constants';

const { PROVIDER_DATA_OWNER, PATIENT_DATA_OWNER, INTERNAL, ADMIN, MANAGEMENT } =
  AppointmentsResponseGroups;

const PATIENT_SHARED = {
  groups: [
    INTERNAL,
    PROVIDER_DATA_OWNER,
    PATIENT_DATA_OWNER,
    ADMIN,
    MANAGEMENT,
  ],
};

const INTERNAL_ONLY = {
  groups: [INTERNAL, PROVIDER_DATA_OWNER, ADMIN, MANAGEMENT],
};

export class AppointmentRelationalDto {
  @Expose() id: string;
}

export class AppointmentResponseDto {
  // --------------------
  // Core & Identification (Herkes Görebilir)
  // --------------------
  @Expose()
  id: string;

  @Expose()
  startTime: Date;

  @Expose()
  endTime: Date;

  @Expose()
  @ApiProperty({ enum: AppointmentStatusSchema.options })
  status: AppointmentStatusType;

  @Expose()
  timezone: TimeZone;

  @Expose()
  isConsultation: boolean;

  // --------------------
  // Patient Info (Hasta, Hekim ve Klinik Personeli Görebilir)
  // --------------------
  @Expose(PATIENT_SHARED)
  patientName: string;

  @Expose(PATIENT_SHARED)
  patientPhone: string;

  @Expose(PATIENT_SHARED)
  patientEmail?: string;

  // --------------------
  // Operational Details (Klinik İçi, Hekim ve Yönetim)
  // --------------------
  @Expose(INTERNAL_ONLY)
  @ApiProperty({ enum: AppointmentSourceSchema.options })
  source: AppointmentSourceType;

  @Expose(INTERNAL_ONLY)
  treatmentType?: string;

  @Expose(INTERNAL_ONLY)
  @ApiProperty({ enum: ExaminationTypeSchema.options })
  examinationType?: ExaminationType;

  @Expose(INTERNAL_ONLY)
  @ApiProperty({ enum: VisitTypeSchema.options })
  visitType?: VisitTypeType;

  @Expose(INTERNAL_ONLY)
  notes?: string;

  // --------------------
  // Audit & Creation Logs (Sadece Personel ve Yönetim)
  // --------------------
  @Expose(INTERNAL_ONLY)
  @ApiProperty({ enum: AppointmentCreatorTypeSchema.options })
  creatorType: AppointmentCreatorType;

  @Expose(INTERNAL_ONLY)
  createdById?: string;

  @Expose(INTERNAL_ONLY)
  createdByRealName?: string;

  @Expose(INTERNAL_ONLY)
  approvedAt?: Date;

  @Expose({ groups: [ADMIN] })
  approvedBy?: string;

  @Expose(INTERNAL_ONLY)
  checkedInAt?: Date;

  @Expose(INTERNAL_ONLY)
  reminderSentAt?: Date;

  // --------------------
  // Cancellation Logs (Sadece Klinik İçi ve Yönetim)
  // --------------------
  @Expose(INTERNAL_ONLY)
  canceledAt?: Date;

  @Expose(INTERNAL_ONLY)
  canceledBy?: string;

  @Expose(INTERNAL_ONLY)
  cancelReason?: string;

  // --------------------
  // System Timestamps
  // --------------------
  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;

  // --------------------
  // Relational IDs
  // --------------------
  @Expose() clinicId: string;
  @Expose() providerId: string;
  @Expose() patientId: string;

  @Expose(INTERNAL_ONLY) treatmentId?: string;
  @Expose(INTERNAL_ONLY) resourceId?: string;
  @Expose({ groups: [INTERNAL, ADMIN] }) externalId?: string;
  @Expose({ groups: [INTERNAL, ADMIN] }) externalSystem?: string;

  // --------------------
  // Relational Object Hydrations (İlişkili Sınıflar)
  // --------------------
  @Expose()
  @Type(() => AppointmentRelationalDto)
  clinic: AppointmentRelationalDto;

  @Expose()
  @Type(() => AppointmentRelationalDto)
  provider: AppointmentRelationalDto;

  @Expose(INTERNAL_ONLY)
  @Type(() => AppointmentRelationalDto)
  patient: AppointmentRelationalDto;

  @Expose(INTERNAL_ONLY)
  @Type(() => AppointmentRelationalDto)
  treatment?: AppointmentRelationalDto;

  @Expose(INTERNAL_ONLY)
  @Type(() => AppointmentRelationalDto)
  resource?: AppointmentRelationalDto;

  @Expose(INTERNAL_ONLY)
  @Type(() => AppointmentRelationalDto)
  payment?: AppointmentRelationalDto[];

  @Expose(INTERNAL_ONLY)
  @Type(() => AppointmentRelationalDto)
  invoice?: AppointmentRelationalDto[];

  @Expose(INTERNAL_ONLY)
  @Type(() => AppointmentRelationalDto)
  posTransactions?: AppointmentRelationalDto[];
}
