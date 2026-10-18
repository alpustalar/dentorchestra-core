import common from './common.json';
import navigation from './navigation.json';
import auth from './auth.json';
import notifications from './notifications.json';
import appointment from './appointment.json';
import patients from './patients.json';

export const enMessages = {
  ...common,
  ...navigation,
  ...auth,
  ...notifications,
  ...appointment,
  ...patients,
} as const;
