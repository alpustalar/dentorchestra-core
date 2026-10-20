import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { PipelineResponseGroups } from '@modules/crm/pipeline/domain/contracts';
import { PipelineStageTypeType, PipelineStageTypeSchema } from '@input-type-schemas/PipelineStageTypeSchema';

const { MANAGEMENT, ADMIN } = PipelineResponseGroups;

/** Huni aşaması — FE Kanban kolonu. Kolonu çizen her alan tabandadır. */
export class PipelineStageResponseDto {
  @Expose() id: string;
  @Expose() pipelineId: string;
  @Expose() name: string;
  @Expose() order: number;
  @ApiProperty({ enum: PipelineStageTypeSchema.options })
  @Expose() type: PipelineStageTypeType;
  @Expose() color: string | null;
}

/**
 * Satış hunisi + aşamaları. Pano yapılandırması klinik personelinin günlük aracı —
 * tabanda; organizasyon bağı ve denetim damgaları yönetime özel.
 */
export class PipelineResponseDto {
  @Expose() id: string;
  @Expose() clinicId: string;
  @Expose() name: string;
  @Expose() isDefault: boolean;

  @Expose()
  @Type(() => PipelineStageResponseDto)
  stages: PipelineStageResponseDto[];

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  organizationId: string;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @Type(() => Date)
  createdAt: Date;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @Type(() => Date)
  updatedAt: Date;
}
