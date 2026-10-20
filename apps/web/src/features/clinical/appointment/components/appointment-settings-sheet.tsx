'use client';

import { useEffect, useState } from 'react';
import { Check, Settings2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ManagedSheet from '@/components/ui/managed-sheet';
import { useAuth } from '@/data/auth/auth-context';
import { useClinicUpdateAppointmentSettings } from '@/api/generated/clinic-command/clinic-command';
import type { UpdateClinicAppointmentSettingsDto } from '@/api/generated/model';
import {
  clinicAppointmentSettingsQueryKey,
  useClinicAppointmentSettings,
} from '@/features/clinical/appointment/api/use-clinic-appointment-settings';
import { mockClinicAppointmentSettings } from '@/features/clinical/appointment/api/mock-clinic-appointment-settings';

const DEFAULT_SETTINGS: Required<UpdateClinicAppointmentSettingsDto> = {
  allowPatientBooking: true,
  rescheduleLimitHours: 6,
  cancelLimitHours: 24,
  allowPatientCancel: true,
  staffAllowOverbooking: true,
  sendSmsReminderHours: 24,
  maxActivePatientBookings: 3,
  requireReminderResponse: false,
  requireConfirmation: false,
  maxFutureBookingDays: 90,
  slotDurationMinutes: 30,
};

type Settings = Required<UpdateClinicAppointmentSettingsDto>;
type NumberSetting = Exclude<
  keyof Settings,
  | 'allowPatientBooking'
  | 'allowPatientCancel'
  | 'staffAllowOverbooking'
  | 'requireReminderResponse'
  | 'requireConfirmation'
>;

function SettingToggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? 'bg-primary' : 'bg-muted-foreground/30'}`}
      >
        <span
          className={`absolute top-0.5 flex size-5 items-center justify-center rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-[22px]' : 'translate-x-0.5'}`}
        >
          {checked && <Check className="size-3 text-primary" />}
        </span>
      </button>
    </div>
  );
}

function NumberSettingField({
  label,
  description,
  value,
  min = 0,
  onChange,
}: {
  label: string;
  description: string;
  value: number;
  min?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="grid gap-1.5 py-3 sm:grid-cols-[1fr_112px] sm:items-center sm:gap-4">
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">
          {description}
        </span>
      </span>
      <Input
        type="number"
        min={min}
        value={value}
        onChange={(event) =>
          onChange(Math.max(min, Number(event.target.value) || min))
        }
        className="h-9"
      />
    </label>
  );
}

export function AppointmentSettingsSheet() {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [message, setMessage] = useState('');
  const { claims } = useAuth();
  const queryClient = useQueryClient();
  const mockingEnabled = process.env.NEXT_PUBLIC_API_MOCKING === 'enabled';
  const settingsQuery = useClinicAppointmentSettings(claims.clinicId);
  const updateSettings = useClinicUpdateAppointmentSettings({
    mutation: {
      onSuccess: () =>
        queryClient.invalidateQueries({
          queryKey: clinicAppointmentSettingsQueryKey(claims.clinicId),
        }),
    },
  });

  useEffect(() => {
    if (settingsQuery.data?.data) {
      setSettings(settingsQuery.data.data);
    }
  }, [settingsQuery.data]);

  const updateNumber = (key: NumberSetting, value: number) => {
    setSettings((current) => ({ ...current, [key]: value }));
    setMessage('');
  };
  const updateToggle = (
    key:
      | 'allowPatientBooking'
      | 'allowPatientCancel'
      | 'staffAllowOverbooking'
      | 'requireReminderResponse'
      | 'requireConfirmation',
    value: boolean
  ) => {
    setSettings((current) => ({ ...current, [key]: value }));
    setMessage('');
  };

  const save = async () => {
    if (!settingsQuery.data?.data) {
      setMessage('Klinik randevu ayarları yüklenemedi.');
      return;
    }

    try {
      if (mockingEnabled) {
        const mockSettings = { ...settings, clinicId: claims.clinicId };
        mockClinicAppointmentSettings.set(claims.clinicId, mockSettings);
        queryClient.setQueryData(
          clinicAppointmentSettingsQueryKey(claims.clinicId),
          { data: mockSettings }
        );
        setMessage('Randevu ayarları kaydedildi.');
        return;
      }

      await updateSettings.mutateAsync({
        id: claims.clinicId,
        data: settings as UpdateClinicAppointmentSettingsDto,
      });
      setMessage('Randevu ayarları kaydedildi.');
    } catch {
      setMessage('Ayarlar kaydedilemedi. Lütfen tekrar deneyin.');
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Settings2 data-icon="inline-start" />
        Randevu ayarları
      </Button>
      <ManagedSheet
        open={open}
        onOpenChange={setOpen}
        side="right"
        className="w-full overflow-y-auto sm:max-w-xl"
      >
        <ManagedSheet.Header
          title="Randevu ayarları"
          description="Hasta rezervasyonlarını, klinik onay akışını ve hatırlatmaları düzenleyin."
        >
          <ManagedSheet.Settings />
          <ManagedSheet.Close />
        </ManagedSheet.Header>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
          {settingsQuery.isLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Randevu ayarları yükleniyor…
            </p>
          ) : settingsQuery.isError ? (
            <p
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
            >
              Klinik randevu ayarları alınamadı. Daha sonra tekrar deneyin.
            </p>
          ) : (
            <>
              <section>
                <h3 className="text-sm font-semibold">
                  Hasta portalı ve yapay zeka
                </h3>
                <div className="mt-2 divide-y rounded-lg border px-3">
                  <SettingToggle
                    label="Hasta randevu oluşturabilsin"
                    description="Hastalar portal veya yapay zeka asistanı üzerinden kendi randevularını alabilir."
                    checked={settings.allowPatientBooking}
                    onChange={(value) =>
                      updateToggle('allowPatientBooking', value)
                    }
                  />
                  {settings.allowPatientBooking && (
                    <>
                      <NumberSettingField
                        label="Randevu slot süresi"
                        description="Hasta portalı ve yapay zeka üzerinden alınan muayene randevuları kaç dakikalık aralıklarla açılsın?"
                        value={settings.slotDurationMinutes}
                        min={5}
                        onChange={(value) =>
                          updateNumber('slotDurationMinutes', value)
                        }
                      />
                      <SettingToggle
                        label="Hasta randevusunu iptal edebilsin"
                        description="İptal süresi sınırına uyulduğunda hasta iptal yapabilir."
                        checked={settings.allowPatientCancel}
                        onChange={(value) =>
                          updateToggle('allowPatientCancel', value)
                        }
                      />
                      <NumberSettingField
                        label="İptal için en az süre"
                        description="Randevudan kaç saat öncesine kadar iptal edilebilir?"
                        value={settings.cancelLimitHours}
                        onChange={(value) =>
                          updateNumber('cancelLimitHours', value)
                        }
                      />
                      <NumberSettingField
                        label="Erteleme için en az süre"
                        description="Randevudan kaç saat öncesine kadar ertelenebilir?"
                        value={settings.rescheduleLimitHours}
                        onChange={(value) =>
                          updateNumber('rescheduleLimitHours', value)
                        }
                      />
                      <NumberSettingField
                        label="Aktif randevu limiti"
                        description="Bir hastanın aynı anda sahip olabileceği ileri tarihli randevu sayısı."
                        value={settings.maxActivePatientBookings}
                        min={1}
                        onChange={(value) =>
                          updateNumber('maxActivePatientBookings', value)
                        }
                      />
                      <NumberSettingField
                        label="İleri tarih sınırı"
                        description="Kaç gün sonrasına kadar randevu alınabilir?"
                        value={settings.maxFutureBookingDays}
                        min={1}
                        onChange={(value) =>
                          updateNumber('maxFutureBookingDays', value)
                        }
                      />
                      <SettingToggle
                        label="Sekreter onayı gerektir"
                        description="Hasta portalı veya yapay zeka üzerinden alınan yeni randevular onaylanana kadar beklemede kalsın."
                        checked={settings.requireConfirmation}
                        onChange={(value) =>
                          updateToggle('requireConfirmation', value)
                        }
                      />
                    </>
                  )}
                </div>
              </section>

              <section>
                <h3 className="text-sm font-semibold">Klinik randevu akışı</h3>
                <div className="mt-2 divide-y rounded-lg border px-3">
                  <SettingToggle
                    label="Çakışan randevuya izin ver"
                    description="Personel aynı hekime veya koltuğa çakışan randevu ekleyebilir."
                    checked={settings.staffAllowOverbooking}
                    onChange={(value) =>
                      updateToggle('staffAllowOverbooking', value)
                    }
                  />
                </div>
              </section>

              <section>
                <h3 className="text-sm font-semibold">Hatırlatmalar</h3>
                <div className="mt-2 divide-y rounded-lg border px-3">
                  <NumberSettingField
                    label="SMS hatırlatma zamanı"
                    description="Randevudan kaç saat önce SMS gönderilsin? 0 değeri kapatır."
                    value={settings.sendSmsReminderHours}
                    onChange={(value) =>
                      updateNumber('sendSmsReminderHours', value)
                    }
                  />
                  <SettingToggle
                    label="Hasta yanıtı iste"
                    description="Hatırlatma SMS'inden sonra hastadan katılım yanıtı bekle."
                    checked={settings.requireReminderResponse}
                    onChange={(value) =>
                      updateToggle('requireReminderResponse', value)
                    }
                  />
                </div>
              </section>
            </>
          )}
          <p
            aria-live="polite"
            className="min-h-5 text-sm text-muted-foreground"
          >
            {message}
          </p>
        </div>

        <ManagedSheet.Footer>
          <Button
            className="w-full"
            onClick={save}
            disabled={updateSettings.isPending || !settingsQuery.data?.data}
          >
            {updateSettings.isPending
              ? 'Kaydediliyor…'
              : 'Değişiklikleri kaydet'}
          </Button>
        </ManagedSheet.Footer>
      </ManagedSheet>
    </>
  );
}
