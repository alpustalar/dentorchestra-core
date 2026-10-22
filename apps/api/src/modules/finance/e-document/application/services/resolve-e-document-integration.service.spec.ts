/* eslint-disable @typescript-eslint/unbound-method */
import type { TokenCipherService } from '@src/infrastructure/security/crypto/token-cipher.service';
import type { IEDocumentIntegrationConfigCommandRepository } from '@modules/finance/e-document/domain/repositories/e-document-integration-config.repository';
import { EDocumentIntegrationConfig } from '@modules/finance/e-document/domain/entities/e-document-integration-config.entity';
import { ResolveEDocumentIntegrationService } from './resolve-e-document-integration.service';

describe('ResolveEDocumentIntegrationService', () => {
  const organizationId = '15dc8ab4-ab9e-4b46-a6e8-7f62148b95fc';
  const config = EDocumentIntegrationConfig.create({
    scope: 'ORGANIZATION',
    provider: 'NILVERA',
    environment: 'PRODUCTION',
    credentialsCiphertext: 'encrypted-secret',
    credentialHint: '****cret',
    clinicId: null,
    organizationId,
  });

  const make = () => {
    const repo = {
      findEffectiveByClinicId: jest.fn(),
      findByScope: jest.fn(),
      upsert: jest.fn(),
      deleteByScope: jest.fn(),
    } satisfies jest.Mocked<IEDocumentIntegrationConfigCommandRepository>;
    const cipher = {
      decrypt: jest.fn(),
    } as unknown as jest.Mocked<TokenCipherService>;
    return {
      service: new ResolveEDocumentIntegrationService(repo, cipher),
      repo,
      cipher,
    };
  };

  it('klinik için organizasyondan miras kalan konfigürasyonu çözer', async () => {
    const { service, repo, cipher } = make();
    repo.findEffectiveByClinicId.mockResolvedValue(config);
    cipher.decrypt.mockReturnValue(
      JSON.stringify({ provider: 'NILVERA', apiKey: 'nilvera-secret-key' })
    );

    await expect(service.resolve('clinic-1')).resolves.toEqual({
      configId: config.id,
      scope: 'ORGANIZATION',
      sourceId: organizationId,
      provider: 'NILVERA',
      environment: 'PRODUCTION',
      credentials: { provider: 'NILVERA', apiKey: 'nilvera-secret-key' },
    });
    expect(cipher.decrypt).toHaveBeenCalledWith('encrypted-secret');
  });

  it('bozuk veya beklenmeyen çözülmüş credential gövdesini reddeder', async () => {
    const { service, repo, cipher } = make();
    repo.findEffectiveByClinicId.mockResolvedValue(config);
    cipher.decrypt.mockReturnValue(
      JSON.stringify({ provider: 'NILVERA', apiKey: 'short' })
    );

    await expect(service.resolve('clinic-1')).rejects.toThrow();
  });

  it('etkin konfigürasyon yoksa açık hata üretir', async () => {
    const { service, repo } = make();
    repo.findEffectiveByClinicId.mockResolvedValue(null);

    await expect(service.resolve('clinic-1')).rejects.toThrow(
      'etkin bir e-belge entegrasyonu yapılandırılmamış'
    );
  });
});
