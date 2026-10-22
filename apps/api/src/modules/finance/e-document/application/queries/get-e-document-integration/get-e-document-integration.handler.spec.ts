import { GetEDocumentIntegrationHandler } from './get-e-document-integration.handler';
import { GetEDocumentIntegrationQuery } from './get-e-document-integration.query';

describe('GetEDocumentIntegrationHandler', () => {
  const ctx = { actor: { userId: 'user-1' }, source: 'USER_ACTION' } as never;
  const view = {
    id: 'config-1',
    scope: 'ORGANIZATION' as const,
    provider: 'NILVERA' as const,
    environment: 'TEST' as const,
    configured: true as const,
    credentialHint: '****1234',
    inherited: false,
    sourceId: 'organization-1',
    lastTestedAt: null,
    lastTestSucceeded: null,
    updatedAt: new Date('2026-10-21T10:00:00.000Z'),
  };

  it('organizasyon ayarını doğrudan ve secretsız okur', async () => {
    const repo = {
      findByScope: jest.fn().mockResolvedValue(view),
      findEffectiveByClinicId: jest.fn(),
    };
    const access = { assertCanManage: jest.fn() };
    const handler = new GetEDocumentIntegrationHandler(
      repo as never,
      access as never
    );

    await expect(
      handler.execute(
        new GetEDocumentIntegrationQuery({
          scope: 'ORGANIZATION',
          sourceId: 'organization-1',
          ctx,
        })
      )
    ).resolves.toEqual({ data: view });
    expect(access.assertCanManage).toHaveBeenCalledWith(
      'ORGANIZATION',
      'organization-1',
      ctx
    );
    expect(repo.findByScope).toHaveBeenCalledWith(
      'ORGANIZATION',
      'organization-1'
    );
    expect(repo.findEffectiveByClinicId).not.toHaveBeenCalled();
    expect(JSON.stringify(view)).not.toContain('apiKey');
  });
});
