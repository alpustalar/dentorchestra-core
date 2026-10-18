import { randomUUID } from 'crypto';
import { PurchaseRequest } from './purchase-request.entity';
import {
  PurchaseRequestNotApprovedException,
  PurchaseRequestNotPendingException,
} from '@modules/supply/purchasing/domain/exceptions/purchasing.exceptions';

describe('PurchaseRequest', () => {
  const CLINIC_ID = randomUUID();
  const ORG_ID = randomUUID();
  /** Personel kimliği Firebase UID'dir (`User.id = firebaseUid`) — UUID DEĞİL. */
  const ACTOR_ID = 'aB3xY9zQ7wE1rT5yU8iO2pL4kJ6h';
  const REVIEWER_ID = 'zQ7wE1rT5yU8iO2pL4kJ6hA3xY9z';

  const create = () =>
    PurchaseRequest.create({
      clinicId: CLINIC_ID,
      organizationId: ORG_ID,
      requestedById: ACTOR_ID,
      items: [{ description: 'Eldiven', quantity: 10 }],
    });

  it('personel kimliği (Firebase UID) ile talep açılabilir', () => {
    // Regresyon: `requestedById` UUID VO'sundan geçiriliyordu; gerçek personel
    // kimliği 28 karakterli Firebase UID olduğu için satın alma talebi HİÇ
    // açılamıyordu (InvalidUuidException).
    const request = create();

    expect(request.requestedById).toBe(ACTOR_ID);
    expect(request.status).toBe('SUBMITTED');
    expect(request.toPersistence().requestedById).toBe(ACTOR_ID);
  });

  it('onaylayan personel kimliği de ham string olarak damgalanır', () => {
    const request = create();
    request.approve(REVIEWER_ID, 'Bütçe uygun');

    expect(request.status).toBe('APPROVED');
    expect(request.reviewedById).toBe(REVIEWER_ID);
    expect(request.reviewNote).toBe('Bütçe uygun');
    expect(request.reviewedAt).not.toBeNull();
  });

  it('onaylanmış talep bir daha onaylanamaz / reddedilemez', () => {
    const request = create();
    request.approve(REVIEWER_ID);

    expect(() => request.approve(REVIEWER_ID)).toThrow(
      PurchaseRequestNotPendingException
    );
    expect(() => request.reject(REVIEWER_ID)).toThrow(
      PurchaseRequestNotPendingException
    );
  });

  it('yalnız onaylı talep siparişe dönüştürülebilir', () => {
    const fresh = create();
    expect(() => fresh.markOrdered()).toThrow(
      PurchaseRequestNotApprovedException
    );

    const approved = create();
    approved.approve(REVIEWER_ID);
    approved.markOrdered();
    expect(approved.status).toBe('ORDERED');

    // İkinci dönüştürme reddedilir: aynı talepten iki sipariş açılamaz.
    expect(() => approved.markOrdered()).toThrow(
      PurchaseRequestNotApprovedException
    );
  });

  it('kalem kimlikleri UUID üretir (ham randomUUID değil, proje VO su)', () => {
    const request = create();

    expect(request.lines).toHaveLength(1);
    expect(request.lines[0].id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
  });
});
