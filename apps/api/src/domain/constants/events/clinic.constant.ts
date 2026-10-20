export const CLINIC_EVENTS = {
  CREATED: 'clinic.created',
  UPDATED: 'clinic.updated',
  MERGED: 'clinic.merged',
  SOFT_DELETED: 'clinic.deleted',
  SOFT_DELETE_REQUESTED: 'clinic.delete_requested',
  MANY_SOFT_DELETED: 'clinic.many_deleted',
  ACTIVATED: 'clinic.activated',
  DEACTIVATED: 'clinic.deactivated',
  REGISTER_SUBMERCHANT: 'clinic.register_submerchant',
  APPOINTMENT_SETTINGS_UPDATED: 'clinic.appointment_settings_updated',
  BUSINESS_TYPE_CHANGED: 'clinic.business_type_changed',
} as const;

export type ClinicEvent = (typeof CLINIC_EVENTS)[keyof typeof CLINIC_EVENTS];
