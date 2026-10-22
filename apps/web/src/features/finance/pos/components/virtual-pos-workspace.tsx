'use client';

import { SelectInput } from '@/components/ui/select-input';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { z } from 'zod';
import { CheckCircle2, CreditCard, Loader2, ShieldCheck } from 'lucide-react';

import { useClinicPaymentGatewayRegisterSubMerchant } from '@/api/generated/clinic-payment-gateway-command/clinic-payment-gateway-command';
import {
  getClinicPaymentGatewayGetQueryKey,
  useClinicPaymentGatewayGet,
} from '@/api/generated/clinic-payment-gateway-query/clinic-payment-gateway-query';
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

const subMerchantSchema = z.object({
  subMerchantType: z.enum([
    'PERSONAL',
    'PRIVATE_COMPANY',
    'LIMITED_OR_JOINT_STOCK_COMPANY',
  ]),
  legalCompanyTitle: z.string().trim().min(2),
  name: z.string().trim().min(2),
  email: z.email(),
  gsmNumber: z.string().trim().min(10),
  iban: z.string().refine((value) => {
    const normalized = value.replace(/\s/g, '');
    return normalized.length >= 26 && normalized.length <= 34;
  }),
  identityNumber: z.string().trim().min(10).max(11),
  address: z.string().trim().min(5),
  taxOffice: z.string().trim(),
});

type MerchantForm = {
  subMerchantType:
    | 'PERSONAL'
    | 'PRIVATE_COMPANY'
    | 'LIMITED_OR_JOINT_STOCK_COMPANY';
  legalCompanyTitle: string;
  name: string;
  email: string;
  gsmNumber: string;
  iban: string;
  identityNumber: string;
  address: string;
  taxOffice: string;
};

const emptyForm: MerchantForm = {
  subMerchantType: 'LIMITED_OR_JOINT_STOCK_COMPANY',
  legalCompanyTitle: '',
  name: '',
  email: '',
  gsmNumber: '',
  iban: '',
  identityNumber: '',
  address: '',
  taxOffice: '',
};

export function VirtualPosWorkspace() {
  if (process.env.NEXT_PUBLIC_API_MOCKING === 'enabled') {
    return <MockVirtualPos />;
  }
  return (
    <AuthProvider>
      <LiveVirtualPos />
    </AuthProvider>
  );
}

function MockVirtualPos() {
  const { selectedClinicId, hasHydrated } = useMockAuth();
  return (
    <VirtualPosContent
      clinicId={selectedClinicId}
      status={hasHydrated ? 'authenticated' : 'loading'}
      canManage
      isDemo
    />
  );
}

function LiveVirtualPos() {
  const { actor, status } = useAuth();
  return (
    <VirtualPosContent
      clinicId={actor?.clinicId ?? null}
      status={status}
      canManage={actorHasCapability(actor, 'clinicpaymentgateway:update')}
      isDemo={false}
    />
  );
}

function VirtualPosContent({
  clinicId,
  status,
  canManage,
  isDemo,
}: {
  clinicId: string | null;
  status: AuthStatus;
  canManage: boolean;
  isDemo: boolean;
}) {
  const t = useTranslations('FinancePos.virtual');
  const queryClient = useQueryClient();
  const hasScope =
    status === 'authenticated' &&
    (isDemo ? Boolean(clinicId) : isUuid(clinicId));
  const [form, setForm] = useState<MerchantForm>(emptyForm);
  const [editing, setEditing] = useState(false);
  const [demoConfigured, setDemoConfigured] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const gatewayQuery = useClinicPaymentGatewayGet(clinicId ?? '', {
    query: { enabled: hasScope && !isDemo, retry: false },
  });
  const gateway = isDemo
    ? demoConfigured
      ? { iyzicoSubMerchantKey: 'subMerchantKey••••9472' }
      : null
    : ((gatewayQuery.data?.data ?? null) as {
        iyzicoSubMerchantKey?: string;
      } | null);
  const register = useClinicPaymentGatewayRegisterSubMerchant({
    mutation: {
      retry: false,
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: getClinicPaymentGatewayGetQueryKey(clinicId ?? ''),
        });
        setNotice(t('saved'));
        setEditing(false);
        setForm(emptyForm);
      },
    },
  });

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    setNotice(null);
    const parsed = subMerchantSchema.safeParse(form);
    if (!parsed.success || !clinicId) {
      setFormError(t('validationError'));
      return;
    }
    const data = {
      ...parsed.data,
      iban: parsed.data.iban.replace(/\s/g, ''),
      ...(parsed.data.taxOffice ? { taxOffice: parsed.data.taxOffice } : {}),
    };
    if (isDemo) {
      setDemoConfigured(true);
      setEditing(false);
      setNotice(t('saved'));
      return;
    }
    register.mutate({ clinicId, data });
  };

  return (
    <main className="space-y-6 p-4 md:p-6 lg:p-8">
      <header>
        <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
          <CreditCard className="size-4" aria-hidden="true" />
          <span>{t('eyebrow')}</span>
          {isDemo && <Badge variant="outline">{t('demoData')}</Badge>}
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          {hasScope ? t('description') : t('noClinic')}
        </p>
      </header>

      {notice && <Notice label={notice} />}
      {(formError || register.isError) && (
        <Notice error label={formError ?? t('saveError')} />
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_1.4fr]">
        <Card>
          <CardHeader>
            <CardTitle>{t('statusTitle')}</CardTitle>
            <CardDescription>{t('statusDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {gatewayQuery.isPending && !isDemo ? (
              <Empty label={t('loading')} />
            ) : gatewayQuery.isError && !isDemo ? (
              <Empty label={t('loadError')} />
            ) : gateway ? (
              <>
                <div className="flex items-start gap-3 rounded-xl border bg-emerald-500/5 p-4">
                  <CheckCircle2
                    className="mt-0.5 size-5 text-emerald-600"
                    aria-hidden="true"
                  />
                  <div>
                    <div className="font-medium">{t('configured')}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {t('configuredDescription')}
                    </div>
                  </div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">
                    {t('subMerchantKey')}
                  </div>
                  <div className="mt-1 font-mono text-sm">
                    {maskSecret(gateway.iyzicoSubMerchantKey)}
                  </div>
                </div>
              </>
            ) : (
              <Empty label={t('notConfigured')} />
            )}
            {canManage && hasScope && !editing && (
              <Button
                type="button"
                className="w-full"
                onClick={() => setEditing(true)}
              >
                {gateway ? t('update') : t('configure')}
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle>{t('securityTitle')}</CardTitle>
                <CardDescription>{t('securityDescription')}</CardDescription>
              </div>
              <ShieldCheck
                className="size-5 text-muted-foreground"
                aria-hidden="true"
              />
            </div>
          </CardHeader>
          <CardContent>
            {!editing ? (
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>{t('providerManaged')}</p>
                <p>{t('noRawCredentials')}</p>
              </div>
            ) : (
              <form className="grid gap-4 md:grid-cols-2" onSubmit={submit}>
                <FormField label={t('merchantType')}>
                  <SelectInput
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={form.subMerchantType}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        subMerchantType: event.target
                          .value as typeof current.subMerchantType,
                      }))
                    }
                  >
                    <option value="PERSONAL">{t('type.PERSONAL')}</option>
                    <option value="PRIVATE_COMPANY">
                      {t('type.PRIVATE_COMPANY')}
                    </option>
                    <option value="LIMITED_OR_JOINT_STOCK_COMPANY">
                      {t('type.LIMITED_OR_JOINT_STOCK_COMPANY')}
                    </option>
                  </SelectInput>
                </FormField>
                <FormField label={t('legalTitle')}>
                  <Input
                    value={form.legalCompanyTitle}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        legalCompanyTitle: event.target.value,
                      }))
                    }
                  />
                </FormField>
                <FormField label={t('authorizedName')}>
                  <Input
                    value={form.name}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                  />
                </FormField>
                <FormField label={t('identityNumber')}>
                  <Input
                    value={form.identityNumber}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        identityNumber: event.target.value,
                      }))
                    }
                  />
                </FormField>
                <FormField label={t('email')}>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        email: event.target.value,
                      }))
                    }
                  />
                </FormField>
                <FormField label={t('phone')}>
                  <Input
                    value={form.gsmNumber}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        gsmNumber: event.target.value,
                      }))
                    }
                  />
                </FormField>
                <FormField label={t('iban')} className="md:col-span-2">
                  <Input
                    value={form.iban}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        iban: event.target.value,
                      }))
                    }
                  />
                </FormField>
                <FormField label={t('taxOffice')}>
                  <Input
                    value={form.taxOffice}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        taxOffice: event.target.value,
                      }))
                    }
                  />
                </FormField>
                <FormField label={t('address')}>
                  <Input
                    value={form.address}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        address: event.target.value,
                      }))
                    }
                  />
                </FormField>
                <div className="flex justify-end gap-2 md:col-span-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEditing(false)}
                  >
                    {t('cancel')}
                  </Button>
                  <Button type="submit" disabled={register.isPending}>
                    {register.isPending && (
                      <Loader2 className="size-4 animate-spin" />
                    )}
                    {t('save')}
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
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={className}>
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

function maskSecret(value: string | undefined): string {
  if (!value) return '—';
  return value.length <= 4 ? '••••' : `••••${value.slice(-4)}`;
}

function isUuid(value: string | null): value is string {
  return Boolean(
    value &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
  );
}
