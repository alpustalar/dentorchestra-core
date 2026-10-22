'use client';

import { SelectInput } from '@/components/ui/select-input';

import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { DateTimeManager } from '@shared/common';
import {
  Building2,
  CircleCheckBig,
  CircleX,
  Hospital,
  KeyRound,
  Loader2,
  PlugZap,
  Trash2,
} from 'lucide-react';

import {
  eDocumentIntegrationGetClinicIntegration,
  eDocumentIntegrationGetOrganizationIntegration,
  eDocumentIntegrationRemoveClinicIntegration,
  eDocumentIntegrationRemoveOrganizationIntegration,
  eDocumentIntegrationTestClinicIntegration,
  eDocumentIntegrationTestOrganizationIntegration,
  eDocumentIntegrationUpsertClinicIntegration,
  eDocumentIntegrationUpsertOrganizationIntegration,
} from '@/api/generated/edocument-integration/edocument-integration';
import type {
  EDocumentIntegrationResponseDto,
  UpsertEDocumentIntegrationDto,
} from '@/api/generated/model';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { formatShortDate } from '@/lib/date-time';

type IntegrationScope = 'CLINIC' | 'ORGANIZATION';
type IntegrationEnvironment = 'TEST' | 'PRODUCTION';

const integrationQueryRoot = ['finance', 'e-document-integration'] as const;

export function EDocumentIntegrationSettings({
  clinicId,
  organizationId,
  hasScope,
  isDemo,
}: {
  clinicId: string | null;
  organizationId: string | null;
  hasScope: boolean;
  isDemo: boolean;
}) {
  const t = useTranslations('FinanceEDocument.integration');
  const locale = useLocale();
  const queryClient = useQueryClient();
  const [scope, setScope] = useState<IntegrationScope>('CLINIC');
  const [environment, setEnvironment] =
    useState<IntegrationEnvironment>('TEST');
  const [apiKey, setApiKey] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [removeConfirmed, setRemoveConfirmed] = useState(false);
  const [demoIntegration, setDemoIntegration] =
    useState<EDocumentIntegrationResponseDto | null>(null);

  const sourceId = scope === 'CLINIC' ? clinicId : organizationId;
  const canLoad = hasScope && Boolean(sourceId);
  const integrationQuery = useQuery({
    queryKey: [...integrationQueryRoot, scope, sourceId],
    queryFn: ({ signal }) =>
      scope === 'CLINIC'
        ? eDocumentIntegrationGetClinicIntegration(sourceId ?? '', signal)
        : eDocumentIntegrationGetOrganizationIntegration(
            sourceId ?? '',
            signal
          ),
    enabled: canLoad && !isDemo,
    retry: false,
  });
  const integration = isDemo
    ? demoIntegration
    : ((integrationQuery.data?.data ??
        null) as EDocumentIntegrationResponseDto | null);

  useEffect(() => {
    if (integration?.environment) setEnvironment(integration.environment);
  }, [integration?.environment]);

  useEffect(() => {
    setApiKey('');
    setNotice(null);
    setValidationError(null);
    setRemoveConfirmed(false);
  }, [scope, clinicId, organizationId]);

  const saveMutation = useMutation({
    mutationFn: async (data: UpsertEDocumentIntegrationDto) => {
      if (isDemo) return 'demo-e-document-integration';
      if (!sourceId) throw new Error('missing scope');
      return scope === 'CLINIC'
        ? eDocumentIntegrationUpsertClinicIntegration(sourceId, data)
        : eDocumentIntegrationUpsertOrganizationIntegration(sourceId, data);
    },
    retry: false,
    onSuccess: async (id) => {
      if (isDemo && sourceId) {
        setDemoIntegration({
          id,
          scope,
          provider: 'NILVERA',
          environment,
          configured: true,
          credentialHint: `****${apiKey.trim().slice(-4)}`,
          inherited: false,
          sourceId,
          lastTestSucceeded: null,
          lastTestedAt: null,
          updatedAt: DateTimeManager.toIsoString(DateTimeManager.create()),
        });
      } else {
        await queryClient.invalidateQueries({ queryKey: integrationQueryRoot });
      }
      setApiKey('');
      setValidationError(null);
      setRemoveConfirmed(false);
      setNotice(t('saveSuccess'));
    },
  });

  const testMutation = useMutation({
    mutationFn: async () => {
      if (isDemo) return;
      if (!integration) throw new Error('missing integration');
      if (integration.scope === 'ORGANIZATION') {
        return eDocumentIntegrationTestOrganizationIntegration(
          integration.sourceId
        );
      }
      return eDocumentIntegrationTestClinicIntegration(integration.sourceId);
    },
    retry: false,
    onSuccess: async () => {
      if (isDemo) {
        setDemoIntegration((current) =>
          current
            ? {
                ...current,
                lastTestSucceeded: true,
                lastTestedAt: DateTimeManager.toIsoString(
                  DateTimeManager.create()
                ),
              }
            : current
        );
      } else {
        await queryClient.invalidateQueries({ queryKey: integrationQueryRoot });
      }
      setNotice(t('testSuccess'));
    },
  });

  const removeMutation = useMutation({
    mutationFn: async () => {
      if (isDemo) return;
      if (!sourceId) throw new Error('missing scope');
      return scope === 'CLINIC'
        ? eDocumentIntegrationRemoveClinicIntegration(sourceId)
        : eDocumentIntegrationRemoveOrganizationIntegration(sourceId);
    },
    retry: false,
    onSuccess: async () => {
      if (isDemo) setDemoIntegration(null);
      else
        await queryClient.invalidateQueries({ queryKey: integrationQueryRoot });
      setRemoveConfirmed(false);
      setNotice(t('removeSuccess'));
    },
  });

  const operationError =
    integrationQuery.error ??
    saveMutation.error ??
    testMutation.error ??
    removeMutation.error;
  const isBusy =
    saveMutation.isPending ||
    testMutation.isPending ||
    removeMutation.isPending;
  const isDirectConfiguration = Boolean(integration && !integration.inherited);
  const statusLabel = useMemo(() => {
    if (!integration) return t('notConfigured');
    if (integration.lastTestSucceeded === true) return t('testPassed');
    if (integration.lastTestSucceeded === false) return t('testFailed');
    return t('notTested');
  }, [integration, t]);

  const resetOperationFeedback = () => {
    saveMutation.reset();
    testMutation.reset();
    removeMutation.reset();
    setNotice(null);
  };

  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    resetOperationFeedback();
    const trimmedApiKey = apiKey.trim();
    if (trimmedApiKey.length < 16) {
      setValidationError(t('apiKeyValidation'));
      return;
    }
    setNotice(null);
    setValidationError(null);
    saveMutation.mutate({
      provider: 'NILVERA',
      environment,
      apiKey: trimmedApiKey,
    });
  };

  return (
    <Card>
      <CardHeader className="gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <KeyRound
              className="size-5 text-muted-foreground"
              aria-hidden="true"
            />
            <CardTitle>{t('title')}</CardTitle>
          </div>
          <CardDescription>{t('description')}</CardDescription>
        </div>
        <Badge variant={integration ? 'secondary' : 'outline'}>
          {integration ? t('configured') : t('notConfigured')}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <div className="space-y-4 rounded-lg border bg-muted/20 p-4">
            <FormField label={t('scopeLabel')}>
              <SelectInput
                className="min-h-11 w-full rounded-lg border border-input bg-background px-3 text-sm"
                value={scope}
                onChange={(event) =>
                  setScope(event.target.value as IntegrationScope)
                }
                disabled={!hasScope || isBusy}
              >
                <option value="CLINIC">{t('scopeClinic')}</option>
                <option value="ORGANIZATION" disabled={!organizationId}>
                  {t('scopeOrganization')}
                </option>
              </SelectInput>
            </FormField>

            {!hasScope ? (
              <InfoBox>{t('noScope')}</InfoBox>
            ) : integrationQuery.isPending && !isDemo ? (
              <InfoBox>{t('loading')}</InfoBox>
            ) : integration ? (
              <div className="space-y-3 text-sm">
                {integration.inherited && (
                  <div className="flex items-start gap-2 rounded-lg border border-blue-500/30 bg-blue-500/5 p-3">
                    <Building2
                      className="mt-0.5 size-4 shrink-0 text-blue-600"
                      aria-hidden="true"
                    />
                    <span>{t('inheritedDescription')}</span>
                  </div>
                )}
                <dl className="grid grid-cols-2 gap-3">
                  <IntegrationDetail
                    label={t('providerLabel')}
                    value={integration.provider}
                  />
                  <IntegrationDetail
                    label={t('environmentLabel')}
                    value={t(`environment.${integration.environment}`)}
                  />
                  <IntegrationDetail
                    label={t('credentialLabel')}
                    value={integration.credentialHint ?? t('maskedCredential')}
                  />
                  <IntegrationDetail
                    label={t('testStatusLabel')}
                    value={statusLabel}
                  />
                  <IntegrationDetail
                    label={t('lastTestedLabel')}
                    value={
                      integration.lastTestedAt
                        ? formatShortDate(integration.lastTestedAt, locale)
                        : t('never')
                    }
                  />
                  <IntegrationDetail
                    label={t('sourceLabel')}
                    value={
                      integration.scope === 'CLINIC'
                        ? t('scopeClinic')
                        : t('scopeOrganization')
                    }
                  />
                </dl>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    className="min-h-11"
                    type="button"
                    variant="outline"
                    onClick={() => {
                      resetOperationFeedback();
                      testMutation.mutate();
                    }}
                    disabled={isBusy}
                  >
                    {testMutation.isPending ? (
                      <Loader2
                        className="size-4 animate-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <PlugZap className="size-4" aria-hidden="true" />
                    )}
                    {t('testConnection')}
                  </Button>
                  {isDirectConfiguration &&
                    (!removeConfirmed ? (
                      <Button
                        className="min-h-11"
                        type="button"
                        variant="destructive"
                        onClick={() => setRemoveConfirmed(true)}
                        disabled={isBusy}
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                        {t('remove')}
                      </Button>
                    ) : (
                      <Button
                        className="min-h-11"
                        type="button"
                        variant="destructive"
                        onClick={() => {
                          resetOperationFeedback();
                          removeMutation.mutate();
                        }}
                        disabled={isBusy}
                      >
                        {removeMutation.isPending && (
                          <Loader2
                            className="size-4 animate-spin"
                            aria-hidden="true"
                          />
                        )}
                        {t('confirmRemove')}
                      </Button>
                    ))}
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2 text-sm text-muted-foreground">
                {scope === 'CLINIC' ? (
                  <Hospital
                    className="mt-0.5 size-4 shrink-0"
                    aria-hidden="true"
                  />
                ) : (
                  <Building2
                    className="mt-0.5 size-4 shrink-0"
                    aria-hidden="true"
                  />
                )}
                <span>{t('emptyDescription')}</span>
              </div>
            )}
          </div>

          <form className="space-y-4 rounded-lg border p-4" onSubmit={save}>
            <div>
              <p className="font-medium">
                {integration ? t('rotateTitle') : t('connectTitle')}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {integration ? t('rotateDescription') : t('connectDescription')}
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label={t('providerLabel')}>
                <Input className="min-h-11" value="Nilvera" disabled />
              </FormField>
              <FormField label={t('environmentLabel')}>
                <SelectInput
                  className="min-h-11 w-full rounded-lg border border-input bg-background px-3 text-sm"
                  value={environment}
                  onChange={(event) =>
                    setEnvironment(event.target.value as IntegrationEnvironment)
                  }
                  disabled={!canLoad || isBusy}
                >
                  <option value="TEST">{t('environment.TEST')}</option>
                  <option value="PRODUCTION">
                    {t('environment.PRODUCTION')}
                  </option>
                </SelectInput>
              </FormField>
            </div>
            <FormField label={t('apiKeyLabel')}>
              <Input
                className="min-h-11"
                type="password"
                autoComplete="new-password"
                value={apiKey}
                onChange={(event) => {
                  setApiKey(event.target.value);
                  setValidationError(null);
                }}
                placeholder={
                  integration?.credentialHint ?? t('apiKeyPlaceholder')
                }
                disabled={!canLoad || isBusy}
                aria-invalid={Boolean(validationError)}
              />
            </FormField>
            <div className="flex items-start gap-2 rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
              <KeyRound className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>{t('securityNote')}</span>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-h-5 text-sm" aria-live="polite">
                {validationError && (
                  <span className="text-destructive">{validationError}</span>
                )}
                {operationError && !validationError && (
                  <span className="text-destructive">
                    {t('operationError')}
                  </span>
                )}
                {notice && !validationError && !operationError && (
                  <span className="text-emerald-700 dark:text-emerald-400">
                    {notice}
                  </span>
                )}
              </div>
              <Button
                className="min-h-11"
                type="submit"
                disabled={!canLoad || isBusy || apiKey.trim().length === 0}
              >
                {saveMutation.isPending && (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                )}
                {integration ? t('rotateCredential') : t('connect')}
              </Button>
            </div>
          </form>
        </div>

        {integration?.lastTestSucceeded === true && (
          <div className="flex items-start gap-2 rounded-lg border border-emerald-600/30 bg-emerald-500/5 p-3 text-sm">
            <CircleCheckBig
              className="mt-0.5 size-4 shrink-0 text-emerald-600"
              aria-hidden="true"
            />
            <span>{t('readyDescription')}</span>
          </div>
        )}
        {integration?.lastTestSucceeded === false && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
            <CircleX
              className="mt-0.5 size-4 shrink-0 text-destructive"
              aria-hidden="true"
            />
            <span>{t('failedDescription')}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label>
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}

function IntegrationDetail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words font-medium">{value}</dd>
    </div>
  );
}

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
      {children}
    </div>
  );
}
