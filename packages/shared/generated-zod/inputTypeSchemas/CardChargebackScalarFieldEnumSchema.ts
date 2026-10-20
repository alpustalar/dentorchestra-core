import { z } from 'zod';

export const CardChargebackScalarFieldEnumSchema = z.enum(['id','organizationId','clinicId','provider','caseReference','sourceType','sourceId','paymentId','installmentId','patientId','partyId','amount','feeAmount','currency','status','openedAt','openedFundsChannel','openedBankAccountId','evidenceDueAt','note','resolvedAt','resolvedFundsChannel','resolvedBankAccountId','resolutionNote','openedEventId','resolvedEventId','planSyncStatus','recoveryInstallmentId','recordedById','resolvedById','createdAt','updatedAt']);

export default CardChargebackScalarFieldEnumSchema;
