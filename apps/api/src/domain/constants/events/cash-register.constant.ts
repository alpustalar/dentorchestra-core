export const CASH_REGISTER_EVENTS = {
  ARCHIVED: 'cash-register.archived',
  CLOSED: 'cash-register.closed',
  CREATED: 'cash-register.created',
  OPENED: 'cash-register.opened',
  RECORD: 'cash-register.record',
  MOVEMENT_RECORD: 'cash-movement.record',
  DETAIL: 'cash-register.detail',
} as const;

export type CashRegisterEvent =
  (typeof CASH_REGISTER_EVENTS)[keyof typeof CASH_REGISTER_EVENTS];
