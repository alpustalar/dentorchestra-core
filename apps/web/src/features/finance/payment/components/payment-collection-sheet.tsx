'use client';

import { SelectInput } from '@/components/ui/select-input';

import { useEffect, useMemo, useState } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { z } from 'zod';
import {
  CreditCard,
  ExternalLink,
  Loader2,
  ReceiptText,
  X,
} from 'lucide-react';

import { useIyzicoInitCheckout } from '@/api/generated/iyzico-command/iyzico-command';
import { useIyzicoTerminalSale } from '@/api/generated/iyzico-terminal-command/iyzico-terminal-command';
import type {
  PartyResponseDto,
  PosDeviceResponseDto,
} from '@/api/generated/model';
import { usePosDeviceFindByClinic } from '@/api/generated/pos-device-query/pos-device-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

const collectionSchema = z.object({
  amount: z.coerce.number().positive().multipleOf(0.01),
  purpose: z.string().trim().min(2).max(200),
  appointmentId: z.union([z.literal(''), z.uuid()]),
  channel: z.enum(['PHYSICAL_POS', 'VIRTUAL_POS']),
  deviceId: z.string(),
  currency: z.enum(['TRY', 'USD', 'EUR', 'GBP']),
});

type CollectionResult = {
  posTransactionId?: string;
  status?: string;
  approved?: boolean;
};

export type CompletedPaymentCollection = {
  partyId: string;
  patientId: string;
  partyName: string;
  amount: number;
  currency: string;
};

const emptyDevices: PosDeviceResponseDto[] = [];

export function PaymentCollectionSheet({
  party,
  clinicId,
  open,
  isDemo,
  onOpenChange,
  onCompleted,
}: {
  party: PartyResponseDto | null;
  clinicId: string;
  open: boolean;
  isDemo: boolean;
  onOpenChange: (open: boolean) => void;
  onCompleted?: (collection: CompletedPaymentCollection) => void;
}) {
  const t = useTranslations('FinancePayment');
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState('');
  const [purpose, setPurpose] = useState('');
  const [appointmentId, setAppointmentId] = useState('');
  const [channel, setChannel] = useState<'PHYSICAL_POS' | 'VIRTUAL_POS'>(
    'PHYSICAL_POS'
  );
  const [currency, setCurrency] = useState<'TRY' | 'USD' | 'EUR' | 'GBP'>(
    'TRY'
  );
  const [deviceId, setDeviceId] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const devicesQuery = usePosDeviceFindByClinic(clinicId, {
    query: {
      enabled: open && !isDemo && Boolean(clinicId),
      retry: false,
    },
  });
  const liveDevices = devicesQuery.data?.data ?? emptyDevices;
  const physicalDevices = useMemo(
    () =>
      (isDemo ? demoDevices : liveDevices).filter(
        (device) =>
          device.provider === 'IYZICO_TERMINAL' &&
          device.isActive &&
          !device.isDeleted
      ),
    [isDemo, liveDevices]
  );

  useEffect(() => {
    if (!open) return;
    setDeviceId((current) =>
      physicalDevices.some((device) => device.id === current)
        ? current
        : (physicalDevices[0]?.id ?? '')
    );
  }, [open, physicalDevices]);

  useEffect(() => {
    setAmount('');
    setPurpose('');
    setAppointmentId('');
    setNotice(null);
    setValidationError(null);
  }, [party?.id]);

  useEffect(() => {
    if (channel === 'VIRTUAL_POS') setCurrency('TRY');
  }, [channel]);

  const virtualCheckout = useIyzicoInitCheckout({
    mutation: {
      retry: false,
      onSuccess: async (response) => {
        const paymentPageUrl = readString(response, 'paymentPageUrl');
        if (!paymentPageUrl) {
          setValidationError(t('unexpectedResponse'));
          return;
        }
        await invalidatePaymentData(queryClient, patientId);
        setNotice(t('virtualRedirect'));
        window.location.assign(paymentPageUrl);
      },
    },
  });
  const terminalSale = useIyzicoTerminalSale({
    mutation: {
      retry: false,
      onSuccess: async (rawResponse, variables) => {
        const response = (rawResponse ?? {}) as CollectionResult;
        if (response.status === 'FAILED' || response.approved === false) {
          setValidationError(t('physicalFailed'));
          return;
        }
        await invalidatePaymentData(queryClient, variables.data.patientId);
        setNotice(
          response.status === 'PENDING'
            ? t('physicalPending')
            : t('physicalSuccess')
        );
        if (response.status !== 'PENDING' && party && patientId) {
          onCompleted?.({
            partyId: party.id,
            patientId,
            partyName: party.name,
            amount: variables.data.amount,
            currency: variables.data.currency,
          });
        }
      },
    },
  });

  const isPending = virtualCheckout.isPending || terminalSale.isPending;
  const patientId =
    party?.originType === 'PATIENT' ? (party.originId ?? '') : '';
  const canCollect = Boolean(party && patientId);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice(null);
    setValidationError(null);

    const parsed = collectionSchema.safeParse({
      amount,
      purpose,
      appointmentId,
      channel,
      deviceId,
      currency,
    });
    if (!parsed.success) {
      setValidationError(t('validationError'));
      return;
    }
    if (!party || !patientId) {
      setValidationError(t('patientRequired'));
      return;
    }
    if (parsed.data.channel === 'PHYSICAL_POS' && !parsed.data.deviceId) {
      setValidationError(t('deviceRequired'));
      return;
    }
    if (
      parsed.data.channel === 'VIRTUAL_POS' &&
      (!party.phone || party.phone.length < 7)
    ) {
      setValidationError(t('phoneRequired'));
      return;
    }

    if (isDemo) {
      setNotice(
        parsed.data.channel === 'VIRTUAL_POS'
          ? t('demoVirtualSuccess')
          : t('demoPhysicalSuccess')
      );
      if (parsed.data.channel === 'PHYSICAL_POS') {
        onCompleted?.({
          partyId: party.id,
          patientId,
          partyName: party.name,
          amount: parsed.data.amount,
          currency: parsed.data.currency,
        });
      }
      return;
    }

    if (parsed.data.channel === 'VIRTUAL_POS') {
      virtualCheckout.mutate({
        data: {
          clinicId,
          patientId,
          amount: parsed.data.amount,
          patientName: party.name,
          patientPhone: party.phone!,
          ...(party.email ? { patientEmail: party.email } : {}),
          ...(parsed.data.appointmentId
            ? { appointmentId: parsed.data.appointmentId }
            : {}),
          treatmentName: parsed.data.purpose,
        },
      });
      return;
    }

    terminalSale.mutate({
      data: {
        clinicId,
        posDeviceId: parsed.data.deviceId,
        patientId,
        amount: parsed.data.amount,
        currency: parsed.data.currency,
        ...(parsed.data.appointmentId
          ? { appointmentId: parsed.data.appointmentId }
          : {}),
      },
    });
  };

  const mutationError = virtualCheckout.error ?? terminalSale.error;

  return (
    <Sheet
      open={open}
      onOpenChange={(nextOpen) => {
        if (!isPending) onOpenChange(nextOpen);
      }}
    >
      <SheetContent
        className="w-full overflow-y-auto sm:max-w-xl"
        showCloseButton={false}
      >
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="absolute right-3 top-3"
          aria-label={t('close')}
          title={t('close')}
          disabled={isPending}
          onClick={() => onOpenChange(false)}
        >
          <X className="size-4" aria-hidden="true" />
        </Button>
        <SheetHeader className="border-b px-5 py-5 pr-14">
          <SheetTitle>{t('collectTitle')}</SheetTitle>
          <SheetDescription>
            {party
              ? t('collectDescription', { name: party.name })
              : t('selectParty')}
          </SheetDescription>
        </SheetHeader>

        <form className="space-y-5 p-5" onSubmit={submit}>
          {!canCollect && <Notice error label={t('patientRequired')} />}

          <div className="grid grid-cols-2 gap-2">
            {(['PHYSICAL_POS', 'VIRTUAL_POS'] as const).map((item) => (
              <Button
                key={item}
                type="button"
                variant={channel === item ? 'default' : 'outline'}
                className="h-auto min-h-20 flex-col gap-1"
                aria-pressed={channel === item}
                onClick={() => setChannel(item)}
              >
                {item === 'PHYSICAL_POS' ? (
                  <CreditCard className="size-5" aria-hidden="true" />
                ) : (
                  <ExternalLink className="size-5" aria-hidden="true" />
                )}
                {t(`channel.${item}`)}
              </Button>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={t('amount')} className="sm:col-span-2">
              <Input
                type="number"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder={t('amountPlaceholder')}
                disabled={isPending}
              />
            </Field>
            <Field label={t('currency')}>
              <SelectInput
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={currency}
                onChange={(event) =>
                  setCurrency(event.target.value as typeof currency)
                }
                disabled={isPending || channel === 'VIRTUAL_POS'}
              >
                {(['TRY', 'USD', 'EUR', 'GBP'] as const).map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </SelectInput>
            </Field>
          </div>

          <Field
            label={t('purpose')}
            hint={
              channel === 'PHYSICAL_POS'
                ? t('purposeHintPhysical')
                : t('purposeHint')
            }
          >
            <Input
              value={purpose}
              onChange={(event) => setPurpose(event.target.value)}
              placeholder={t('purposePlaceholder')}
              maxLength={200}
              disabled={isPending}
            />
          </Field>

          <Field label={t('appointmentId')} hint={t('appointmentHint')}>
            <Input
              value={appointmentId}
              onChange={(event) => setAppointmentId(event.target.value.trim())}
              placeholder={t('appointmentPlaceholder')}
              disabled={isPending}
            />
          </Field>

          {channel === 'PHYSICAL_POS' && (
            <Field label={t('device')}>
              <SelectInput
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={deviceId}
                onChange={(event) => setDeviceId(event.target.value)}
                disabled={isPending || devicesQuery.isPending}
              >
                <option value="">{t('selectDevice')}</option>
                {physicalDevices.map((device) => (
                  <option key={device.id} value={device.id}>
                    {device.label}
                  </option>
                ))}
              </SelectInput>
              {!devicesQuery.isPending && physicalDevices.length === 0 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {t('noPhysicalDevice')}
                </p>
              )}
            </Field>
          )}

          <div className="rounded-xl border bg-muted/30 p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium">
              <ReceiptText className="size-4" aria-hidden="true" />
              {t('accountingTitle')}
            </div>
            <p className="text-xs leading-5 text-muted-foreground">
              {channel === 'PHYSICAL_POS'
                ? t('physicalAccountingDescription')
                : t('virtualAccountingDescription')}
            </p>
          </div>

          {validationError && <Notice error label={validationError} />}
          {Boolean(mutationError) && <Notice error label={t('submitError')} />}
          {notice && <Notice label={notice} />}

          <div className="flex items-center justify-between gap-3 border-t pt-4">
            <Badge variant="outline">{t('secureFlow')}</Badge>
            <Button
              type="submit"
              disabled={
                !canCollect ||
                isPending ||
                (channel === 'PHYSICAL_POS' && physicalDevices.length === 0)
              }
            >
              {isPending && (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              )}
              {isPending ? t('processing') : t('collect')}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function Field({
  label,
  hint,
  className,
  children,
}: {
  label: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={className}>
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      {children}
      {hint && (
        <span className="mt-1.5 block text-xs text-muted-foreground">
          {hint}
        </span>
      )}
    </label>
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

function readString(value: unknown, key: string): string | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = (value as Record<string, unknown>)[key];
  return typeof candidate === 'string' && candidate ? candidate : null;
}

const demoDevices: PosDeviceResponseDto[] = [
  {
    id: 'demo-iyzico-terminal',
    clinicId: 'clinic_fethiye',
    label: 'Resepsiyon İyzico POS',
    provider: 'IYZICO_TERMINAL',
    isActive: true,
    terminalId: 'TERM-01',
    merchantId: null,
    host: null,
    port: null,
    deviceUniqueId: 'DEVICE-01',
    isDeleted: false,
    createdAt: '',
    updatedAt: '',
  },
];

async function invalidatePaymentData(
  queryClient: QueryClient,
  patientId?: string
) {
  const invalidations = [
    queryClient.invalidateQueries({
      queryKey: ['/api/v1/payment/reports/ar-aging'],
    }),
    queryClient.invalidateQueries({
      queryKey: ['/api/v1/payment/reports/provider-revenue'],
    }),
  ];

  if (patientId) {
    invalidations.push(
      queryClient.invalidateQueries({
        queryKey: [`/api/v1/finance/finance-ledger/patient/${patientId}`],
      }),
      queryClient.invalidateQueries({
        queryKey: [
          `/api/v1/finance/finance-ledger/patient/${patientId}/summary`,
        ],
      })
    );
  }

  await Promise.all(invalidations);
}
