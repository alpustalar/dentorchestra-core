import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { ResponseGroups } from '../../../../../../../../../packages/shared/common/constants/response-groups.constant';
import { NotificationTypeType as NotificationType, NotificationTypeSchema } from '@input-type-schemas/NotificationTypeSchema';
import { NotificationPriorityType as NotificationPriority, NotificationPrioritySchema } from '@input-type-schemas/NotificationPrioritySchema';
import { NotificationDeliveryStatusType as NotificationDeliveryStatus, NotificationDeliveryStatusSchema } from '@input-type-schemas/NotificationDeliveryStatusSchema';

const { INTERNAL, MANAGEMENT, ADMIN } = ResponseGroups;

export class StaffNotificationResponseDto {
  @Expose() id: string;
  @Expose() clinicId: string;
  @Expose() staffId: string;

  // --- Temel Bildirim İçeriği (Herkes Görebilir / UI Tüketimi) ---
  @ApiProperty({ enum: NotificationTypeSchema.options })
  @Expose() type: NotificationType;
  @Expose() title: string;
  @Expose() body: string;
  @ApiProperty({ enum: NotificationPrioritySchema.options })
  @Expose() priority: NotificationPriority;

  @Expose() isRead: boolean;

  @Expose()
  @Type(() => Date)
  readAt: Date | null;

  // --- Yapısal Navigasyon ve Ek Veriler (İç Operasyon ve Üst Roller) ---
  @Expose({ groups: [INTERNAL, MANAGEMENT, ADMIN] })
  paramsJson: any | null;

  @Expose({ groups: [INTERNAL, MANAGEMENT, ADMIN] })
  deepLink: any | null;

  // --- Push Teslimat ve Altyapı Durumları (Sadece Yönetim ve Admin) ---
  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @ApiProperty({ enum: NotificationDeliveryStatusSchema.options })
  deliveryStatus: NotificationDeliveryStatus;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @Type(() => Date)
  deliveredAt: Date | null;

  // --- Audit Zaman Damgaları ---
  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @Type(() => Date)
  createdAt: Date;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @Type(() => Date)
  updatedAt: Date;
}
