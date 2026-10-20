import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { BaseRepository } from '@src/infrastructure/persistence/prisma/base.repository';
import { PrismaService } from '@src/infrastructure/persistence/prisma/prisma.service';
import {
  NotificationDeliveryStatusSchema,
  NotificationDeliveryStatusType,
} from '@input-type-schemas/NotificationDeliveryStatusSchema';
import { StaffNotification } from '@modules/platform/notification/domain/entities/staff-notification.entity';
import { IStaffNotificationCommandRepository } from '@modules/platform/notification/domain/repositories/staff-notification.repository';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';

@Injectable()
export class StaffNotificationCommandRepository
  extends BaseRepository
  implements IStaffNotificationCommandRepository
{
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  async createMany(notifications: StaffNotification[]): Promise<void> {
    if (notifications.length === 0) return;

    const rows: Prisma.StaffNotificationCreateManyInput[] = notifications.map(
      (notification) => {
        const data = notification.toPersistence();
        return {
          id: data.id,
          clinicId: data.clinicId,
          staffId: data.staffId,
          type: data.type,
          title: data.title,
          body: data.body,
          paramsJson:
            data.paramsJson === null
              ? Prisma.JsonNull
              : (data.paramsJson as Prisma.InputJsonValue),
          deepLink:
            data.deepLink === null
              ? Prisma.JsonNull
              : (data.deepLink as Prisma.InputJsonValue),
          priority: data.priority,
          isRead: data.isRead,
          readAt: data.readAt,
          deliveryStatus: data.deliveryStatus,
          deliveredAt: data.deliveredAt,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        };
      }
    );

    await this.db.staffNotification.createMany({ data: rows });
  }

  async findById(id: string): Promise<StaffNotification | null> {
    const raw = await this.db.staffNotification.findUnique({ where: { id } });
    return raw ? new StaffNotification(raw) : null;
  }

  async update(notification: StaffNotification): Promise<StaffNotification> {
    const data = notification.toPersistence();
    const raw = await this.db.staffNotification.update({
      where: { id: data.id },
      data: {
        title: data.title,
        body: data.body,
        priority: data.priority,
        isRead: data.isRead,
        readAt: data.readAt,
        deliveryStatus: data.deliveryStatus,
        deliveredAt: data.deliveredAt,
      },
    });
    return new StaffNotification(raw);
  }

  async markAllRead(staffId: string): Promise<number> {
    const result = await this.db.staffNotification.updateMany({
      where: { staffId, isRead: false },
      data: { isRead: true, readAt: DateTimeManager.create() },
    });
    return result.count;
  }

  async markDeliveryStatus(
    ids: string[],
    status: NotificationDeliveryStatusType
  ): Promise<void> {
    if (ids.length === 0) return;
    await this.db.staffNotification.updateMany({
      where: { id: { in: ids } },
      data: {
        deliveryStatus: status,
        deliveredAt:
          status === NotificationDeliveryStatusSchema.enum.SENT
            ? DateTimeManager.create()
            : null,
      },
    });
  }
}
