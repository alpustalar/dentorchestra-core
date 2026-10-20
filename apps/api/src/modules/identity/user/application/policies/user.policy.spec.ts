import { LogSource } from '@src/domain/constants/log-action.constant';
import { Priority } from '@src/domain/value-objects/priority.vo';
import { UserPolicy } from './user.policy';
import { ActorContext } from '@common/interfaces';
import {
  ExecutionSource,
  ExecutionSources,
} from '../../../../../../../../packages/shared/common/constants/execution-source.constant';

/**
 * Yetki devrinin iki kuralı burada sabitlenir. İkisi de güvenlik kuralıdır:
 * biri kaçarsa klinik yöneticisi kendi tavanını aşabilir ya da platformun
 * yetkilendirme tesisatını personeline açabilir.
 */
describe('UserPolicy — yetki devri', () => {
  const CLINIC = '22222222-2222-4222-8222-222222222222';

  const policyOf = (capabilities: string[], rolePriority = 80) =>
    new UserPolicy(
      {
        userId: 'manager-1',
        email: 'mudur@klinik.com',
        capabilities,
        rolePriority,
        managedClinics: [{ id: CLINIC }],
        ownedOrganizations: [],
        clinicId: CLINIC,
      } as unknown as ActorContext,
      'API' as ExecutionSource
    );

  describe('aktörün kendi tavanı', () => {
    it('sahip olduğu yetkiyi devredebilir', () => {
      const policy = policyOf(['patient:read', 'payment:create']);
      expect(policy.actorCanGrantCapability('payment:create')).toBe(true);
    });

    it('sahip OLMADIĞI yetkiyi devredemez — dolaylı yetki yükseltme kapalı', () => {
      const policy = policyOf(['patient:read']);
      expect(policy.actorCanGrantCapability('payment:create')).toBe(false);
    });

    it('yakın ama farklı bir eylem devredilemez (read ≠ delete)', () => {
      const policy = policyOf(['patient:read']);
      expect(policy.actorCanGrantCapability('patient:delete')).toBe(false);
    });
  });

  describe('platform kapsamı', () => {
    it('aktör taşısa bile platform yetkisi devredilemez', () => {
      const policy = policyOf(['subscription:read', 'role:update']);
      expect(policy.actorCanGrantCapability('subscription:read')).toBe(false);
      expect(policy.actorCanGrantCapability('role:update')).toBe(false);
    });

    it('sistem yöneticisi de platform yetkisi devredemez', () => {
      // Tavanı en yüksek aktör bile: kişisel devir yolu bu yetkiler için kapalı,
      // onlar yalnız rolle gelir.
      const admin = policyOf(['role:update', 'capability:read'], 100);
      expect(admin.actorCanGrantCapability('role:update')).toBe(false);
    });
  });

  describe('actorHasCapability', () => {
    it('rol ve kişisel yetkilerin birleşimi üzerinden bakar', () => {
      // ActorContext.capabilities zaten birleştirilmiş gelir (bkz.
      // DbActorContextResolver.mergeCapabilities) — policy kaynağı ayırmaz.
      const policy = policyOf(['patient:read', 'payment:create']);
      expect(policy.actorHasCapability('payment:create')).toBe(true);
      expect(policy.actorHasCapability('invoice:read')).toBe(false);
    });

    it('yetkisiz aktörde boş liste güvenle çalışır', () => {
      expect(policyOf([]).actorHasCapability('patient:read')).toBe(false);
    });
  });

  /**
   * `getTargetPriority` imzası `Priority` kabul ediyordu ama onu karşılayan dal
   * yoktu: VO tüm kontrollerden düşüp 0'a iniyor, şema 1..100 istediği için
   * InvalidPriorityException fırlıyordu. `update-user-by-staff` hedefin rol
   * önceliğini VO olarak geçirdiği için o uç hiç çalışmıyordu.
   */
  describe('hedef önceliği Priority VO olarak geldiğinde', () => {
    it('VO doğrudan kullanılır, sıfıra düşüp patlamaz', () => {
      const policy = new UserPolicy(
        {
          userId: 'actor',
          email: 'a@b.c',
          source: LogSource.WEB,
          capabilities: [],
          rolePriority: 80,
          managedClinics: [],
          ownedOrganizations: [],
        } as never,
        ExecutionSources.USER_ACTION
      );

      expect(() =>
        policy.actorCanUpdateTargetUser(Priority.fromTrusted(10), undefined)
      ).not.toThrow();
      expect(
        policy.actorCanUpdateTargetUser(Priority.fromTrusted(10), undefined)
      ).toBe(true);
    });
  });
});
