import { patients } from '@/data/patients/patients';
import { Patient } from '@core-crm/shared/client';

export async function getPatientById(id: string): Promise<Patient | null> {
  // fetch olacak
  return patients.find((p) => p.id === id) ?? null;
}
