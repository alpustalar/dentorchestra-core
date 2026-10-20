import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { EmployeeResponseGroups } from '@modules/hr/employee/domain/contracts/employee.contracts';
import { AttendanceStatusType, AttendanceStatusSchema } from '@input-type-schemas/AttendanceStatusSchema';

const { INTERNAL, MANAGEMENT, ADMIN } = EmployeeResponseGroups;

/** Aynı klinik personeli mesai kaydını görebilir. */
const OPS = { groups: [INTERNAL, MANAGEMENT, ADMIN] };

/**
 * Puantaj kaydı. Giriş/çıkış ve çalışılan süre aynı klinik personeline açıktır;
 * fazla mesai ve amir notu bordroyu besleyen değerlendirme verisi olduğu için
 * yönetime kapalıdır.
 */
export class AttendanceRecordResponseDto {
  @Expose(OPS) id: string;
  @Expose(OPS) employeeId: string;
  @Expose(OPS) clinicId: string;

  @Expose(OPS)
  @Type(() => Date)
  workDate: Date;

  @Expose(OPS)
  @Type(() => Date)
  checkInAt: Date;

  @Expose(OPS)
  @Type(() => Date)
  checkOutAt: Date | null;

  @Expose(OPS) workedMinutes: number | null;
  @ApiProperty({ enum: AttendanceStatusSchema.options })
  @Expose(OPS) status: AttendanceStatusType;

  // --- Bordroyu besleyen değerlendirme (yönetim) ---
  @Expose({ groups: [MANAGEMENT, ADMIN] })
  overtimeMinutes: number;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  note: string | null;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  organizationId: string;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @Type(() => Date)
  createdAt: Date;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @Type(() => Date)
  updatedAt: Date;
}

/** Dönem puantaj özeti. Fazla mesai toplamı yönetim verisidir. */
export class AttendanceSummaryResponseDto {
  @Expose(OPS) daysRecorded: number;
  @Expose(OPS) totalWorkedMinutes: number;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  totalOvertimeMinutes: number;
}
