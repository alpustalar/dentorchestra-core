import { randomUUID } from 'crypto';
import { ScanOverdueWorkOrdersHandler } from './scan-overdue-work-orders.handler';
import { ExternalWorkOrder } from '@modules/supply/work-order/domain/entities/external-work-order.entity';
import { IExternalWorkOrderCommandRepository } from '@modules/supply/work-order/domain/repositories/external-work/external-work-order.command.repository';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction/transaction.manager';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';
import { WorkOrderOverdueEvent } from '@modules/supply/work-order/domain/events/work-order-overdue.event';

describe('ScanOverdueWorkOrdersHandler', () => {
  const buildOverdueWorkOrder = (): ExternalWorkOrder => {
    const workOrder = ExternalWorkOrder.create({
      clinicId: randomUUID(),
      organizationId: randomUUID(),
      supplierId: randomUUID(),
      patientId: randomUUID(),
      items: [{ description: 'Zirkonyum kron', quantity: 1 }],
    });
    workOrder.send(DateTimeManager.subtractDays(new Date(), 2));
    workOrder.clearDomainEvents();
    return workOrder;
  };

  const buildHandler = (workOrders: ExternalWorkOrder[]) => {
    const repo = {
      findOverdueForNotification: jest.fn().mockResolvedValue(workOrders),
      update: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
      create: jest.fn(),
      findById: jest.fn(),
    } as unknown as IExternalWorkOrderCommandRepository;

    // Transaction sınırı testin konusu değil — callback doğrudan çalıştırılır.
    const txManager = {
      run: jest.fn((cb: () => Promise<unknown>) => cb()),
    } as unknown as TransactionManager;

    return {
      handler: new ScanOverdueWorkOrdersHandler(repo, txManager),
      repo,
    };
  };

  it("gecikmiş iş emri için damga atar ve gecikme event'i fırlatır", async () => {
    const workOrder = buildOverdueWorkOrder();
    const { handler, repo } = buildHandler([workOrder]);

    await handler.execute();

    expect(workOrder.overdueNotifiedAt).not.toBeNull();
    expect(repo.update).toHaveBeenCalledTimes(1);

    const event = workOrder
      .getDomainEvents()
      .find(
        (e): e is WorkOrderOverdueEvent => e instanceof WorkOrderOverdueEvent
      );
    expect(event?.daysOverdue).toBe(2);
  });

  it('bildirilecek iş emri yoksa hiç yazma yapmaz', async () => {
    const { handler, repo } = buildHandler([]);

    await handler.execute();

    expect(repo.update).not.toHaveBeenCalled();
  });

  it('daha önce bildirilmiş kayıtlar repo filtresiyle elenir (idempotency)', async () => {
    const { handler, repo } = buildHandler([]);

    await handler.execute();

    // Repo sorgusu overdueNotifiedAt=null koşulunu taşır; handler ikinci bir
    // eleme yapmaz — tekrar bildirim üretilmemesinin garantisi budur.
    expect(repo.findOverdueForNotification).toHaveBeenCalledWith(
      expect.any(Date),
      500
    );
  });

  it('bir iş emri patlarsa diğerleri işlenmeye devam eder', async () => {
    const failing = buildOverdueWorkOrder();
    const healthy = buildOverdueWorkOrder();
    const { handler, repo } = buildHandler([failing, healthy]);

    (repo.update as jest.Mock)
      .mockRejectedValueOnce(new Error('DB down'))
      .mockImplementationOnce((entity) => Promise.resolve(entity));

    await handler.execute();

    expect(repo.update).toHaveBeenCalledTimes(2);
    expect(healthy.overdueNotifiedAt).not.toBeNull();
  });
});
