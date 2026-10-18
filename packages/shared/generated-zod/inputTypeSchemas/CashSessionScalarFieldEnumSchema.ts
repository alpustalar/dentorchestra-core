import { z } from 'zod';

export const CashSessionScalarFieldEnumSchema = z.enum(['id','cashRegisterId','clinicId','organizationId','status','currency','openingFloat','expectedAmount','countedAmount','difference','activeRegisterId','openedById','closedById','openedAt','closedAt','accountingEventId','postedToAccountingAt','note','createdAt','updatedAt']);

export default CashSessionScalarFieldEnumSchema;
