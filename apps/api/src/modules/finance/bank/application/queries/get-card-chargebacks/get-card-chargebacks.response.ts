import { QueryResponse } from '@shared/common/response/response.interface';
import { CardChargeback as ICardChargeback } from '@model-schema/CardChargebackSchema';

export type GetCardChargebacksResponse = QueryResponse<ICardChargeback[]>;
