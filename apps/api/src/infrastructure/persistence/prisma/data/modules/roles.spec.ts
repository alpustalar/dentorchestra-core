import {
  capabilitiesCreateManyInputs,
  capabilityModulesWithoutLabel,
} from './capabilities';
import { rolesCreateManyInputs } from './roles';
import { ROLE_SLUGS } from '@src/domain/constants/db/role/role-slugs';

const keyOf = (capability: { module: string; action: string }) =>
  `${capability.module}:${capability.action}`;

const definedCapabilities = new Set(capabilitiesCreateManyInputs.map(keyOf));

const roleBySlug = (slug: string) => {
  const role = rolesCreateManyInputs.find((r) => r.slug === slug);
  if (!role) throw new Error(`Rol tanımı bulunamadı: ${slug}`);
  return role;
};

const capabilityKeys = (slug: string) => roleBySlug(slug).caps.map(keyOf);

describe('rol seed matrisi — bütünlük', () => {
  it('her rolün her yetkisi Capability tablosunda tanımlıdır', () => {
    // Seed `findUniqueOrThrow` ile çözdüğü için tanımsız bir yetki seed'i patlatır.
    for (const role of rolesCreateManyInputs) {
      const unknown = role.caps
        .map(keyOf)
        .filter((key) => !definedCapabilities.has(key));

      expect({ role: role.slug, unknown }).toEqual({
        role: role.slug,
        unknown: [],
      });
    }
  });

  it('hiçbir rolde yetki tekrarı yoktur', () => {
    for (const role of rolesCreateManyInputs) {
      const keys = role.caps.map(keyOf);
      expect({ role: role.slug, count: keys.length }).toEqual({
        role: role.slug,
        count: new Set(keys).size,
      });
    }
  });

  it('rol öncelikleri benzersizdir ve hiyerarşi sırasını korur', () => {
    const priorities = rolesCreateManyInputs.map((role) => role.priority);
    expect(new Set(priorities).size).toBe(priorities.length);
  });

  it('yönetim zincirinde kıdemli rol, astının tüm yetkilerini taşır', () => {
    // Kıdemi yüksek bir rolün daha az yetkili olması mantıksızdır: yönetici
    // astının yapabildiğini yapabilmelidir. (Uzmanlık rolleri — muhasebeci,
    // depocu — bu zincire dahil değildir; onlar dikey uzmanlıktır, kıdem değil.)
    const chain = [
      ROLE_SLUGS.ADMIN,
      ROLE_SLUGS.ORGANIZATION_OWNER,
      ROLE_SLUGS.BRANCH_MANAGER,
      ROLE_SLUGS.CLINIC_OWNER,
    ];

    for (let i = 0; i < chain.length - 1; i++) {
      const senior = new Set(capabilityKeys(chain[i]));
      const missing = capabilityKeys(chain[i + 1]).filter(
        (key) => !senior.has(key)
      );

      expect({ senior: chain[i], missing }).toEqual({
        senior: chain[i],
        missing: [],
      });
    }
  });

  it('her rol slug’ı ROLE_SLUGS ile eşleşir ve hiçbir rol tanımsız kalmaz', () => {
    const seeded = rolesCreateManyInputs.map((role) => role.slug).sort();
    expect(seeded).toEqual([...Object.values(ROLE_SLUGS)].sort());
  });

  it('etiketi olmayan yetki modülü kalmamıştır', () => {
    // Etiketsiz modül rol yönetimi ekranında "lead Oluştur" gibi görünür.
    expect(capabilityModulesWithoutLabel).toEqual([]);
  });
});

describe('rol seed matrisi — yetki sınırları', () => {
  it('sistem yöneticisi tüm yetkilere sahiptir', () => {
    expect(new Set(capabilityKeys(ROLE_SLUGS.ADMIN))).toEqual(
      definedCapabilities
    );
  });

  it('ADMIN rezervasyon iadesini elle doğrulayabilir (tek sahip)', () => {
    expect(capabilityKeys(ROLE_SLUGS.ADMIN)).toEqual(
      expect.arrayContaining([
        'bookingpaymentrefund:read',
        'bookingpaymentrefund:update',
      ])
    );
  });

  it('rezervasyon iadesinin elle doğrulanması (para kararı) ADMIN dışında hiçbir rol demetinde yoktur', () => {
    // Kural 7: sonucu doğrulanmamış bir iadeyi kapatmak kalıcı damgalı bir para kararıdır.
    // `bookingpayment:update` klinik sahibi/şube müdürü/resepsiyonda var; bu yüzden ayrı bir
    // aile açıldı ve YALNIZ ADMIN'e (tüm yetkiler) kalır — bir role eklenirse bu test düşer ve
    // karar görünür olur.
    const nonAdminRoles = rolesCreateManyInputs.filter(
      (role) => role.slug !== ROLE_SLUGS.ADMIN
    );

    for (const role of nonAdminRoles) {
      const held = role.caps
        .map(keyOf)
        .filter((key) => key.startsWith('bookingpaymentrefund:'));

      expect({ role: role.slug, held }).toEqual({ role: role.slug, held: [] });
    }
  });

  it('hekim ticari/finansal alana giremez', () => {
    const keys = capabilityKeys(ROLE_SLUGS.PROVIDER);

    expect(keys).not.toContain('journalentry:read');
    expect(keys).not.toContain('payment:create');
    expect(keys).not.toContain('invoice:create');
    expect(keys).not.toContain('finance:read');
  });

  it('muhasebeci tıbbi kayda giremez', () => {
    const keys = capabilityKeys(ROLE_SLUGS.ACCOUNTANT);

    expect(keys).not.toContain('medicalfile:read');
    expect(keys).not.toContain('appointmentdiagnosis:read');
    expect(keys).not.toContain('enabizsync:read');
  });

  it('muhasebeci para akışının tamamını yönetebilir', () => {
    const keys = capabilityKeys(ROLE_SLUGS.ACCOUNTANT);

    for (const required of [
      'invoice:create',
      'payment:create',
      'journalentry:create',
      'cashsession:read',
      'bankstatement:create',
      'party:create',
      'finance:read',
      'finance:update',
    ]) {
      expect(keys).toContain(required);
    }
  });

  it('resepsiyonist tahsilat alır ama muhasebe fişi kesemez', () => {
    const keys = capabilityKeys(ROLE_SLUGS.RECEPTIONIST);

    expect(keys).toContain('payment:create');
    expect(keys).toContain('cashmovement:create');
    expect(keys).not.toContain('journalentry:create');
    expect(keys).not.toContain('account:update');
  });

  it('destek personeli yalnız kendi özlük işlemlerini görür', () => {
    const keys = capabilityKeys(ROLE_SLUGS.STAFF);

    expect(keys).toContain('leaverequest:create');
    expect(keys).toContain('attendancerecord:create');
    expect(keys).not.toContain('patient:read');
    expect(keys).not.toContain('payment:read');
  });

  it('yönetici olmayan hiçbir rol kullanıcı silemez', () => {
    const nonManagers = [
      ROLE_SLUGS.PROVIDER,
      ROLE_SLUGS.ASSISTANT,
      ROLE_SLUGS.ACCOUNTANT,
      ROLE_SLUGS.RECEPTIONIST,
      ROLE_SLUGS.INVENTORY_MANAGER,
      ROLE_SLUGS.STAFF,
    ];

    for (const slug of nonManagers) {
      expect(capabilityKeys(slug)).not.toContain('user:delete');
    }
  });

  it('her rol bildirim merkezini kullanabilir (taban yetki)', () => {
    for (const role of rolesCreateManyInputs) {
      expect(capabilityKeys(role.slug)).toContain('staffnotification:read');
    }
  });
});
