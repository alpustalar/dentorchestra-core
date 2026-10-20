import { ForbiddenException } from '@nestjs/common';
import { ActorContext } from '@common/interfaces';
import { ExecutionSources } from '@shared/common/constants/execution-source.constant';
import { PolicyEvaluator } from '@modules/platform/policy/staff/application/policy-evaluator';
import { FinancePolicy } from './finance.policy';

/**
 * Platform kiracısının finans uçlarına (banka hesabı, sağlayıcı payout kaydı, iade doğrulama)
 * KİMİN erişebildiğini GERÇEK `PolicyEvaluator` + `FinancePolicy` ile kilitler.
 *
 * Platform payout'unu kaydetmek için kod değişikliği gerekmedi: handler'lar yetkiyi
 * `canAccessClinicFinances(platformClinicId)` ile sorar ve sistem yöneticisi (öncelik ≥ 100)
 * değerlendirmeyi atlar. Bu davranış bir yan etkiye dayandığı için sessizce bozulmasın diye
 * burada sabitlenir: ADMIN geçer, hiçbir klinik rolü geçemez.
 */
describe('FinancePolicy — platform kiracısı erişimi', () => {
  const PLATFORM_CLINIC = '00000000-0000-4000-8000-000000000002';
  const OWN_CLINIC = '11111111-1111-4111-8111-111111111111';

  const actor = (over: Partial<ActorContext>): ActorContext =>
    ({
      userId: 'u-1',
      clinicId: OWN_CLINIC,
      organizationId: '22222222-2222-4222-8222-222222222222',
      managedClinics: [],
      rolePriority: 0,
      ...over,
    }) as unknown as ActorContext;

  /** Handler'larla birebir aynı çağrı: `finance(actor).evaluator.check(...).orThrow(...)`. */
  const attempt = (a: ActorContext) => {
    const policy = new FinancePolicy(a, ExecutionSources.USER_ACTION);
    new PolicyEvaluator(policy)
      .check((p) => p.canAccessClinicFinances(PLATFORM_CLINIC))
      .orThrow('platform.finance');
  };

  it('ADMIN (öncelik 100, yönetilen klinik yok) platform finansına erişir', () => {
    expect(() => attempt(actor({ rolePriority: 100 }))).not.toThrow();
  });

  it('klinik sahibi (öncelik 80, yalnız kendi kliniğini yönetir) REDDEDİLİR', () => {
    expect(() =>
      attempt(actor({ rolePriority: 80, managedClinics: [{ id: OWN_CLINIC }] }))
    ).toThrow(ForbiddenException);
  });

  it('muhasebeci / resepsiyon (öncelik 55/40) REDDEDİLİR', () => {
    for (const rolePriority of [55, 40]) {
      expect(() => attempt(actor({ rolePriority }))).toThrow(
        ForbiddenException
      );
    }
  });

  it('platform kliniğini YÖNETEN (managedClinics) aktör erişir', () => {
    expect(() =>
      attempt(
        actor({ rolePriority: 60, managedClinics: [{ id: PLATFORM_CLINIC }] })
      )
    ).not.toThrow();
  });

  it('başka bir kliniğin aktörü kendi kliniği platform kliniği olmadıkça erişemez', () => {
    expect(() =>
      attempt(actor({ rolePriority: 70, clinicId: OWN_CLINIC }))
    ).toThrow(ForbiddenException);
  });
});
