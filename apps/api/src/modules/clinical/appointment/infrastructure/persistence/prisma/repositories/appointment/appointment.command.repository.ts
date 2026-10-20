import { Injectable } from '@nestjs/common';
import { AppointmentStatusSchema } from '@shared';
import { BaseCommandRepository } from '@src/infrastructure/persistence/prisma/base-command.repository';
import { PrismaService } from '@src/infrastructure/persistence/prisma/prisma.service';
import { Appointment } from '@modules/clinical/appointment/domain/entities/appointment.entity';
import { IAppointmentCommandRepository } from '@modules/clinical/appointment/domain/repositories/appointment/appointment.command.repository';
import { BatchPayload } from '@common/interfaces/batch-payload.type';
import { txStorage } from '@src/infrastructure/persistence/prisma/transaction';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';
import { ConcurrencyConflictException } from '@common/domain/exceptions/concurrency-conflict.exception';
import {
  CancelProviderAppointmentsData,
  FindDueForReminderData,
} from '@modules/clinical/appointment/domain/contracts/appointment';

@Injectable()
export class AppointmentCommandRepository
  extends BaseCommandRepository<Appointment>
  implements IAppointmentCommandRepository
{
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  async create(appointment: Appointment): Promise<Appointment> {
    const data = appointment.toPersistence();

    const raw = await this.db.appointment.create({
      data,
    });

    appointment.flushEvents();

    return new Appointment(raw);
  }

  async findById(id: string): Promise<Appointment | null> {
    const raw = await this.db.appointment.findUnique({ where: { id } });
    return raw ? new Appointment(raw) : null;
  }

  async softDeleteAllAppointmentsByClinicId(
    clinicId: string
  ): Promise<BatchPayload> {
    return this.db.appointment.updateMany({
      where: { clinicId },
      data: { isDeleted: true, deletedAt: DateTimeManager.create() },
    });
  }

  async softDeleteAllByOrganizationId(
    organizationId: string
  ): Promise<BatchPayload> {
    return this.db.appointment.updateMany({
      where: { clinic: { organizationId } },
      data: { isDeleted: true, deletedAt: DateTimeManager.create() },
    });
  }

  async findDueForReminder({
    now,
    windowEnd,
    limit,
  }: FindDueForReminderData): Promise<Appointment[]> {
    const raws = await this.db.appointment.findMany({
      where: {
        isDeleted: false,
        status: AppointmentStatusSchema.enum.CONFIRMED,
        reminderSentAt: null,
        startTime: { gte: now, lte: windowEnd },
      },
      orderBy: { startTime: 'asc' },
      take: limit,
    });
    return raws.map((appointment) => new Appointment(appointment));
  }

  // Doktor-günü toplu iptal (rapor/izin/acil). Yalnız iptal edilebilir statüler
  // (PENDING/CONFIRMED) güncellenir; tamamlanmış/gelmemiş/zaten iptal dokunulmaz.
  // Bulk işlem domain'i bypass eder (N+1 önlemek); handler tek toplu event fırlatır.
  async cancelAllByProviderInRange({
    providerId,
    clinicId,
    startDate,
    endDate,
    canceledBy,
    cancelReason,
  }: CancelProviderAppointmentsData): Promise<BatchPayload> {
    return this.db.appointment.updateMany({
      where: {
        providerId,
        clinicId,
        isDeleted: false,
        status: {
          in: [
            AppointmentStatusSchema.enum.PENDING,
            AppointmentStatusSchema.enum.CONFIRMED,
          ],
        },
        startTime: { gte: startDate, lte: endDate },
      },
      data: {
        status: AppointmentStatusSchema.enum.CANCELLED,
        canceledAt: DateTimeManager.create(),
        canceledBy,
        cancelReason: cancelReason ?? null,
      },
    });
  }

  async updateMany(appointments: Appointment[]): Promise<void> {
    const queries = appointments.map((appointment) => {
      const create = appointment.toPersistence();
      const { id, ...data } = create;
      return this.db.appointment.update({
        where: { id },
        data,
      });
    });

    if (txStorage.getStore()?.tx) {
      await Promise.all(queries);
    } else {
      await this.prisma.$transaction(queries);
    }

    appointments.forEach((appointment) => appointment.flushEvents());
  }

  async update(appointment: Appointment): Promise<Appointment> {
    const persistenceData = appointment.toPersistence();
    const { id, version, ...data } = persistenceData;

    // Optimistic concurrency guard: yalnız version hâlâ okuduğumuz değerse günceller
    // ve version'ı artırır. Etkilenen satır 0 ise kayıt bu arada başkası tarafından
    // değiştirilmiş demektir → ConcurrencyConflictException (409).
    const result = await this.db.appointment.updateMany({
      where: { id, version },
      data: { ...data, version: version + 1 },
    });

    if (result.count === 0) {
      throw new ConcurrencyConflictException('Appointment', id);
    }

    appointment.flushEvents();

    return new Appointment({ ...persistenceData, version: version + 1 });
  }

  countActiveByPatient(patientId: string): Promise<number> {
    return this.db.appointment.count({
      where: {
        patientId,
        isDeleted: false,
        status: {
          in: [
            AppointmentStatusSchema.enum.PENDING,
            AppointmentStatusSchema.enum.CONFIRMED,
          ],
        },
        startTime: { gte: DateTimeManager.create() },
      },
    });
  }
}
