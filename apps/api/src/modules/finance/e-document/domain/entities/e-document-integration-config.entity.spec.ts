import { EDocumentIntegrationConfig } from './e-document-integration-config.entity';

describe('EDocumentIntegrationConfig', () => {
  const clinicId = '8461b7f2-5b9d-4620-93f1-0a86f2964d74';

  it('klinik kapsamını tek kaynak kimliğiyle oluşturur', () => {
    const config = EDocumentIntegrationConfig.create({
      scope: 'CLINIC',
      provider: 'NILVERA',
      environment: 'TEST',
      credentialsCiphertext: 'ciphertext',
      credentialHint: '****1234',
      clinicId,
      organizationId: null,
    });

    expect(config.toPersistence()).toEqual(
      expect.objectContaining({
        scope: 'CLINIC',
        clinicId,
        organizationId: null,
        isActive: true,
        lastTestedAt: null,
        lastTestSucceeded: null,
      })
    );
  });

  it('iki kapsama birden bağlı veya kaynaksız konfigürasyonu reddeder', () => {
    expect(() =>
      EDocumentIntegrationConfig.create({
        scope: 'CLINIC',
        provider: 'NILVERA',
        environment: 'TEST',
        credentialsCiphertext: 'ciphertext',
        credentialHint: null,
        clinicId,
        organizationId: '06c870ae-afdc-42ae-8d3f-a7b08070c3b8',
      })
    ).toThrow('tam olarak bir kapsama');

    expect(() =>
      EDocumentIntegrationConfig.create({
        scope: 'ORGANIZATION',
        provider: 'NILVERA',
        environment: 'TEST',
        credentialsCiphertext: 'ciphertext',
        credentialHint: null,
        clinicId: null,
        organizationId: null,
      })
    ).toThrow('tam olarak bir kapsama');
  });

  it('credential yenilenince önceki bağlantı testi sonucunu sıfırlar', () => {
    const config = EDocumentIntegrationConfig.create({
      scope: 'CLINIC',
      provider: 'NILVERA',
      environment: 'TEST',
      credentialsCiphertext: 'old',
      credentialHint: '****1111',
      clinicId,
      organizationId: null,
    });
    config.recordConnectionTest(true);

    config.updateConnection({
      provider: 'NILVERA',
      environment: 'PRODUCTION',
      credentialsCiphertext: 'new',
      credentialHint: '****2222',
    });

    expect(config.toPersistence()).toEqual(
      expect.objectContaining({
        environment: 'PRODUCTION',
        credentialsCiphertext: 'new',
        credentialHint: '****2222',
        lastTestedAt: null,
        lastTestSucceeded: null,
      })
    );
  });
});
