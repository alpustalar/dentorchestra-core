import { ResponseGroups } from '../../../../../../../../../packages/shared/common/constants/response-groups.constant';
import { PipelineStageView } from '@modules/crm/pipeline/domain/contracts/pipeline-stage';

// ==========================================
// Read-model'ler (query çıktısı) — plain, entity DEĞİL
// ==========================================

export interface PipelineWithStages {
  id: string;
  organizationId: string;
  clinicId: string;
  name: string;
  isDefault: boolean;
  stages: PipelineStageView[];
  createdAt: Date;
  updatedAt: Date;
}

// ==========================================
// Huni cevaplarının alan görünürlüğü; grupları ClinicPolicy üretir.
// ==========================================

export const PipelineResponseGroups = ResponseGroups;

export type PipelineResponseGroup =
  (typeof PipelineResponseGroups)[keyof typeof PipelineResponseGroups];
