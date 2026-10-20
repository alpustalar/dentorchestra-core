import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { EmployeeResponseGroups } from '@modules/hr/employee/domain/contracts/employee.contracts';
import { EmploymentTypeType as EmploymentType, EmploymentTypeSchema } from '@input-type-schemas/EmploymentTypeSchema';
import { EmployeeStatusType as EmployeeStatus, EmployeeStatusSchema } from '@input-type-schemas/EmployeeStatusSchema';

const { INTERNAL, MANAGEMENT, FINANCIAL, ADMIN } = EmployeeResponseGroups;

/** Sözleşme (maaş) — yalnızca finansal/yönetim gruplarında görünür. */
export class EmployeeContractResponseDto {
  @Expose() id: string;
  @ApiProperty({ enum: EmploymentTypeSchema.options })
  @Expose() type: EmploymentType;
  @Expose() @Type(() => Date) startDate: Date;
  @Expose() @Type(() => Date) endDate: Date | null;
  @Expose() grossSalary: string;
  @Expose() currency: string;
  @Expose() isActive: boolean;
}

/**
 * Personel cevabı. Temel alanlar aynı klinik personeline açık;
 * hassas kişisel (nationalId, TC kimlik) yönetime, maaş/sözleşme finansal gruba özel.
 * Görünürlük EmployeePolicy.getSerializationOptions ile gelen gruplara göre filtrelenir.
 */
export class EmployeeResponseDto {
  // --- Temel (aynı klinik / INTERNAL) ---
  @Expose() id: string;
  @Expose() organizationId: string;
  @Expose() clinicId: string;
  @Expose() firstName: string;
  @Expose() lastName: string;
  @Expose() email: string | null;
  @Expose() phone: string | null;
  @Expose() title: string | null;
  @Expose() department: string | null;
  @ApiProperty({ enum: EmploymentTypeSchema.options })
  @Expose() employmentType: EmploymentType;
  @ApiProperty({ enum: EmployeeStatusSchema.options })
  @Expose() status: EmployeeStatus;
  @Expose({ groups: [INTERNAL, MANAGEMENT, ADMIN] })
  @Type(() => Date)
  hireDate: Date;

  // --- Hassas kişisel (yönetim) ---
  @Expose({ groups: [MANAGEMENT, ADMIN] }) nationalId: string | null;
  @Expose({ groups: [MANAGEMENT, ADMIN] }) userId: string | null;
  @Expose({ groups: [MANAGEMENT, ADMIN] }) annualLeaveEntitlement: number;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @Type(() => Date)
  terminationDate: Date | null;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @Type(() => Date)
  updatedAt: Date;

  // --- Finansal (maaş/sözleşme) ---
  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] })
  @Type(() => EmployeeContractResponseDto)
  contracts?: EmployeeContractResponseDto[];
}
