import { UpsertEDocumentIntegrationCommand } from './upsert-e-document-integration.command';
import { UpsertEDocumentIntegrationHandler } from './upsert-e-document-integration.handler';
import type { EDocumentIntegrationConfig } from '@modules/finance/e-document/domain/entities/e-document-integration-config.entity';

describe('UpsertEDocumentIntegrationHandler', () => {
  const clinicId = '8461b7f2-5b9d-4620-93f1-0a86f2964d74';
  const ctx = {
    actor: { userId: 'user-1' },
    source: 'USER_ACTION',
  } as never;

  const make = () => {
    let saved: EDocumentIntegrationConfig | undefined;
    const repo = {
      findByScope: jest.fn().mockResolvedValue(null),
      upsert: jest
        .fn()
        .mockImplementation((config: EDocumentIntegrationConfig) => {
          saved = config;
          return Promise.resolve();
        }),
    };
    const cipher = { encrypt: jest.fn().mockReturnValue('encrypted-value') };
    const access = { assertCanManage: jest.fn() };
    const txManager = {
      run: jest
        .fn()
        .mockImplementation((work: () => Promise<unknown>) => work()),
    };
    const audit = { security: jest.fn().mockResolvedValue(undefined) };
    return {
      handler: new UpsertEDocumentIntegrationHandler(
        repo as never,
        cipher as never,
        access as never,
        txManager as never,
        audit as never
      ),
      repo,
      cipher,
      access,
      audit,
      getSaved: () => saved,
    };
  };

  it('API keyi yalnız şifreleyerek saklar ve denetim kaydına secret yazmaz', async () => {
    const { handler, cipher, access, audit, getSaved } = make();
    const apiKey = 'nilvera-super-secret-key';

    const id = await handler.execute(
      new UpsertEDocumentIntegrationCommand({
        scope: 'CLINIC',
        sourceId: clinicId,
        data: { provider: 'NILVERA', environment: 'TEST', apiKey },
        ctx,
      })
    );

    expect(id).toEqual(expect.any(String));
    expect(access.assertCanManage).toHaveBeenCalledWith(
      'CLINIC',
      clinicId,
      ctx
    );
    expect(cipher.encrypt).toHaveBeenCalledWith(
      JSON.stringify({ provider: 'NILVERA', apiKey })
    );

    const saved = getSaved();
    expect(saved).toBeDefined();
    if (!saved) throw new Error('Konfigürasyon repositoryye iletilmedi.');
    expect(saved.toPersistence()).toEqual(
      expect.objectContaining({
        clinicId,
        organizationId: null,
        credentialsCiphertext: 'encrypted-value',
        credentialHint: '****-key',
      })
    );
    expect(JSON.stringify(saved.toPersistence())).not.toContain(apiKey);
    expect(JSON.stringify(audit.security.mock.calls)).not.toContain(apiKey);
  });
});
