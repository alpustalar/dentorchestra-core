import { cosmetic } from '@shared/datasets/modules/master-treatments/dental-treatments/cosmetic';
import { MasterTreatmentsCreateManyInputs } from '@shared/datasets';
import { diagnosis } from '@shared/datasets/modules/master-treatments/dental-treatments/diagnosis';
import { orthodontics } from '@shared/datasets/modules/master-treatments/dental-treatments/orthodontics';
import { other } from '@shared/datasets/modules/master-treatments/dental-treatments/other';
import { pedodontics } from '@shared/datasets/modules/master-treatments/dental-treatments/pedodontics';
import { periodontology } from '@shared/datasets/modules/master-treatments/dental-treatments/periodontology';
import { prosthodontics } from '@shared/datasets/modules/master-treatments/dental-treatments/prosthodontics';
import { restorative } from '@shared/datasets/modules/master-treatments/dental-treatments/restorative';
import { surgery } from '@shared/datasets/modules/master-treatments/dental-treatments/surgery';

export const dentalMasterTreatments: MasterTreatmentsCreateManyInputs[] = [
  ...cosmetic,
  ...diagnosis,
  ...orthodontics,
  ...other,
  ...pedodontics,
  ...periodontology,
  ...prosthodontics,
  ...restorative,
  ...surgery,
];
