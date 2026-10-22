'use client';

import { SelectInput } from '@/components/ui/select-input';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { z } from 'zod';
import {
  Cable,
  CheckCircle2,
  CreditCard,
  KeyRound,
  Loader2,
  Plus,
} from 'lucide-react';

import { useIyzicoTerminalRegisterConfig } from '@/api/generated/iyzico-terminal-command/iyzico-terminal-command';
import { usePosDeviceRegister } from '@/api/generated/pos-device-command/pos-device-command';
import {
  getPosDeviceFindByClinicQueryKey,
  usePosDeviceFindByClinic,
} from '@/api/generated/pos-device-query/pos-device-query';
import type { PosDeviceResponseDto } from '@/api/generated/model';
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
import { useAuth as useMockAuth } from '@/data/auth/auth-context';
import {
  actorHasCapability,
  AuthProvider,
  useAuth,
  type AuthStatus,
} from '@/lib/auth';

const deviceSchema = z
  .object({
    label: z.string().trim().min(2),
    provider: z.enum(['PAX', 'IYZICO_TERMINAL']),
    terminalId: z.string().trim(),
    merchantId: z.string().trim(),
    host: z.string().trim(),
    port: z.union([z.literal(''), z.coerce.number().int().positive()]),
    deviceUniqueId: z.string().trim(),
  })
  .superRefine((value, context) => {
    if (value.provider === 'PAX' && (!value.terminalId || !value.merchantId)) {
      context.addIssue({
        code: 'custom',
        path: ['terminalId'],
        message: 'required',
      });
    }
    if (value.provider === 'IYZICO_TERMINAL' && !value.deviceUniqueId) {
      context.addIssue({
        code: 'custom',
        path: ['deviceUniqueId'],
        message: 'required',
      });
    }
  });

const credentialSchema = z.object({
  clientId: z.string().trim().min(1),
  clientSecret: z.string().min(1),
  username: z.string().trim().min(1),
  password: z.string().min(1),
});

export function PhysicalPosWorkspace() {
  if (process.env.NEXT_PUBLIC_API_MOCKING === 'enabled') {
    return <MockPhysicalPos />;
  }
  return (
    <AuthProvider>
      <LivePhysicalPos />
    </AuthProvider>
  );
}

function MockPhysicalPos() {
  const { selectedClinicId, hasHydrated } = useMockAuth();
  return (
    <PhysicalPosContent
      clinicId={selectedClinicId}
      status={hasHydrated ? 'authenticated' : 'loading'}
      canManageDevices
      canManageCredentials
      isDemo
    />
  );
}

function LivePhysicalPos() {
  const { actor, status } = useAuth();
  return (
    <PhysicalPosContent
      clinicId={actor?.clinicId ?? null}
      status={status}
      canManageDevices={actorHasCapability(actor, 'posdevice:create')}
      canManageCredentials={actorHasCapability(
        actor,
        'clinicyzicoterminalconfig:update'
      )}
      isDemo={false}
    />
  );
}

function PhysicalPosContent({
  clinicId,
  status,
  canManageDevices,
  canManageCredentials,
  isDemo,
}: {
  clinicId: string | null;
  status: AuthStatus;
  canManageDevices: boolean;
  canManageCredentials: boolean;
  isDemo: boolean;
}) {
  const t = useTranslations('FinancePos.physical');
  const queryClient = useQueryClient();
  const hasScope =
    status === 'authenticated' &&
    (isDemo ? Boolean(clinicId) : isUuid(clinicId));
  const [showDeviceForm, setShowDeviceForm] = useState(false);
  const [showCredentialForm, setShowCredentialForm] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [demoDevices, setDemoDevices] =
    useState<PosDeviceResponseDto[]>(initialDemoDevices);
  const [deviceForm, setDeviceForm] = useState({
    label: '',
    provider: 'IYZICO_TERMINAL' as 'PAX' | 'IYZICO_TERMINAL',
    terminalId: '',
    merchantId: '',
    host: '',
    port: '',
    deviceUniqueId: '',
  });
  const [credentialForm, setCredentialForm] = useState({
    clientId: '',
    clientSecret: '',
    username: '',
    password: '',
  });

  const devicesQuery = usePosDeviceFindByClinic(clinicId ?? '', {
    query: { enabled: hasScope && !isDemo, retry: false },
  });
  const devices = isDemo ? demoDevices : (devicesQuery.data?.data ?? []);

  const registerDevice = usePosDeviceRegister({
    mutation: {
      retry: false,
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: getPosDeviceFindByClinicQueryKey(clinicId ?? ''),
        });
        setNotice(t('deviceSaved'));
        setShowDeviceForm(false);
      },
    },
  });
  const registerCredentials = useIyzicoTerminalRegisterConfig({
    mutation: {
      retry: false,
      onSuccess: () => {
        setNotice(t('credentialsSaved'));
        setShowCredentialForm(false);
        setCredentialForm({
          clientId: '',
          clientSecret: '',
          username: '',
          password: '',
        });
      },
    },
  });

  const saveDevice = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    setNotice(null);
    const parsed = deviceSchema.safeParse(deviceForm);
    if (!parsed.success || !clinicId) {
      setFormError(t('validationError'));
      return;
    }
    const data = {
      clinicId,
      label: parsed.data.label,
      provider: parsed.data.provider,
      ...(parsed.data.terminalId ? { terminalId: parsed.data.terminalId } : {}),
      ...(parsed.data.merchantId ? { merchantId: parsed.data.merchantId } : {}),
      ...(parsed.data.host ? { host: parsed.data.host } : {}),
      ...(parsed.data.port ? { port: Number(parsed.data.port) } : {}),
      ...(parsed.data.deviceUniqueId
        ? { deviceUniqueId: parsed.data.deviceUniqueId }
        : {}),
    };
    if (isDemo) {
      setDemoDevices((current) => [
        ...current,
        {
          ...data,
          id: `demo-device-${current.length + 1}`,
          isActive: true,
          terminalId: data.terminalId ?? null,
          merchantId: data.merchantId ?? null,
          host: data.host ?? null,
          port: data.port ?? null,
          deviceUniqueId: data.deviceUniqueId ?? null,
          isDeleted: false,
          createdAt: '',
          updatedAt: '',
        },
      ]);
      setNotice(t('deviceSaved'));
      setShowDeviceForm(false);
      return;
    }
    registerDevice.mutate({ data });
  };

  const saveCredentials = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    setNotice(null);
    const parsed = credentialSchema.safeParse(credentialForm);
    if (!parsed.success || !clinicId) {
      setFormError(t('validationError'));
      return;
    }
    if (isDemo) {
      setNotice(t('credentialsSaved'));
      setShowCredentialForm(false);
      return;
    }
    registerCredentials.mutate({ data: { clinicId, ...parsed.data } });
  };

  const mutationError = registerDevice.error ?? registerCredentials.error;

  return (
    <main className="space-y-6 p-4 md:p-6 lg:p-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
            <Cable className="size-4" aria-hidden="true" />
            <span>{t('eyebrow')}</span>
            {isDemo && <Badge variant="outline">{t('demoData')}</Badge>}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t('title')}
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            {hasScope ? t('description') : t('noClinic')}
          </p>
        </div>
        {canManageDevices && hasScope && (
          <Button
            type="button"
            onClick={() => setShowDeviceForm((value) => !value)}
          >
            <Plus className="size-4" aria-hidden="true" />
            {t('addDevice')}
          </Button>
        )}
      </header>

      {notice && <Notice label={notice} />}
      {(Boolean(formError) || Boolean(mutationError)) && (
        <Notice error label={formError ?? t('saveError')} />
      )}

      {showDeviceForm && (
        <Card>
          <CardHeader>
            <CardTitle>{t('deviceFormTitle')}</CardTitle>
            <CardDescription>{t('deviceFormDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4 md:grid-cols-2" onSubmit={saveDevice}>
              <FormField label={t('label')}>
                <Input
                  value={deviceForm.label}
                  onChange={(event) =>
                    setDeviceForm((current) => ({
                      ...current,
                      label: event.target.value,
                    }))
                  }
                />
              </FormField>
              <FormField label={t('provider')}>
                <SelectInput
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={deviceForm.provider}
                  onChange={(event) =>
                    setDeviceForm((current) => ({
                      ...current,
                      provider: event.target.value as typeof current.provider,
                    }))
                  }
                >
                  <option value="IYZICO_TERMINAL">{t('providerIyzico')}</option>
                  <option value="PAX">{t('providerPax')}</option>
                </SelectInput>
              </FormField>
              {deviceForm.provider === 'IYZICO_TERMINAL' ? (
                <FormField label={t('deviceUniqueId')}>
                  <Input
                    value={deviceForm.deviceUniqueId}
                    onChange={(event) =>
                      setDeviceForm((current) => ({
                        ...current,
                        deviceUniqueId: event.target.value,
                      }))
                    }
                  />
                </FormField>
              ) : (
                <>
                  <FormField label={t('terminalId')}>
                    <Input
                      value={deviceForm.terminalId}
                      onChange={(event) =>
                        setDeviceForm((current) => ({
                          ...current,
                          terminalId: event.target.value,
                        }))
                      }
                    />
                  </FormField>
                  <FormField label={t('merchantId')}>
                    <Input
                      value={deviceForm.merchantId}
                      onChange={(event) =>
                        setDeviceForm((current) => ({
                          ...current,
                          merchantId: event.target.value,
                        }))
                      }
                    />
                  </FormField>
                  <FormField label={t('host')}>
                    <Input
                      value={deviceForm.host}
                      onChange={(event) =>
                        setDeviceForm((current) => ({
                          ...current,
                          host: event.target.value,
                        }))
                      }
                    />
                  </FormField>
                  <FormField label={t('port')}>
                    <Input
                      type="number"
                      value={deviceForm.port}
                      onChange={(event) =>
                        setDeviceForm((current) => ({
                          ...current,
                          port: event.target.value,
                        }))
                      }
                    />
                  </FormField>
                </>
              )}
              <div className="flex justify-end gap-2 md:col-span-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowDeviceForm(false)}
                >
                  {t('cancel')}
                </Button>
                <Button type="submit" disabled={registerDevice.isPending}>
                  {registerDevice.isPending && (
                    <Loader2 className="size-4 animate-spin" />
                  )}
                  {t('saveDevice')}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>{t('devicesTitle')}</CardTitle>
            <CardDescription>
              {t('devicesDescription', { count: devices.length })}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {devicesQuery.isPending && !isDemo ? (
              <Empty label={t('loading')} />
            ) : devicesQuery.isError && !isDemo ? (
              <Empty label={t('loadError')} />
            ) : devices.length ? (
              devices.map((device) => (
                <div
                  key={device.id}
                  className="flex items-center gap-3 rounded-xl border p-4"
                >
                  <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <CreditCard className="size-5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{device.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {device.provider === 'PAX'
                        ? t('providerPax')
                        : t('providerIyzico')}
                    </div>
                    {device.provider === 'PAX' && (
                      <div className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                        {t('paxConfigurationOnly')}
                      </div>
                    )}
                  </div>
                  <Badge variant={device.isActive ? 'secondary' : 'outline'}>
                    {device.isActive ? t('active') : t('inactive')}
                  </Badge>
                </div>
              ))
            ) : (
              <Empty label={t('empty')} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle>{t('credentialsTitle')}</CardTitle>
                <CardDescription>{t('credentialsDescription')}</CardDescription>
              </div>
              <KeyRound
                className="size-5 text-muted-foreground"
                aria-hidden="true"
              />
            </div>
          </CardHeader>
          <CardContent>
            {!canManageCredentials ? (
              <Empty label={t('noCredentialPermission')} />
            ) : !showCredentialForm ? (
              <div className="space-y-4">
                <div className="flex items-start gap-2 rounded-lg border bg-muted/30 p-3 text-sm">
                  <CheckCircle2
                    className="mt-0.5 size-4 text-emerald-600"
                    aria-hidden="true"
                  />
                  <span>{t('credentialsSecurity')}</span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => setShowCredentialForm(true)}
                >
                  {t('configureCredentials')}
                </Button>
              </div>
            ) : (
              <form className="space-y-3" onSubmit={saveCredentials}>
                <FormField label={t('clientId')}>
                  <Input
                    value={credentialForm.clientId}
                    onChange={(event) =>
                      setCredentialForm((current) => ({
                        ...current,
                        clientId: event.target.value,
                      }))
                    }
                  />
                </FormField>
                <FormField label={t('clientSecret')}>
                  <Input
                    type="password"
                    autoComplete="new-password"
                    value={credentialForm.clientSecret}
                    onChange={(event) =>
                      setCredentialForm((current) => ({
                        ...current,
                        clientSecret: event.target.value,
                      }))
                    }
                  />
                </FormField>
                <FormField label={t('username')}>
                  <Input
                    autoComplete="off"
                    value={credentialForm.username}
                    onChange={(event) =>
                      setCredentialForm((current) => ({
                        ...current,
                        username: event.target.value,
                      }))
                    }
                  />
                </FormField>
                <FormField label={t('password')}>
                  <Input
                    type="password"
                    autoComplete="new-password"
                    value={credentialForm.password}
                    onChange={(event) =>
                      setCredentialForm((current) => ({
                        ...current,
                        password: event.target.value,
                      }))
                    }
                  />
                </FormField>
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowCredentialForm(false)}
                  >
                    {t('cancel')}
                  </Button>
                  <Button
                    type="submit"
                    disabled={registerCredentials.isPending}
                  >
                    {registerCredentials.isPending && (
                      <Loader2 className="size-4 animate-spin" />
                    )}
                    {t('saveCredentials')}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
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

function Empty({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
      {label}
    </div>
  );
}

function Notice({ label, error = false }: { label: string; error?: boolean }) {
  return (
    <div
      className={
        error
          ? 'rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive'
          : 'rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300'
      }
    >
      {label}
    </div>
  );
}

function isUuid(value: string | null): value is string {
  return Boolean(
    value &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
  );
}

const initialDemoDevices: PosDeviceResponseDto[] = [
  {
    id: 'demo-terminal',
    clinicId: 'clinic_fethiye',
    label: 'Resepsiyon POS',
    provider: 'IYZICO_TERMINAL',
    isActive: true,
    terminalId: null,
    merchantId: null,
    host: null,
    port: null,
    deviceUniqueId: 'DEVICE-01',
    isDeleted: false,
    createdAt: '',
    updatedAt: '',
  },
];
