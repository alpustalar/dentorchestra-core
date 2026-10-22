import { UUID } from '@src/domain/value-objects/uuid.vo';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';
import type {
  CreateEDocumentIntegrationConfigProps,
  EDocumentEnvironment,
  EDocumentIntegrationConfigData,
  EDocumentIntegrationScope,
  EDocumentProvider,
} from '../contracts/e-document.contracts';

export class EDocumentIntegrationConfig {
  constructor(private data: EDocumentIntegrationConfigData) {}

  get id(): string {
    return this.data.id;
  }
  get scope(): EDocumentIntegrationScope {
    return this.data.scope;
  }
  get provider(): EDocumentProvider {
    return this.data.provider;
  }
  get environment(): EDocumentEnvironment {
    return this.data.environment;
  }
  get credentialsCiphertext(): string {
    return this.data.credentialsCiphertext;
  }
  get credentialHint(): string | null {
    return this.data.credentialHint;
  }
  get clinicId(): string | null {
    return this.data.clinicId;
  }
  get organizationId(): string | null {
    return this.data.organizationId;
  }

  static create(
    props: CreateEDocumentIntegrationConfigProps
  ): EDocumentIntegrationConfig {
    this.assertScope(props.scope, props.clinicId, props.organizationId);
    const now = DateTimeManager.create();
    return new EDocumentIntegrationConfig({
      ...props,
      id: UUID.createOrGenerate(props.id).value,
      isActive: true,
      lastTestedAt: null,
      lastTestSucceeded: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  updateConnection(input: {
    provider: EDocumentProvider;
    environment: EDocumentEnvironment;
    credentialsCiphertext: string;
    credentialHint: string | null;
  }): void {
    this.data.provider = input.provider;
    this.data.environment = input.environment;
    this.data.credentialsCiphertext = input.credentialsCiphertext;
    this.data.credentialHint = input.credentialHint;
    this.data.isActive = true;
    this.data.lastTestedAt = null;
    this.data.lastTestSucceeded = null;
    this.data.updatedAt = DateTimeManager.create();
  }

  recordConnectionTest(succeeded: boolean): void {
    this.data.lastTestedAt = DateTimeManager.create();
    this.data.lastTestSucceeded = succeeded;
    this.data.updatedAt = DateTimeManager.create();
  }

  toPersistence(): EDocumentIntegrationConfigData {
    return { ...this.data };
  }

  private static assertScope(
    scope: EDocumentIntegrationScope,
    clinicId: string | null,
    organizationId: string | null
  ): void {
    const valid =
      (scope === 'CLINIC' && clinicId !== null && organizationId === null) ||
      (scope === 'ORGANIZATION' &&
        organizationId !== null &&
        clinicId === null);
    if (!valid) {
      throw new Error(
        'E-belge konfigürasyonu tam olarak bir kapsama ait olmalı.'
      );
    }
  }
}
