'use client';

import { SelectInput } from '@/components/ui/select-input';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { DateTimeManager } from '@shared/common';
import type { CalendarAppointment } from '@/features/clinical/appointment/calendar-appointment.types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { ScheduleDayColumn } from './schedule-day-column';
import {
  CALENDAR_SLOT_DURATIONS,
  CALENDAR_TIMELINE,
  type CalendarDay,
  type CalendarSelection,
} from './calendar-selection';

type Props = {
  days: CalendarDay[];
  items: CalendarAppointment[];
  onRangeConfirm: (selection: CalendarSelection) => void;
  onAppointmentClick: (item: CalendarAppointment) => void;
  allowOverbooking: boolean;
  resizeEnabled: boolean;
  onResizeEnabledChange: (enabled: boolean) => void;
  slotDurationMinutes: number;
  onSlotDurationMinutesChange: (minutes: number) => void;
  canResizeAppointments: boolean;
  isSaving: boolean;
  isRefreshing: boolean;
  onRefresh: () => void;
  feedback?: { kind: 'error' | 'status'; message: string };
  onAppointmentResize: (
    item: CalendarAppointment,
    range: CalendarSelection
  ) => Promise<void>;
};

const { startMinute, endMinute, hourHeight } = CALENDAR_TIMELINE;
const pixelsPerMinute = hourHeight / 60;
const height = (endMinute - startMinute) * pixelsPerMinute;
const hours = Array.from(
  { length: (endMinute - startMinute) / 60 + 1 },
  (_, index) => startMinute + index * 60
);

export function ScheduleGrid({
  days,
  items,
  onRangeConfirm,
  onAppointmentClick,
  allowOverbooking,
  resizeEnabled,
  onResizeEnabledChange,
  slotDurationMinutes,
  onSlotDurationMinutesChange,
  canResizeAppointments,
  isSaving,
  isRefreshing,
  onRefresh,
  feedback,
  onAppointmentResize,
}: Props) {
  const t = useTranslations('AppointmentCalendar');
  const [selection, setSelection] = React.useState<CalendarSelection | null>(
    null
  );
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [isInteracting, setIsInteracting] = React.useState(false);
  const gridTemplateColumns = `72px repeat(${days.length}, minmax(150px, 1fr))`;

  return (
    <Card
      className="overflow-hidden"
      onKeyDown={(event) => {
        if (event.key === 'Escape') setSelection(null);
      }}
    >
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 border-b bg-muted/20 py-3">
        <CardTitle className="text-base">{t('title')}</CardTitle>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
            <Switch
              checked={resizeEnabled}
              disabled={isInteracting || isSaving}
              onCheckedChange={(enabled) => {
                setSelection(null);
                onResizeEnabledChange(enabled);
              }}
              aria-label={t('enableHandles')}
            />
            {t('enableHandles')}
          </label>
          {!resizeEnabled && (
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <span>{t('slotDuration')}</span>
              <SelectInput
                className="h-9 rounded-md border bg-background px-2 text-sm"
                value={slotDurationMinutes}
                disabled={isInteracting || isSaving}
                onChange={(event) => {
                  setSelection(null);
                  onSlotDurationMinutesChange(Number(event.target.value));
                }}
                aria-label={t('slotDuration')}
              >
                {CALENDAR_SLOT_DURATIONS.map((minutes) => (
                  <option key={minutes} value={minutes}>
                    {t('slotDurationOption', { minutes })}
                  </option>
                ))}
              </SelectInput>
            </label>
          )}
        </div>
      </CardHeader>
      {feedback?.message && (
        <div className="border-b bg-primary/5 px-4 py-2">
          <output
            aria-live="polite"
            role={feedback.kind === 'error' ? 'alert' : 'status'}
            className="max-w-full min-w-0 truncate text-sm font-medium tabular-nums"
          >
            {feedback.message}
          </output>
        </div>
      )}
      <CardContent className="overflow-auto p-0">
        <div className="min-w-[760px]">
          <div
            className="grid border-b bg-muted/10"
            style={{ gridTemplateColumns }}
          >
            <div className="border-r p-3 text-xs text-muted-foreground">
              {t('time')}
            </div>
            {days.map((day) => (
              <div
                key={day.date}
                className="border-r p-3 text-sm font-medium last:border-r-0"
              >
                {day.label}
              </div>
            ))}
          </div>
          <div
            ref={scrollRef}
            className="relative max-h-[600px] overflow-y-auto"
          >
            <div className="grid" style={{ gridTemplateColumns }}>
              <div className="relative border-r" style={{ height }}>
                {hours.map((minute) => (
                  <div
                    key={minute}
                    className="absolute inset-x-0 px-3 text-xs text-muted-foreground"
                    style={{
                      top: Math.min(
                        height - 16,
                        (minute - startMinute) * pixelsPerMinute + 4
                      ),
                    }}
                  >
                    {DateTimeManager.minutesToHHMM(minute)}
                  </div>
                ))}
              </div>
              {days.map((day) => {
                const midnight = DateTimeManager.fromLocalDateTime(
                  day.date,
                  '00:00'
                );
                const nextDay = DateTimeManager.addDays(midnight, 1);
                return (
                  <ScheduleDayColumn
                    key={day.date}
                    day={day}
                    items={items.filter(
                      (item) =>
                        item.startTime < nextDay && item.endTime > midnight
                    )}
                    selection={selection}
                    scrollRef={scrollRef}
                    onSelectionChange={setSelection}
                    slotDurationMinutes={slotDurationMinutes}
                    onRangeConfirm={onRangeConfirm}
                    actionsDisabled={isInteracting || isSaving || isRefreshing}
                    onAppointmentClick={onAppointmentClick}
                    allowOverbooking={allowOverbooking}
                    resizeEnabled={resizeEnabled}
                    canResizeAppointments={canResizeAppointments}
                    disabled={isSaving || isRefreshing}
                    onInteractionChange={setIsInteracting}
                    onAppointmentResize={onAppointmentResize}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
