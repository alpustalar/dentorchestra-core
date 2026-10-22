import type { Organization } from '@shared/generated-zod';

export const organizations = [
  {
    id: 'org_as_yazilim',
    name: 'AS Yazılım',
    slug: 'as-yazilim',
  },
] satisfies Array<Pick<Organization, 'id' | 'name' | 'slug'>>;
