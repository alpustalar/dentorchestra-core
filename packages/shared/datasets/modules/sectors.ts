import { slugIt } from '@shared/common/utils/slug-it';

export const sectorSlugs = {
  DENTAL: slugIt('DENTAL'),
  ALL: slugIt('ALL'),
  HAIR_TRANSPLANT: slugIt('HAIR_TRANSPLANT'),
} as const;

export type SectorSlug = (typeof sectorSlugs)[keyof typeof sectorSlugs];

export const sectorCreateInputs = [
  {
    id: crypto.randomUUID(),
    name: 'DENTAL',
    slug: sectorSlugs['DENTAL'],
  },
];
