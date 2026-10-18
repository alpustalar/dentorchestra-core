import { defineEndpoint } from '@shared/common/contracts/endpoint';
import type { Appointment } from '@shared/generated-zod/modelSchema/AppointmentSchema';
import {
  CancelAppointmentSchema,
  GetClinicAppointmentsSchema,
  GetClinicCalendarSchema,
  GetClinicDailySummarySchema,
  GetWaitingRoomSchema,
  ScheduleAppointmentSchema,
  StaffRescheduleSchema,
  UpdateAppointmentDetailsSchema,
} from '@shared/modules';
import type {
  ClinicCalendarDay,
  ClinicDailySummary,
  WaitingRoomEntry,
} from '../interfaces';

/**
 * `apps/api` → `AppointmentCommandController` + `AppointmentQueryController`.
 * Modül `app.routes.ts`'te `appointments` altına bağlı; controller kökleri boş
 * olduğu için yollar burada tam yazılıdır.
 *
 * Durum geçişleri (confirm/complete/no-show/check-in) gövdesizdir: hangi geçişin
 * yapılacağı yolun kendisindedir, `PATCH /:id/confirm` gibi. Hepsi CLAUDE.md
 * kuralı gereği `void` döner — bu yüzden mutation sonrası cache invalidate
 * edilmek zorundadır, cevaptan beslenemez.
 */
export const appointmentEndpoints = {
  list: defineEndpoint<Appointment[]>()({
    method: 'GET',
    path: '/appointments',
    query: GetClinicAppointmentsSchema,
  }),

  calendar: defineEndpoint<ClinicCalendarDay[]>()({
    method: 'GET',
    path: '/appointments/calendar',
    query: GetClinicCalendarSchema,
  }),

  dailySummary: defineEndpoint<ClinicDailySummary>()({
    method: 'GET',
    path: '/appointments/daily-summary',
    query: GetClinicDailySummarySchema,
  }),

  waitingRoom: defineEndpoint<WaitingRoomEntry[]>()({
    method: 'GET',
    path: '/appointments/waiting-room',
    query: GetWaitingRoomSchema,
  }),

  byId: defineEndpoint<Appointment>()({
    method: 'GET',
    path: (p: { appointmentId: string }) => `/appointments/${p.appointmentId}`,
  }),

  schedule: defineEndpoint<string>()({
    method: 'POST',
    path: '/appointments/schedule',
    body: ScheduleAppointmentSchema,
  }),

  updateDetails: defineEndpoint<void>()({
    method: 'PATCH',
    path: (p: { appointmentId: string }) =>
      `/appointments/${p.appointmentId}/details`,
    body: UpdateAppointmentDetailsSchema,
  }),

  reschedule: defineEndpoint<void>()({
    method: 'PATCH',
    path: (p: { appointmentId: string }) =>
      `/appointments/${p.appointmentId}/reschedule`,
    body: StaffRescheduleSchema,
  }),

  cancel: defineEndpoint<void>()({
    method: 'PATCH',
    path: (p: { appointmentId: string }) =>
      `/appointments/${p.appointmentId}/cancel`,
    body: CancelAppointmentSchema,
  }),

  confirm: defineEndpoint<void>()({
    method: 'PATCH',
    path: (p: { appointmentId: string }) =>
      `/appointments/${p.appointmentId}/confirm`,
  }),

  complete: defineEndpoint<void>()({
    method: 'PATCH',
    path: (p: { appointmentId: string }) =>
      `/appointments/${p.appointmentId}/complete`,
  }),

  noShow: defineEndpoint<void>()({
    method: 'PATCH',
    path: (p: { appointmentId: string }) =>
      `/appointments/${p.appointmentId}/no-show`,
  }),

  checkIn: defineEndpoint<void>()({
    method: 'PATCH',
    path: (p: { appointmentId: string }) =>
      `/appointments/${p.appointmentId}/check-in`,
  }),
} as const;
