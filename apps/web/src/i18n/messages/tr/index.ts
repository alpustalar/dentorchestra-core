import common from './common';
import navigation from './navigation';
import auth from './auth';
import notifications from './notifications';
import appointment from './appointment';
import patients from './patients';
import dashboard from './dashboard';
import financeAccounting from './finance-accounting';
import financeBank from './finance-bank';
import financeCashRegister from './finance-cash-register';
import financeLedger from './finance-ledger';
import financeParty from './finance-party';
import financePaymentPos from './finance-payment-pos';
import financeInvoice from './finance-invoice';
import financeEDocument from './finance-e-document';
import financePayroll from './finance-payroll';
import crmMetaAds from './crm-meta-ads';
import identityRoles from './identity-roles';
import connectivity from './connectivity';

export const trMessages = {
  ...common,
  ...navigation,
  ...auth,
  ...notifications,
  ...appointment,
  ...patients,
  ...dashboard,
  ...financeAccounting,
  ...financeBank,
  ...financeCashRegister,
  ...financeLedger,
  ...financeParty,
  ...financePaymentPos,
  ...financeInvoice,
  ...financeEDocument,
  ...financePayroll,
  ...crmMetaAds,
  ...identityRoles,
  ...connectivity,
} as const;
