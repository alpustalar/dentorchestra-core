import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { ProjectResponseGroups } from '@modules/organization/project/domain/contracts';
import { ProjectStatusType, ProjectStatusSchema } from '@input-type-schemas/ProjectStatusSchema';
import { ProjectPhaseStatusType, ProjectPhaseStatusSchema } from '@input-type-schemas/ProjectPhaseStatusSchema';
import { ProjectTaskStatusType, ProjectTaskStatusSchema } from '@input-type-schemas/ProjectTaskStatusSchema';
import { ProjectTaskPriorityType, ProjectTaskPrioritySchema } from '@input-type-schemas/ProjectTaskPrioritySchema';
import { ProjectResourceKindType, ProjectResourceKindSchema } from '@input-type-schemas/ProjectResourceKindSchema';

const { INTERNAL, FINANCIAL, MANAGEMENT, ADMIN } = ProjectResponseGroups;

/** Projede çalışan klinik personeli panoyu ve planı görebilir. */
const OPS = { groups: [INTERNAL, FINANCIAL, MANAGEMENT, ADMIN] };
/** Bütçe/maliyet — yalnız finans ve yönetim. */
const FIN = { groups: [FINANCIAL, MANAGEMENT, ADMIN] };

/**
 * Proje. Ad/durum/takvim projede çalışan herkese açıktır; **bütçe** finansal
 * veridir ve görev yapan personele gösterilmez.
 */
export class ProjectResponseDto {
  @Expose(OPS) id: string;
  @Expose(OPS) clinicId: string;
  @Expose(OPS) code: string | null;
  @Expose(OPS) name: string;
  @Expose(OPS) description: string | null;
  @ApiProperty({ enum: ProjectStatusSchema.options })
  @Expose(OPS) status: ProjectStatusType;
  @Expose(OPS) ownerId: string;

  @Expose(OPS)
  @Type(() => Date)
  startDate: Date | null;

  @Expose(OPS)
  @Type(() => Date)
  dueDate: Date | null;

  @Expose(OPS)
  @Type(() => Date)
  completedAt: Date | null;

  @Expose(OPS)
  @Type(() => Date)
  cancelledAt: Date | null;

  @Expose(OPS) cancelReason: string | null;

  // --- Bütçe (finans/yönetim) ---
  @Expose(FIN)
  @Type(() => String)
  budget: string | null;

  @Expose(FIN) currency: string;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  organizationId: string;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  createdById: string;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @Type(() => Date)
  createdAt: Date;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @Type(() => Date)
  updatedAt: Date;
}

/** Proje aşaması. Aşama bütçesi finans tier'ında. */
export class ProjectPhaseResponseDto {
  @Expose(OPS) id: string;
  @Expose(OPS) projectId: string;
  @Expose(OPS) clinicId: string;
  @Expose(OPS) name: string;
  @Expose(OPS) order: number;
  @ApiProperty({ enum: ProjectPhaseStatusSchema.options })
  @Expose(OPS) status: ProjectPhaseStatusType;

  @Expose(OPS)
  @Type(() => Date)
  startDate: Date | null;

  @Expose(OPS)
  @Type(() => Date)
  dueDate: Date | null;

  @Expose(OPS)
  @Type(() => Date)
  completedAt: Date | null;

  @Expose(FIN)
  @Type(() => String)
  budget: string | null;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @Type(() => Date)
  createdAt: Date;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @Type(() => Date)
  updatedAt: Date;
}

/** Kanban görevi. Efor tahminleri performans değerlendirmesine girdiği için yönetimde. */
export class ProjectTaskResponseDto {
  @Expose(OPS) id: string;
  @Expose(OPS) projectId: string;
  @Expose(OPS) phaseId: string | null;
  @Expose(OPS) clinicId: string;
  @Expose(OPS) parentTaskId: string | null;
  @Expose(OPS) title: string;
  @Expose(OPS) description: string | null;
  @ApiProperty({ enum: ProjectTaskStatusSchema.options })
  @Expose(OPS) status: ProjectTaskStatusType;
  @ApiProperty({ enum: ProjectTaskPrioritySchema.options })
  @Expose(OPS) priority: ProjectTaskPriorityType;
  @Expose(OPS) assigneeId: string | null;
  @Expose(OPS) boardOrder: number;

  @Expose(OPS)
  @Type(() => Date)
  startDate: Date | null;

  @Expose(OPS)
  @Type(() => Date)
  dueAt: Date | null;

  @Expose(OPS)
  @Type(() => Date)
  completedAt: Date | null;

  // --- Efor ölçümü (yönetim) ---
  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @Type(() => String)
  estimatedHours: string | null;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @Type(() => String)
  actualHours: string | null;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  organizationId: string;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  createdById: string;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @Type(() => Date)
  createdAt: Date;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @Type(() => Date)
  updatedAt: Date;
}

/** Durum bazlı görev sayacı (pano başlıkları). */
export class ProjectTaskStatusCountResponseDto {
  @ApiProperty({ enum: ProjectTaskStatusSchema.options })
  @Expose(OPS) status: ProjectTaskStatusType;
  @Expose(OPS) count: number;
}

/** Proje detayı — proje + aşamalar + görev sayaçları. */
export class ProjectDetailResponseDto {
  @Expose(OPS)
  @Type(() => ProjectResponseDto)
  project: ProjectResponseDto;

  @Expose(OPS)
  @Type(() => ProjectPhaseResponseDto)
  phases: ProjectPhaseResponseDto[];

  @Expose(OPS)
  @Type(() => ProjectTaskStatusCountResponseDto)
  taskCounts: ProjectTaskStatusCountResponseDto[];
}

/** Kaynak tahsis satırı (personel/oda/cihaz takvimi). */
export class ResourceScheduleRowResponseDto {
  @Expose(OPS) allocationId: string;
  @Expose(OPS) projectId: string;
  @Expose(OPS) projectName: string;
  @Expose(OPS) phaseId: string | null;
  @ApiProperty({ enum: ProjectResourceKindSchema.options })
  @Expose(OPS) kind: ProjectResourceKindType;
  @Expose(OPS) resourceId: string;

  @Expose(OPS)
  @Type(() => Date)
  startDate: Date;

  @Expose(OPS)
  @Type(() => Date)
  endDate: Date;

  @Expose(OPS) allocationPercent: number;
  @Expose(OPS) note: string | null;
}

// ───────────────── BÜTÇE / FİİLİ (tamamen finansal) ──────────────────

export class PhaseBudgetLineResponseDto {
  @Expose(FIN) phaseId: string;
  @Expose(FIN) phaseName: string;
  @Expose(FIN) budget: string | null;
  @Expose(FIN) actual: string;
  @Expose(FIN) variance: string | null;
}

export class CostSourceLineResponseDto {
  @Expose(FIN) source: string;
  @Expose(FIN) amount: string;
}

export class ProjectBudgetVsActualResponseDto {
  @Expose(FIN) projectId: string;
  @Expose(FIN) currency: string;
  @Expose(FIN) budget: string | null;
  @Expose(FIN) actual: string;
  @Expose(FIN) variance: string | null;
  @Expose(FIN) utilizationPercent: number | null;
  @Expose(FIN) isOverBudget: boolean;

  @Expose(FIN)
  @Type(() => PhaseBudgetLineResponseDto)
  phases: PhaseBudgetLineResponseDto[];

  @Expose(FIN) unassigned: string;

  @Expose(FIN)
  @Type(() => CostSourceLineResponseDto)
  bySource: CostSourceLineResponseDto[];
}
