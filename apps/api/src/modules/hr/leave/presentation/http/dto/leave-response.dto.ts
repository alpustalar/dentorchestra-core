import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { EmployeeResponseGroups } from '@modules/hr/employee/domain/contracts/employee.contracts';
import { LeaveTypeType, LeaveTypeSchema } from '@input-type-schemas/LeaveTypeSchema';
import { LeaveStatusType, LeaveStatusSchema } from '@input-type-schemas/LeaveStatusSchema';

const { INTERNAL, MANAGEMENT, ADMIN } = EmployeeResponseGroups;

/** Aynı klinik personeli izin takvimini görebilir (vardiya planlaması). */
const OPS = { groups: [INTERNAL, MANAGEMENT, ADMIN] };

/**
 * İzin talebi. Kimin ne zaman izinli olduğu vardiya planı için klinik içi bilgidir;
 * **izin gerekçesi** (sağlık/mazeret) ile amirin değerlendirme notu kişisel veridir —
 * yalnız yönetim görür.
 */
export class LeaveRequestResponseDto {
  @Expose(OPS) id: string;
  @Expose(OPS) employeeId: string;
  @Expose(OPS) clinicId: string;
  @ApiProperty({ enum: LeaveTypeSchema.options })
  @Expose(OPS) type: LeaveTypeType;
  @ApiProperty({ enum: LeaveStatusSchema.options })
  @Expose(OPS) status: LeaveStatusType;

  @Expose(OPS)
  @Type(() => Date)
  startDate: Date;

  @Expose(OPS)
  @Type(() => Date)
  endDate: Date;

  @Expose(OPS) days: number;

  // --- Kişisel gerekçe ve onay değerlendirmesi (yönetim) ---
  @Expose({ groups: [MANAGEMENT, ADMIN] })
  reason: string | null;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  reviewedById: string | null;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @Type(() => Date)
  reviewedAt: Date | null;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  reviewNote: string | null;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  organizationId: string;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @Type(() => Date)
  createdAt: Date;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @Type(() => Date)
  updatedAt: Date;
}

/** Yıllık izin bakiyesi (LeaveBalance read-model). */
export class LeaveBalanceResponseDto {
  /** Bu yıl doğan hak ediş. */
  @Expose(OPS) accrued: number;
  /** Önceki yıllardan devreden kullanılmamış gün. */
  @Expose(OPS) carriedOver: number;
  /** Toplam kullanılabilir gün (`accrued + carriedOver`). */
  @Expose(OPS) entitlement: number;
  @Expose(OPS) used: number;
  @Expose(OPS) remaining: number;
}
