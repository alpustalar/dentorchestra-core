import { TimeZoneSchema } from '@shared/generated-zod/inputTypeSchemas/TimeZoneSchema';

export const organizationCreateInput = {
  id: crypto.randomUUID(),
  slug: 'test',
  name: 'Genel Yönetim',
  email: 'admin@system.com',
  timezone: TimeZoneSchema.enum.Europe_Istanbul,
  address: 'Sistem Merkezi',
  city: 'Bursa',
} as const;
