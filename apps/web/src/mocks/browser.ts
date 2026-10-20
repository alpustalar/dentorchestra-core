import { setupWorker } from 'msw/browser';
import * as generatedMocks from '@/api/generated/index.msw';
import { getClinicAppointmentSettingsMocks } from '@/mocks/clinic-appointment-settings';

const handlers = [
  ...getClinicAppointmentSettingsMocks(),
  ...Object.values(generatedMocks).flatMap((getHandlers) => getHandlers()),
];

export const worker = setupWorker(...handlers);

let workerStartPromise: Promise<void> | undefined;

export function startMockWorker(): Promise<void> {
  workerStartPromise ??= worker
    .start({ onUnhandledRequest: 'bypass' })
    .catch((error: unknown) => {
      workerStartPromise = undefined;
      throw error;
    });

  return workerStartPromise;
}
