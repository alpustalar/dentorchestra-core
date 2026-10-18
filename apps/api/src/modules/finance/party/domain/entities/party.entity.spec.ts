import { randomUUID } from 'crypto';
import { Party } from './party.entity';
import {
  PartyOriginTypeSchema,
  PartyRoleSchema,
  PartyTypeSchema,
} from '@shared';

/**
 * Cari "ensure" akışının davranışı: rol birikimi, pasif cariyi yeniden
 * aktifleştirme ve bilinen kimlik bilgisini silmeme.
 */
describe('Party', () => {
  const build = (overrides: Partial<Parameters<typeof Party.create>[0]> = {}) =>
    Party.create({
      clinicId: randomUUID(),
      organizationId: randomUUID(),
      type: PartyTypeSchema.enum.INDIVIDUAL,
      roles: [PartyRoleSchema.enum.PATIENT],
      name: 'Ayşe Yılmaz',
      nationalId: '10000000146',
      originType: PartyOriginTypeSchema.enum.PATIENT,
      originId: randomUUID(),
      ...overrides,
    });

  it('rol ekleme idempotenttir', () => {
    const party = build();

    expect(party.addRole(PartyRoleSchema.enum.PATIENT)).toBe(false);
    expect(party.addRole(PartyRoleSchema.enum.CUSTOMER)).toBe(true);
    expect(party.roles).toEqual([
      PartyRoleSchema.enum.PATIENT,
      PartyRoleSchema.enum.CUSTOMER,
    ]);
  });

  it('pasif cariyi yeni mali hareket geldiğinde yeniden aktifleştirir', () => {
    const party = build({ isActive: false });

    party.ensure({ role: PartyRoleSchema.enum.PATIENT, name: 'Ayşe Yılmaz' });

    // Yazmayı engellemek parayı defterin dışında bırakırdı; pasif kalmak ise
    // `?isActive=true` süzgeçli mutabakatta cariyi görünmez yapardı.
    expect(party.isActive).toBe(true);
  });

  it('kaynakta kimlik boşsa bilinen TCKN silinmez', () => {
    const party = build();

    party.ensure({
      role: PartyRoleSchema.enum.PATIENT,
      name: 'Ayşe Yılmaz',
      nationalId: null,
      taxNumber: null,
    });

    expect(party.nationalId?.value).toBe('10000000146');
  });

  it("kaynaktan gelen yeni kimlik bilgisi snapshot'ı günceller", () => {
    const party = build({ nationalId: null });

    party.ensure({
      role: PartyRoleSchema.enum.PATIENT,
      name: 'Ayşe Yılmaz',
      nationalId: '10000000146',
    });

    expect(party.nationalId?.value).toBe('10000000146');
  });

  it('olmayan rol sorgusu tipli domain hatası üretir', () => {
    const party = build();

    expect(() =>
      party.validate.hasRole(PartyRoleSchema.enum.EMPLOYEE).orThrow()
    ).toThrow(/rolü içermiyor/);
  });
});
