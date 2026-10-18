import { Module } from '@nestjs/common';
import { QUEUES } from '@common/constants';
import { BullBoardModule } from '@bull-board/nestjs';
import { ExpressAdapter } from '@bull-board/express';
import { BullMQAdapter } from '@bull-board/api/dist/queueAdapters/bullMQ';
import basicAuth from 'express-basic-auth';

@Module({
  imports: [
    BullBoardModule.forRoot({
      route: '/admin/queues', // Panel adresi
      adapter: ExpressAdapter,
      middleware: basicAuth({
        users: { admin: process.env.QUEUE_MONITOR_ADMIN_PASSWORD! },
        challenge: true,
        unauthorizedResponse: 'Yetkisiz Erişim!',
      }),
    }),
    BullBoardModule.forFeature({
      name: QUEUES.FINANCE,
      adapter: BullMQAdapter,
    }),
    // Muhasebe dönemi kontrolü: yıl dönümünde çalışmazsa tüm posting durur,
    // bu yüzden panelden görünür olmalı.
    BullBoardModule.forFeature({
      name: QUEUES.ACCOUNTING,
      adapter: BullMQAdapter,
    }),
    // Fişlenmemiş olay süpürmesi: mizanın olay defteriyle mutabık kalmasını bu iş
    // sağlıyor; sessizce durursa fiş boşlukları birikir.
    BullBoardModule.forFeature({
      name: QUEUES.POSTING,
      adapter: BullMQAdapter,
    }),
  ],
})
export class MonitoringModule {}
