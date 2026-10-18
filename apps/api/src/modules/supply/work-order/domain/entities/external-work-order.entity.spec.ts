import { randomUUID } from 'crypto';
import { ExternalWorkOrder } from './external-work-order.entity';
import {
  WorkOrderEmptyItemsException,
  WorkOrderInvalidStateException,
} from '@modules/supply/work-order/domain/exceptions/work-order.exceptions';
import { CreateExternalWorkOrderProps } from '@modules/supply/work-order/domain/contracts';
import { DateTimeManager } from '@common/infrastructure/date-time/date-time.manager';
import { WorkOrderSentEvent } from '@modules/supply/work-order/domain/events/work-order-sent.event';
import { WorkOrderReceivedEvent } from '@modules/supply/work-order/domain/events/work-order-received.event';
import { WorkOrderOverdueEvent } from '@modules/supply/work-order/domain/events/work-order-overdue.event';

describe('ExternalWorkOrder entity', () => {
  const clinicId = randomUUID();
  const organizationId = randomUUID();
  const supplierId = randomUUID();
  const patientId = randomUUID();

  const baseProps = (): CreateExternalWorkOrderProps => ({
    clinicId,
    organizationId,
    supplierId,
    patientId,
    agreedCost: 1500,
    items: [
      {
        description: 'Zirkonyum kron',
        quantity: 3,
        unitCost: 500,
        specs: { kind: 'DENTAL', toothNumbers: [11, 12, 13], shade: 'A2' },
      },
    ],
  });

  /** DRAFT → SENT → IN_PROGRESS → READY akışını kurup entity'yi döndürür. */
  const readyWorkOrder = (dueDate = DateTimeManager.addDays(new Date(), 7)) => {
    const workOrder = ExternalWorkOrder.create(baseProps());
    workOrder.send(dueDate);
    workOrder.markInProgress();
    workOrder.markReady();
    return workOrder;
  };

  it('create → DRAFT, satırlar ve specs korunur, event yok', () => {
    const workOrder = ExternalWorkOrder.create(baseProps());

    expect(workOrder.status).toBe('DRAFT');
    expect(workOrder.id.value).toBeDefined();
    expect(workOrder.lines).toHaveLength(1);
    expect(workOrder.lines[0].specs).toEqual({
      kind: 'DENTAL',
      toothNumbers: [11, 12, 13],
      shade: 'A2',
    });
    expect(workOrder.agreedCost?.toNumber()).toBe(1500);
    expect(workOrder.actualCost).toBeNull();
  });

  it('create → kalemsiz iş emri reddedilir', () => {
    expect(() =>
      ExternalWorkOrder.create({ ...baseProps(), items: [] })
    ).toThrow(WorkOrderEmptyItemsException);
  });

  it('send → SENT + termin damgası + WorkOrderSentEvent', () => {
    const workOrder = ExternalWorkOrder.create(baseProps());
    const dueDate = DateTimeManager.addDays(new Date(), 5);

    workOrder.send(dueDate, 'LAB-2026-77');

    expect(workOrder.status).toBe('SENT');
    expect(workOrder.dueDate).toEqual(dueDate);
    expect(workOrder.sentAt).not.toBeNull();
    expect(workOrder.referenceNo).toBe('LAB-2026-77');
    expect(workOrder.getDomainEvents()[0]).toBeInstanceOf(WorkOrderSentEvent);
  });

  it('send → yalnız DRAFT durumunda mümkün', () => {
    const workOrder = ExternalWorkOrder.create(baseProps());
    const dueDate = DateTimeManager.addDays(new Date(), 5);
    workOrder.send(dueDate);

    expect(() => workOrder.send(dueDate)).toThrow(
      WorkOrderInvalidStateException
    );
  });

  it('prova döngüsü: IN_PROGRESS → TRY_IN → IN_PROGRESS → READY', () => {
    const workOrder = ExternalWorkOrder.create(baseProps());
    workOrder.send(DateTimeManager.addDays(new Date(), 5));

    workOrder.markInProgress();
    workOrder.markTryIn();
    expect(workOrder.status).toBe('TRY_IN');

    workOrder.markInProgress(); // provadan revizyona dönüş
    expect(workOrder.status).toBe('IN_PROGRESS');

    workOrder.markReady();
    expect(workOrder.status).toBe('READY');
  });

  it('markTryIn → yalnız üretimdeki iş emri provaya alınabilir', () => {
    const workOrder = ExternalWorkOrder.create(baseProps());
    workOrder.send(DateTimeManager.addDays(new Date(), 5));

    // SENT durumunda prova yok
    expect(() => workOrder.markTryIn()).toThrow(WorkOrderInvalidStateException);
  });

  it('receive → DELIVERED + actualCost + gecikme günü ile event', () => {
    const dueDate = DateTimeManager.subtractDays(new Date(), 3); // 3 gün gecikmiş
    const workOrder = readyWorkOrder(dueDate);
    workOrder.flushEvents();

    workOrder.receive(1750);

    expect(workOrder.status).toBe('DELIVERED');
    expect(workOrder.actualCost?.toNumber()).toBe(1750);
    expect(workOrder.receivedAt).not.toBeNull();

    const event = workOrder
      .getDomainEvents()
      .find(
        (e): e is WorkOrderReceivedEvent => e instanceof WorkOrderReceivedEvent
      );
    expect(event?.cost).toBe('1750');
    expect(event?.delayInDays).toBe(3);
  });

  it('receive → actualCost verilmezse anlaşılan ücret event maliyeti olur', () => {
    const workOrder = readyWorkOrder();
    workOrder.flushEvents();

    workOrder.receive();

    const event = workOrder
      .getDomainEvents()
      .find(
        (e): e is WorkOrderReceivedEvent => e instanceof WorkOrderReceivedEvent
      );
    expect(workOrder.actualCost).toBeNull();
    expect(event?.cost).toBe('1500');
    expect(event?.delayInDays).toBe(0);
  });

  it('fit → yalnız teslim alınmış iş emri hastaya uygulanabilir', () => {
    const workOrder = readyWorkOrder();

    expect(() => workOrder.fit()).toThrow(WorkOrderInvalidStateException);

    workOrder.receive();
    workOrder.fit(randomUUID());

    expect(workOrder.status).toBe('FITTED');
    expect(workOrder.fittedAt).not.toBeNull();
  });

  it('cancel → FITTED terminal durumundan iptal edilemez', () => {
    const workOrder = readyWorkOrder();
    workOrder.receive();
    workOrder.fit();

    expect(() => workOrder.cancel('vazgeçildi')).toThrow(
      WorkOrderInvalidStateException
    );
  });

  it('cancel → açık durumdan iptal + gerekçe', () => {
    const workOrder = ExternalWorkOrder.create(baseProps());
    workOrder.send(DateTimeManager.addDays(new Date(), 5));

    workOrder.cancel('hasta tedaviden vazgeçti');

    expect(workOrder.status).toBe('CANCELLED');
    expect(workOrder.cancelReason).toBe('hasta tedaviden vazgeçti');
    expect(workOrder.cancelledAt).not.toBeNull();
  });

  it('openRemake → satırları kopyalar, kaynağa bağlanır, kaynak değişmez', () => {
    const source = readyWorkOrder();
    source.receive();
    source.fit();

    const remake = ExternalWorkOrder.openRemake(source, {
      reason: 'renk uyumsuz',
    });

    expect(remake.status).toBe('DRAFT');
    expect(remake.remakeOfId).toBe(source.id.value);
    expect(remake.remakeReason).toBe('renk uyumsuz');
    expect(remake.id.value).not.toBe(source.id.value);
    expect(remake.lines).toHaveLength(source.lines.length);
    expect(remake.lines[0].specs).toEqual(source.lines[0].specs);
    expect(remake.lines[0].id).not.toBe(source.lines[0].id);
    expect(remake.patientId).toBe(source.patientId);
    // Kaynak iş emri kendi geçmişini korur
    expect(source.status).toBe('FITTED');
  });

  it('isOverdue → yalnız termini geçmiş ve hâlâ tedarikçideki iş emirleri', () => {
    const overdue = readyWorkOrder(DateTimeManager.subtractDays(new Date(), 1));
    expect(overdue.isOverdue()).toBe(true);

    // teslim alınınca termin anlamını yitirir
    overdue.receive();
    expect(overdue.isOverdue()).toBe(false);

    const onTime = readyWorkOrder(DateTimeManager.addDays(new Date(), 2));
    expect(onTime.isOverdue()).toBe(false);
  });

  it('markOverdueNotified → damga + gecikme günü taşıyan event', () => {
    const workOrder = readyWorkOrder(
      DateTimeManager.subtractDays(new Date(), 4)
    );
    workOrder.flushEvents();

    workOrder.markOverdueNotified();

    expect(workOrder.overdueNotifiedAt).not.toBeNull();
    const event = workOrder
      .getDomainEvents()
      .find(
        (e): e is WorkOrderOverdueEvent => e instanceof WorkOrderOverdueEvent
      );
    expect(event?.daysOverdue).toBe(4);
    expect(event?.workOrderId).toBe(workOrder.id.value);
  });

  it('toPersistence → tüm alanlar düz kayda taşınır', () => {
    const workOrder = readyWorkOrder();
    const raw = workOrder.toPersistence();

    expect(raw.id).toBe(workOrder.id.value);
    expect(raw.clinicId).toBe(clinicId);
    expect(raw.supplierId).toBe(supplierId);
    expect(raw.status).toBe('READY');
    expect(raw.currency).toBe('TRY');
  });
});
