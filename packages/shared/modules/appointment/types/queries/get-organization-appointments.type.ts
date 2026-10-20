import { z } from 'zod';
import { GetOrganizationAppointmentsSchema } from '../../schemas/queries';

export type GetOrganizationAppointments = z.infer<
  typeof GetOrganizationAppointmentsSchema
>;
