/*
 * Prisma delegesi ve repo taklit edildiği için mock nesneleri `any` taşır;
 * kurallar yalnız bu dosyada kapatılır.
 */
/* eslint-disable @typescript-eslint/require-await */
import { Decimal } from 'decimal.js';
import { LocalChargeTotalsService } from './local-charge-totals.service';
import { TreatmentCharge } from '@modules/finance/treatment-charge/domain/entities/treatment-charge.entity';
import { Money } from '@src/domain/value-objects/money.vo';
import { VatRate } from '@src/domain/value-objects/vat-rate.vo';

const IDS = {
  org: '11111111-1111-4111-8111-111111111111',
  clinic: '22222222-2222-4222-8222-222222222222',
  appointment: '33333333-3333-4333-8333-333333333333',
  patient: '44444444-4444-4444-8444-444444444444',
  treatment: '55555555-5555-4555-8555-555555555555',
};

const charge = (listPrice: number, quantity = 1) =>
  TreatmentCharge.create({
    organizationId: IDS.org,
    clinicId: IDS.clinic,
    appointmentId: IDS.appointment,
    patientId: IDS.patient,
    treatmentId: IDS.treatment,
    quantity: new Decimal(quantity),
    listPrice: Money.create(listPrice, 'TRY').orThrow(),
    discountRate: new Decimal(0),
    vatRate: VatRate.create(20).orThrow(),
    maxDiscountPercent: new Decimal(20),
    canExceedDiscountLimit: false,
  });

/**
 * Fatura/tahsilat tutarının kaynağı: **kilitli** okuma. Kilitsiz okuma, okuma
 * ile yazma arasında iptal edilen bir satırı faturada bırakıyordu.
 */
describe('LocalChargeTotalsService', () => {
  const make = (charges: TreatmentCharge[]) => {
    const chargeRepo = {
      findActiveByAppointmentIdForUpdate: jest.fn(async () => charges),
      findActiveByAppointmentId: jest.fn(),
    };
    return {
      service: new LocalChargeTotalsService(chargeRepo as never),
      chargeRepo,
    };
  };

  it('satırları KİLİTLİ okuyup toplamı para nesneleriyle döner', async () => {
    const { service, chargeRepo } = make([charge(1000), charge(200)]);

    const totals = await service.lockAndGetAppointmentTotals(IDS.appointment);

    // Kilitsiz varyant kullanılmamalı.
    expect(chargeRepo.findActiveByAppointmentIdForUpdate).toHaveBeenCalledWith(
      IDS.appointment
    );
    expect(chargeRepo.findActiveByAppointmentId).not.toHaveBeenCalled();

    expect(totals?.currency).toBe('TRY');
    expect(totals?.netTotal.toApiFormat()).toBe('1200.00');
    expect(totals?.vatTotal.toApiFormat()).toBe('240.00');
    expect(totals?.grandTotal.toApiFormat()).toBe('1440.00');
    expect(totals?.lineCount).toBe(2);
  });

  it('satır yoksa null döner (serbest tutarlı akış meşru)', async () => {
    const { service } = make([]);

    await expect(
      service.lockAndGetAppointmentTotals(IDS.appointment)
    ).resolves.toBeNull();
  });
});
