import { QueryResponse } from '@shared/common/response/response.interface';
import type { YearEndClosingPreview } from '@shared/modules/accounting-period/interfaces';

export type GetYearEndClosingPreviewResponse =
  QueryResponse<YearEndClosingPreview>;
