import { z } from 'zod';

export const ProviderSettlementScalarFieldEnumSchema = z.enum(['id','organizationId','clinicId','provider','reference','payoutDate','grossAmount','commissionAmount','netAmount','currency','bankAccountId','note','accountingEventId','postedToAccountingAt','recordedById','createdAt','updatedAt']);

export default ProviderSettlementScalarFieldEnumSchema;
