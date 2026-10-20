import { Inject, Injectable, Logger } from '@nestjs/common';
import { TSQueryBus } from '@common/cqrs/type-safe-query-bus';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';
import { ExecutionContextFactory } from '@src/domain/common/execution/execution-context.factory';
import {
  NotificationTypeSchema,
  NotificationTypeType,
} from '@input-type-schemas/NotificationTypeSchema';
import {
  NotificationPrioritySchema,
  NotificationPriorityType,
} from '@input-type-schemas/NotificationPrioritySchema';
import { NotificationDeliveryStatusSchema } from '@input-type-schemas/NotificationDeliveryStatusSchema';
import { FindClinicStaffUserIdsQuery } from '@modules/identity/user/application/queries/find-clinic-staff-user-ids/find-clinic-staff-user-ids.query';
import { StaffNotification } from '@modules/platform/notification/domain/entities/staff-notification.entity';
import {
  IStaffNotificationCommandRepository,
  STAFF_NOTIFICATION_COMMAND_REPOSITORY,
} from '@modules/platform/notification/domain/repositories/staff-notification.repository';
import {
  PATIENT_NOTIFICATION_PORT,
  PatientNotificationPort,
} from '@modules/platform/notification/domain/ports/patient-notification.port';
import { NotificationRealtimeBridge } from '@modules/platform/notification/infrastructure/realtime/notification-realtime.bridge';
import { GetPatientByIdQuery } from '@modules/crm/patient/application/queries/get-patient-by-id/get-patient-by-id.query';

// Bu saatten az kala yapılan iptal "son dakika" sayılır → CRITICAL (toast).
const LATE_CANCEL_THRESHOLD_HOURS = 24;

export interface AppointmentBookedNotificationInput {
  appointmentId: string;
  clinicId: string;
  patientId: string | null;
  startTime: Date;
}

interface AppointmentPatientContact {
  appointmentId: string;
  clinicId: string;
  patientId: string | null;
  patientName: string;
  patientPhone: string;
  patientEmail: string | null;
  startTime: Date;
}

export type AppointmentConfirmedNotificationInput = AppointmentPatientContact;
export type AppointmentRescheduledNotificationInput = AppointmentPatientContact;
export interface AppointmentCancelledNotificationInput
  extends AppointmentPatientContact {
  canceledBy: string;
  reason?: string;
}
export interface AppointmentReminderNotificationInput
  extends AppointmentPatientContact {
  /** Klinik ayarı: hatırlatmaya hasta yanıtı (iki yönlü onay) bekleniyor mu? */
  requireResponse: boolean;
}

export interface WorkOrderOverdueNotificationInput {
  workOrderId: string;
  clinicId: string;
  dueDate: Date;
  daysOverdue: number;
}

/**
 * Merkezi bildirim dağıtıcısı. Domain event'lerini alıcı + kanala çözer:
 * personel → panel-içi (in-app) kayıt, hasta → dış kanal (WhatsApp/e-posta) portu.
 * Cross-module veriler yalnız QueryBus üzerinden çekilir.
 */
@Injectable()
export class NotificationDispatcherService {
  private readonly logger = new Logger(NotificationDispatcherService.name);
  private readonly internalCtx = ExecutionContextFactory.createInternal();

  constructor(
    private readonly queryBus: TSQueryBus,
    @Inject(STAFF_NOTIFICATION_COMMAND_REPOSITORY)
    private readonly staffNotificationCommandRepo: IStaffNotificationCommandRepository,
    @Inject(PATIENT_NOTIFICATION_PORT)
    private readonly patientNotification: PatientNotificationPort,
    private readonly realtimeBridge: NotificationRealtimeBridge
  ) {}

  async notifyAppointmentBooked(
    input: AppointmentBookedNotificationInput
  ): Promise<void> {
    const when = DateTimeManager.formatDateTime(input.startTime);
    await this.settle(input.appointmentId, [
      this.dispatchStaff({
        clinicId: input.clinicId,
        page: 'appointments',
        entityId: input.appointmentId,
        type: NotificationTypeSchema.enum.APPOINTMENT_REQUESTED,
        priority: NotificationPrioritySchema.enum.MEDIUM,
        title: 'Yeni randevu talebi',
        body: `${when} için yeni bir randevu talebi onay bekliyor.`,
      }),
      this.notifyPatientOfBooking(input),
    ]);
  }

  async notifyAppointmentConfirmed(
    input: AppointmentConfirmedNotificationInput
  ): Promise<void> {
    const when = DateTimeManager.formatDateTime(input.startTime);
    await this.settle(input.appointmentId, [
      this.dispatchStaff({
        clinicId: input.clinicId,
        page: 'appointments',
        entityId: input.appointmentId,
        type: NotificationTypeSchema.enum.APPOINTMENT_CONFIRMED,
        priority: NotificationPrioritySchema.enum.MEDIUM,
        title: 'Randevu onaylandı',
        body: `${input.patientName} — ${when} randevusu onaylandı.`,
      }),
      this.patientNotification.notify({
        kind: 'CONFIRMED',
        patientName: input.patientName,
        patientEmail: input.patientEmail,
        patientPhone: input.patientPhone,
        clinicId: input.clinicId,
        startTime: input.startTime,
      }),
    ]);
  }

  async notifyAppointmentRescheduled(
    input: AppointmentRescheduledNotificationInput
  ): Promise<void> {
    const when = DateTimeManager.formatDateTime(input.startTime);
    await this.settle(input.appointmentId, [
      this.dispatchStaff({
        clinicId: input.clinicId,
        page: 'appointments',
        entityId: input.appointmentId,
        type: NotificationTypeSchema.enum.APPOINTMENT_RESCHEDULED,
        priority: NotificationPrioritySchema.enum.HIGH,
        title: 'Randevu yeniden planlandı',
        body: `${input.patientName} — randevu ${when} tarihine alındı.`,
      }),
      this.patientNotification.notify({
        kind: 'RESCHEDULED',
        patientName: input.patientName,
        patientEmail: input.patientEmail,
        patientPhone: input.patientPhone,
        clinicId: input.clinicId,
        startTime: input.startTime,
      }),
    ]);
  }

  async notifyAppointmentCancelled(
    input: AppointmentCancelledNotificationInput
  ): Promise<void> {
    const when = DateTimeManager.formatDateTime(input.startTime);
    const hoursUntil = DateTimeManager.diffInHours(
      input.startTime,
      DateTimeManager.create()
    );
    const isLate = hoursUntil >= 0 && hoursUntil < LATE_CANCEL_THRESHOLD_HOURS;

    // Hasta kendi iptal ettiyse hastaya tekrar bildirim gönderilmez.
    const canceledByPatient =
      input.patientId !== null && input.canceledBy === input.patientId;

    const tasks: Promise<void>[] = [
      this.dispatchStaff({
        clinicId: input.clinicId,
        page: 'appointments',
        entityId: input.appointmentId,
        type: isLate
          ? NotificationTypeSchema.enum.APPOINTMENT_CANCELLED_LATE
          : NotificationTypeSchema.enum.APPOINTMENT_CANCELLED,
        priority: isLate
          ? NotificationPrioritySchema.enum.CRITICAL
          : NotificationPrioritySchema.enum.MEDIUM,
        title: isLate ? 'Son dakika iptali!' : 'Randevu iptal edildi',
        body: `${input.patientName} — ${when} randevusu iptal edildi.`,
      }),
    ];

    if (!canceledByPatient) {
      tasks.push(
        this.patientNotification.notify({
          kind: 'CANCELLED',
          patientName: input.patientName,
          patientEmail: input.patientEmail,
          patientPhone: input.patientPhone,
          clinicId: input.clinicId,
          startTime: input.startTime,
          reason: input.reason,
        })
      );
    }

    await this.settle(input.appointmentId, tasks);
  }

  /**
   * Yaklaşan randevu hatırlatması — yalnız hasta dış kanalı (personel in-app yok).
   * `requireResponse` iki yönlü onay (WhatsApp quick-reply) SEAM'ine taşınır.
   */
  async notifyAppointmentReminder(
    input: AppointmentReminderNotificationInput
  ): Promise<void> {
    await this.settle(input.appointmentId, [
      this.patientNotification.notify({
        kind: 'REMINDER',
        patientName: input.patientName,
        patientEmail: input.patientEmail,
        patientPhone: input.patientPhone,
        clinicId: input.clinicId,
        startTime: input.startTime,
        requireResponse: input.requireResponse,
      }),
    ]);
  }

  /**
   * Dış iş emri termini geçti — yalnız personel panel-içi bildirimi (hastaya
   * tedarikçi gecikmesi bildirilmez). Tekrar bildirim üretilmemesini iş emri
   * entity'si (`overdueNotifiedAt`) garanti eder.
   */
  async notifyWorkOrderOverdue(
    input: WorkOrderOverdueNotificationInput
  ): Promise<void> {
    const due = DateTimeManager.formatDateTime(input.dueDate);
    await this.dispatchStaff({
      clinicId: input.clinicId,
      page: 'work-orders',
      entityId: input.workOrderId,
      type: NotificationTypeSchema.enum.WORK_ORDER_OVERDUE,
      priority: NotificationPrioritySchema.enum.HIGH,
      title: 'İş emri gecikti',
      body: `Termini ${due} olan dış iş emri ${input.daysOverdue} gündür teslim edilmedi.`,
    });
  }

  /** Bir klinikteki tüm bildirim-alıcı personele in-app kayıt üretir + push eder. */
  private async dispatchStaff(params: {
    clinicId: string;
    /** Frontend derin link sayfası (ör. 'appointments', 'work-orders'). */
    page: string;
    /** Derin linkin hedef kaydı. */
    entityId: string;
    type: NotificationTypeType;
    priority: NotificationPriorityType;
    title: string;
    body: string;
  }): Promise<void> {
    const recipientIds = await this.queryBus.execute(
      new FindClinicStaffUserIdsQuery(params.clinicId)
    );

    if (recipientIds.length === 0) return;

    const notifications = recipientIds.map((staffId) =>
      StaffNotification.create({
        staffId,
        clinicId: params.clinicId,
        type: params.type,
        priority: params.priority,
        title: params.title,
        body: params.body,
        // Frontend derin link: bildirime tıklayınca ilgili kaydın modalını aç.
        deepLink: {
          page: params.page,
          id: params.entityId,
          action: 'open_modal',
        },
      })
    );

    await this.staffNotificationCommandRepo.createMany(notifications);
    await this.pushRealtime(notifications);
  }

  /**
   * Oluşan bildirimleri real-time kanaldan (SSE, Redis pub/sub) push eder ve
   * teslimat durumunu (SENT/FAILED) günceller. deliveryStatus = "gateway'e
   * push edildi mi"; okundu (isRead) bundan ayrıdır.
   */
  private async pushRealtime(
    notifications: StaffNotification[]
  ): Promise<void> {
    const sentIds: string[] = [];
    const failedIds: string[] = [];

    await Promise.all(
      notifications.map(async (notification) => {
        try {
          await this.realtimeBridge.publish(notification.staffId.value, {
            id: notification.id.value,
            type: notification.type,
            title: notification.title,
            body: notification.body,
            priority: notification.priority,
            deepLink: notification.deepLink,
            createdAt: notification.createdAt,
          });
          sentIds.push(notification.id.value);
        } catch (error) {
          this.logger.error(
            `Real-time bildirim push edilemedi (id=${notification.id.value}): ${error}`
          );
          failedIds.push(notification.id.value);
        }
      })
    );

    await Promise.all([
      this.staffNotificationCommandRepo.markDeliveryStatus(
        sentIds,
        NotificationDeliveryStatusSchema.enum.SENT
      ),
      this.staffNotificationCommandRepo.markDeliveryStatus(
        failedIds,
        NotificationDeliveryStatusSchema.enum.FAILED
      ),
    ]);
  }

  /** Hastaya "talebiniz alındı" bildirimi — booked event hasta iletişimini taşımaz, sorgulanır. */
  private async notifyPatientOfBooking(
    input: AppointmentBookedNotificationInput
  ): Promise<void> {
    if (!input.patientId) return;

    const { data: patient } = await this.queryBus.execute(
      new GetPatientByIdQuery(input.patientId, this.internalCtx)
    );

    if (!patient) return;

    const patientName = `${patient.firstName} ${patient.lastName ?? ''}`.trim();

    await this.patientNotification.notify({
      kind: 'BOOKING_RECEIVED',
      patientName,
      patientEmail: patient.email ?? null,
      patientPhone: patient.phone ?? null,
      clinicId: input.clinicId,
      startTime: input.startTime,
    });
  }

  /** Alt görevleri bağımsız çalıştırır; biri patlarsa diğerini etkilemez, sadece loglanır. */
  private async settle(
    appointmentId: string,
    tasks: Promise<void>[]
  ): Promise<void> {
    const results = await Promise.allSettled(tasks);
    results.forEach((result) => {
      if (result.status === 'rejected') {
        this.logger.error(
          `Randevu bildirimi dağıtılamadı (appointmentId=${appointmentId}): ${result.reason}`
        );
      }
    });
  }
}
