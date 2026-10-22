import { ForbiddenException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InitiateMetaOAuthHandler } from './initiate-meta-oauth.handler';
import { InitiateMetaOAuthCommand } from './initiate-meta-oauth.command';
import { PolicyFactory } from '@modules/platform/policy/staff/application/policy-factory';
import { ExecutionSources } from '../../../../../../../../../packages/shared/common/constants/execution-source.constant';
import { LogSource } from '@src/domain/constants/log-action.constant';
import { ActorContext } from '@common/interfaces';
import type { IGetContext } from '@common/decorators/get-context.decorator';

/**
 * `GET oauth/authorize?clinicId=...` kapsam kontrolünün TEK yeridir: callback
 * aktörsüz çalışır (Meta'dan gelen yönlendirme) ve kliniği state'ten okur.
 * Burası korunmazsa herhangi bir oturum sahibi, başka bir kiracının kliniğine
 * kendi Meta reklam hesabını bağlayacak bir authorize bağlantısı üretebilirdi.
 */
describe('InitiateMetaOAuthHandler — klinik kapsamı', () => {
  const CLINIC = 'clinic-a';
  const ORG = 'org-1';

  const actor = (over: Partial<ActorContext>): ActorContext => ({
    userId: 'user-1',
    email: 'staff@clinic.com',
    source: LogSource.WEB,
    capabilities: [],
    rolePriority: 50,
    managedClinics: [],
    ownedOrganizations: [],
    ...over,
  });

  const run = (a: ActorContext, clinicId: string, returnPath = '/crm/meta-ads') => {
    const stateSet = jest.fn().mockResolvedValue(undefined);
    const metaApi = {
      buildOAuthUrl: jest.fn().mockReturnValue('https://facebook.com/dialog'),
    };

    const handler = new InitiateMetaOAuthHandler(
      metaApi as never,
      { appId: 'app-1', redirectUri: 'https://api/callback' } as never,
      { metaOAuthState: { set: stateSet } } as never,
      { resolve: jest.fn().mockResolvedValue(ORG) } as never,
      new PolicyFactory(new EventEmitter2())
    );

    const ctx: IGetContext = { actor: a, source: ExecutionSources.USER_ACTION };

    return {
      stateSet,
      metaApi,
      execute: () =>
        handler.execute(
          new InitiateMetaOAuthCommand({ clinicId, returnPath, ctx })
        ),
    };
  };

  it('başka kiracının kliniği için authorize bağlantısı üretilmez', async () => {
    const { execute, stateSet, metaApi } = run(
      actor({ clinicId: CLINIC, organizationId: ORG }),
      'other-tenant-clinic'
    );

    await expect(execute()).rejects.toThrow(ForbiddenException);
    // State yazılmadıysa callback'in güveneceği bir kayıt da oluşmaz.
    expect(stateSet).not.toHaveBeenCalled();
    expect(metaApi.buildOAuthUrl).not.toHaveBeenCalled();
  });

  it('kendi kliniği için bağlantı üretilir ve state saklanır', async () => {
    const { execute, stateSet } = run(
      actor({ clinicId: CLINIC, organizationId: ORG }),
      CLINIC
    );

    await expect(execute()).resolves.toBe('https://facebook.com/dialog');

    const [, payload] = stateSet.mock.calls[0];
    expect(JSON.parse(payload as string)).toEqual({
      clinicId: CLINIC,
      userId: 'user-1',
      returnPath: '/crm/meta-ads',
    });
  });

  it('organizasyon sahibi kendi org’undaki klinik için üretebilir', async () => {
    const { execute } = run(
      actor({
        clinicId: undefined,
        ownedOrganizations: [{ id: ORG }],
        organizationId: ORG,
      }),
      CLINIC
    );

    await expect(execute()).resolves.toBe('https://facebook.com/dialog');
  });
});
