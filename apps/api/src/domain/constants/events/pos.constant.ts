export const POS_EVENTS = {
  TRANSACTION_INITIATED: 'pos.transaction.initiated',
  TRANSACTION_SUCCESS: 'pos.transaction.success',
  TRANSACTION_FAILED: 'pos.transaction.failed',
  TRANSACTION_CANCELLED: 'pos.transaction.cancelled',
  TRANSACTION_TIMEOUT: 'pos.transaction.timeout',
  TRANSACTION_REVERSED: 'pos.transaction.reversed',
} as const;

export type PosEvent = (typeof POS_EVENTS)[keyof typeof POS_EVENTS];
