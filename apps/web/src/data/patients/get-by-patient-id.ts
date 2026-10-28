import { patients } from '@/data/patients/patients';
import { Patient } from '@dentorchestra/shared/client';

export async function getPatientById(id: string): Promise<Patient | null> {
  // fetch olacak
  return patients.find((p) => p.id === id) ?? null;
}
