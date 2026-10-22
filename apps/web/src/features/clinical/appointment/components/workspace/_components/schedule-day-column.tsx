'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Check, X } from 'lucide-react';
import { DateTimeManager } from '@shared/common';
import {
  type CalendarAppointment,
  canResizeCalendarAppointment,
} from '@/features/clinical/appointment/calendar-appointment.types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { appointmentStatus } from '@/features/clinical/appointment/data/mock-appointments';
import { CalendarRangeHandles } from './calendar-range-handles';
import {
  CALENDAR_TIMELINE,
  type CalendarDay,
  type CalendarSelection,
  createCalendarSelection,
  createSlotSelection,
  dragCalendarSelection,
  getCalendarSlots,
  resizeCalendarSelection,
  type SelectionEdge,
} from './calendar-selection';

type Props = {
  day: CalendarDay;
  items: CalendarAppointment[];
  allowOverbooking: boolean;
  selection: CalendarSelection | null;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  onSelectionChange: (selection: CalendarSelection | null) => void;
  onRangeConfirm: (selection: CalendarSelection) => void;
  actionsDisabled: boolean;
  onAppointmentClick: (item: CalendarAppointment) => void;
  resizeEnabled: boolean;
  slotDurationMinutes: number;
  canResizeAppointments: boolean;
  disabled: boolean;
  onInteractionChange: (active: boolean) => void;
  onAppointmentResize: (
    item: CalendarAppointment,
    range: CalendarSelection
  ) => Promise<void>;
};

type Gesture = {
  pointerId: number;
  mode: 'create' | SelectionEdge;
  initialY: number;
  initialTop: number;
  lastY: number;
  moved: boolean;
  anchorMinute: number;
  initialSelection: CalendarSelection;
  previousSelection: CalendarSelection | null;
  appointment?: CalendarAppointment;
  currentRange: CalendarSelection;
};

const { startMinute, endMinute, hourHeight, stepMinutes } = CALENDAR_TIMELINE;
const pixelsPerMinute = hourHeight / 60;
const height = (endMinute - startMinute) * pixelsPerMinute;
const hours = Array.from(
  { length: (endMinute - startMinute) / 60 },
  (_, index) => startMinute + index * 60
);
const clock = DateTimeManager.minutesToHHMM;
const overbookingColors = [
  'border-sky-300 bg-sky-100 dark:border-sky-800 dark:bg-sky-950/70',
  'border-violet-300 bg-violet-100 dark:border-violet-800 dark:bg-violet-950/70',
  'border-amber-300 bg-amber-100 dark:border-amber-800 dark:bg-amber-950/70',
  'border-emerald-300 bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/70',
  'border-rose-300 bg-rose-100 dark:border-rose-800 dark:bg-rose-950/70',
  'border-cyan-300 bg-cyan-100 dark:border-cyan-800 dark:bg-cyan-950/70',
];

export function ScheduleDayColumn({
  day,
  items,
  allowOverbooking,
  selection,
  scrollRef,
  onSelectionChange,
  onRangeConfirm,
  actionsDisabled,
  onAppointmentClick,
  resizeEnabled,
  slotDurationMinutes,
  canResizeAppointments,
  disabled,
  onInteractionChange,
  onAppointmentResize,
}: Props) {
  const t = useTranslations('AppointmentCalendar');
  const statusText = useTranslations('AppointmentDetails');
  const columnRef = React.useRef<HTMLDivElement>(null);
  const gestureRef = React.useRef<Gesture | null>(null);
  const frameRef = React.useRef<number | null>(null);
  const [appointmentPreview, setAppointmentPreview] = React.useState<{
    id: string;
    range: CalendarSelection;
  } | null>(null);
  const activeSelection = selection?.date === day.date ? selection : null;
  const midnight = DateTimeManager.fromLocalDateTime(day.date, '00:00');
  const selectionTop = activeSelection
    ? (activeSelection.startMinute - startMinute) * pixelsPerMinute
    : 0;
  const selectionHeight = activeSelection
    ? (activeSelection.endMinute - activeSelection.startMinute) *
      pixelsPerMinute
    : 0;
  const actionsHeight = 50;
  const belowSelection = Math.max(selectionHeight, 44) + 4;
  // Short ranges cannot fit both touch-sized actions and resize handles inside.
  const preferredActionsTop =
    selectionHeight >= 88
      ? (selectionHeight - actionsHeight) / 2
      : selectionTop + belowSelection + actionsHeight <= height
        ? belowSelection
        : Math.min(0, selectionHeight - 44) - actionsHeight - 4;
  const actionsTop = Math.max(
    -selectionTop,
    Math.min(preferredActionsTop, height - selectionTop - actionsHeight)
  );

  function appointmentRange(item: CalendarAppointment): CalendarSelection {
    return {
      date: day.date,
      startMinute: DateTimeManager.diffInMinutes(item.startTime, midnight),
      endMinute: DateTimeManager.diffInMinutes(item.endTime, midnight),
    };
  }

  const appointmentLayouts = React.useMemo(() => {
    const entries = items.map((item) => ({
      key: item.id,
      isSelection: false,
      range:
        appointmentPreview?.id === item.id
          ? appointmentPreview.range
          : appointmentRange(item),
    }));
    if (allowOverbooking && activeSelection) {
      entries.push({
        key: '__calendar-selection__',
        isSelection: true,
        range: activeSelection,
      });
    }
    entries.sort(
      (left, right) =>
        left.range.startMinute - right.range.startMinute ||
        Number(left.isSelection) - Number(right.isSelection) ||
        left.range.endMinute - right.range.endMinute
    );
    const layouts = new Map<string, { lane: number; laneCount: number }>();
    let cluster: (typeof entries)[number][] = [];
    let clusterEnd = Number.NEGATIVE_INFINITY;

    const placeCluster = () => {
      if (!cluster.length) return;
      const laneEnds: number[] = [];
      const placements = cluster.map(({ key, range }) => {
        let lane = laneEnds.findIndex((end) => end <= range.startMinute);
        if (lane === -1) lane = laneEnds.length;
        laneEnds[lane] = range.endMinute;
        return { key, lane };
      });
      for (const placement of placements) {
        layouts.set(placement.key, {
          lane: placement.lane,
          laneCount: laneEnds.length,
        });
      }
      cluster = [];
      clusterEnd = Number.NEGATIVE_INFINITY;
    };

    for (const entry of entries) {
      if (entry.range.startMinute >= clusterEnd) placeCluster();
      cluster.push(entry);
      clusterEnd = Math.max(clusterEnd, entry.range.endMinute);
    }
    placeCluster();
    return layouts;
  }, [items, appointmentPreview, activeSelection, allowOverbooking, midnight]);

  const selectionLayout = appointmentLayouts.get('__calendar-selection__');
  const splitSelection =
    allowOverbooking && (selectionLayout?.laneCount ?? 1) > 1;
  const selectionLaneStyle =
    splitSelection && selectionLayout
      ? {
          left: `calc(${(selectionLayout.lane * 100) / selectionLayout.laneCount}% + 4px)`,
          width: `calc(${100 / selectionLayout.laneCount}% - 6px)`,
        }
      : {};

  React.useEffect(
    () => () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    },
    []
  );

  function updateGesture(clientY: number) {
    const gesture = gestureRef.current;
    const column = columnRef.current;
    if (!gesture || !column) return;
    gesture.lastY = clientY;
    const top = column.getBoundingClientRect().top;
    const offset = clientY - gesture.initialY + gesture.initialTop - top;
    gesture.moved ||= Math.abs(offset) >= 3;
    if (!gesture.moved) return;

    const initial = gesture.initialSelection;
    const next =
      gesture.mode === 'create'
        ? dragCalendarSelection(
            day.date,
            gesture.anchorMinute,
            startMinute + (clientY - top) / pixelsPerMinute
          )
        : resizeCalendarSelection(
            initial,
            gesture.mode,
            initial[gesture.mode === 'start' ? 'startMinute' : 'endMinute'] +
              offset / pixelsPerMinute
          );
    gesture.currentRange = next;
    if (gesture.appointment)
      setAppointmentPreview({ id: gesture.appointment.id, range: next });
    else onSelectionChange(next);
  }

  function autoScroll() {
    const gesture = gestureRef.current;
    const scroll = scrollRef.current;
    if (!gesture || !scroll) return;
    const bounds = scroll.getBoundingClientRect();
    const speed = !gesture.moved
      ? 0
      : gesture.lastY < bounds.top + 32
        ? -10
        : gesture.lastY > bounds.bottom - 32
          ? 10
          : 0;
    if (speed) {
      const before = scroll.scrollTop;
      scroll.scrollTop += speed;
      if (scroll.scrollTop !== before) updateGesture(gesture.lastY);
    }
    frameRef.current = requestAnimationFrame(autoScroll);
  }

  function beginGesture(
    event: React.PointerEvent,
    edge?: SelectionEdge,
    appointment?: CalendarAppointment
  ) {
    if (
      disabled ||
      !resizeEnabled ||
      !event.isPrimary ||
      event.button !== 0 ||
      gestureRef.current
    )
      return;
    if (edge && !resizeEnabled) return;
    if (
      appointment &&
      (!canResizeAppointments || !canResizeCalendarAppointment(appointment))
    )
      return;
    if (
      !edge &&
      (event.target as HTMLElement).closest('[data-calendar-interactive]')
    )
      return;
    const column = columnRef.current;
    if (!column || (edge && !activeSelection && !appointment)) return;
    event.preventDefault();
    event.stopPropagation();
    const top = column.getBoundingClientRect().top;
    const pointerMinute = startMinute + (event.clientY - top) / pixelsPerMinute;
    const initial = appointment
      ? appointmentRange(appointment)
      : edge && activeSelection
        ? activeSelection
        : createCalendarSelection(
            day.date,
            Math.floor(pointerMinute / 60) * 60
          );
    gestureRef.current = {
      pointerId: event.pointerId,
      mode: edge ?? 'create',
      initialY: event.clientY,
      initialTop: top,
      lastY: event.clientY,
      moved: false,
      anchorMinute: createCalendarSelection(day.date, pointerMinute)
        .startMinute,
      initialSelection: initial,
      previousSelection: selection,
      appointment,
      currentRange: initial,
    };
    column.focus({ preventScroll: true });
    column.setPointerCapture(event.pointerId);
    if (appointment) {
      onSelectionChange(null);
      setAppointmentPreview({ id: appointment.id, range: initial });
    } else onSelectionChange(initial);
    onInteractionChange(true);
    frameRef.current = requestAnimationFrame(autoScroll);
  }

  function finishGesture(cancelled: boolean) {
    const gesture = gestureRef.current;
    if (!gesture) return;
    gestureRef.current = null;
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    if (cancelled) onSelectionChange(gesture.previousSelection);
    const column = columnRef.current;
    if (column?.hasPointerCapture(gesture.pointerId))
      column.releasePointerCapture(gesture.pointerId);
    onInteractionChange(false);
    if (!gesture.appointment) return;
    const changed =
      gesture.currentRange.startMinute !==
        gesture.initialSelection.startMinute ||
      gesture.currentRange.endMinute !== gesture.initialSelection.endMinute;
    if (cancelled || !changed) {
      setAppointmentPreview(null);
      return;
    }
    void onAppointmentResize(gesture.appointment, gesture.currentRange).then(
      () => setAppointmentPreview(null),
      () => setAppointmentPreview(null)
    );
  }

  function resizeWithKeyboard(
    event: React.KeyboardEvent,
    edge: SelectionEdge,
    appointment?: CalendarAppointment
  ) {
    if (disabled || !resizeEnabled) return;
    if (
      appointment &&
      (!canResizeAppointments || !canResizeCalendarAppointment(appointment))
    )
      return;
    const range = appointment ? appointmentRange(appointment) : activeSelection;
    if (!range) return;
    const current = range[edge === 'start' ? 'startMinute' : 'endMinute'];
    const target =
      event.key === 'ArrowUp'
        ? current - stepMinutes
        : event.key === 'ArrowDown'
          ? current + stepMinutes
          : event.key === 'Home'
            ? startMinute
            : event.key === 'End'
              ? endMinute
              : null;
    if (target === null) return;
    event.preventDefault();
    event.stopPropagation();
    const next = resizeCalendarSelection(range, edge, target);
    if (appointment) {
      if (
        next.startMinute === range.startMinute &&
        next.endMinute === range.endMinute
      )
        return;
      onSelectionChange(null);
      void onAppointmentResize(appointment, next).catch(() => undefined);
    } else onSelectionChange(next);
  }

  return (
    <div
      ref={columnRef}
      tabIndex={-1}
      className={`relative ${resizeEnabled ? 'touch-none' : 'touch-pan-y'} select-none border-r outline-none last:border-r-0`}
      style={{ height }}
      onPointerDown={(event) => beginGesture(event)}
      onPointerMove={(event) => {
        if (gestureRef.current?.pointerId === event.pointerId)
          updateGesture(event.clientY);
      }}
      onPointerUp={(event) => {
        if (gestureRef.current?.pointerId !== event.pointerId) return;
        updateGesture(event.clientY);
        finishGesture(false);
      }}
      onPointerCancel={(event) => {
        if (gestureRef.current?.pointerId === event.pointerId)
          finishGesture(true);
      }}
      onLostPointerCapture={(event) => {
        if (gestureRef.current?.pointerId === event.pointerId)
          finishGesture(true);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && gestureRef.current) {
          event.stopPropagation();
          finishGesture(true);
        }
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-25"
        style={{
          backgroundImage:
            'linear-gradient(to bottom, var(--border) 1px, transparent 1px)',
          backgroundSize: `100% ${(resizeEnabled ? stepMinutes : slotDurationMinutes) * pixelsPerMinute}px`,
        }}
      />
      {(resizeEnabled
        ? hours.map((minute) => ({
            date: day.date,
            startMinute: minute,
            endMinute: minute + 60,
          }))
        : getCalendarSlots(slotDurationMinutes).map((slot) => ({
            ...slot,
            date: day.date,
          }))
      ).map((slot) => (
        <button
          key={slot.startMinute}
          type="button"
          aria-label={t('selectRange', {
            day: day.label,
            start: clock(slot.startMinute),
            end: clock(slot.endMinute),
          })}
          onClick={(event) => {
            if (resizeEnabled && event.detail !== 0) return;
            onSelectionChange(
              resizeEnabled
                ? createCalendarSelection(day.date, slot.startMinute)
                : createSlotSelection(
                    day.date,
                    slot.startMinute,
                    slotDurationMinutes
                  )
            );
          }}
          className="absolute inset-x-0 border-b transition-colors hover:bg-primary/5 focus-visible:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
          style={{
            top: (slot.startMinute - startMinute) * pixelsPerMinute,
            height: (slot.endMinute - slot.startMinute) * pixelsPerMinute,
          }}
        />
      ))}
      {items.map((item) => {
        const range =
          appointmentPreview?.id === item.id
            ? appointmentPreview.range
            : appointmentRange(item);
        const start = Math.max(startMinute, range.startMinute);
        const end = Math.min(endMinute, range.endMinute);
        if (end <= start) return null;
        const editable =
          resizeEnabled &&
          canResizeAppointments &&
          !disabled &&
          canResizeCalendarAppointment(item) &&
          range.startMinute >= startMinute &&
          range.endMinute <= endMinute;
        const patientName =
          item.patientName || item.patientId || t('patientHidden');
        const layout = appointmentLayouts.get(item.id);
        const splitOverlap = allowOverbooking && (layout?.laneCount ?? 1) > 1;
        return (
          <div
            key={item.id}
            data-calendar-interactive
            className={`absolute z-10 rounded-md border text-xs shadow-sm transition-[top,left,width,height] duration-200 ease-in-out ${splitOverlap ? overbookingColors[(layout?.lane ?? 0) % overbookingColors.length] : 'inset-x-1 border-primary/20 bg-accent'}`}
            style={{
              top: (start - startMinute) * pixelsPerMinute + 1,
              height: Math.max(4, (end - start) * pixelsPerMinute - 2),
              ...(splitOverlap && layout
                ? {
                    left: `calc(${(layout.lane * 100) / layout.laneCount}% + 4px)`,
                    width: `calc(${100 / layout.laneCount}% - 6px)`,
                  }
                : {}),
            }}
          >
            <button
              type="button"
              onClick={() => onAppointmentClick(item)}
              className="h-full w-full overflow-hidden rounded-md p-1.5 text-left"
              aria-label={`${patientName}, ${clock(start)}–${clock(end)}`}
            >
              <div className="truncate font-medium">{patientName}</div>
              <div className="truncate text-muted-foreground">
                {clock(start)}–{clock(end)}
              </div>
              <Badge
                variant={appointmentStatus(item.status)}
                className="text-[10px]"
              >
                {statusText.has(`statuses.${item.status}`)
                  ? statusText(`statuses.${item.status}`)
                  : item.status}
              </Badge>
            </button>
            {editable && (
              <CalendarRangeHandles
                range={range}
                label={patientName}
                onPointerDown={(event, edge) => beginGesture(event, edge, item)}
                onKeyDown={(event, edge) =>
                  resizeWithKeyboard(event, edge, item)
                }
              />
            )}
          </div>
        );
      })}
      {activeSelection && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute z-[5] rounded-md border border-primary/40 opacity-80"
          style={{
            top: selectionTop,
            height: selectionHeight,
            backgroundImage:
              'repeating-linear-gradient(135deg, color-mix(in oklch, var(--primary) 16%, transparent) 0px, color-mix(in oklch, var(--primary) 16%, transparent) 5px, transparent 5px, transparent 10px)',
            ...selectionLaneStyle,
            ...(splitSelection ? {} : { left: 4, right: 4 }),
          }}
        />
      )}
      {activeSelection && (
        <div
          className="pointer-events-none absolute z-20 rounded-md border-2 border-primary transition-[left,width] duration-200 ease-in-out"
          style={{
            top: selectionTop,
            height: selectionHeight,
            ...selectionLaneStyle,
            ...(splitSelection ? {} : { left: 4, right: 4 }),
          }}
        >
          <span className="absolute left-1 top-0 whitespace-nowrap rounded bg-background/95 px-1 text-[10px] font-medium leading-5 text-primary">
            {clock(activeSelection.startMinute)}–
            {clock(activeSelection.endMinute)}
          </span>
          {resizeEnabled && !disabled && (
            <CalendarRangeHandles
              range={activeSelection}
              onPointerDown={(event, edge) => beginGesture(event, edge)}
              onKeyDown={(event, edge) => resizeWithKeyboard(event, edge)}
            />
          )}
          <div
            data-calendar-interactive
            className="pointer-events-auto absolute right-1 z-40 flex items-center gap-0.5 rounded-full border bg-background/95 p-0.5 shadow-sm"
            style={{ top: actionsTop }}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7 rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive/70"
              aria-label={t('clearSelection')}
              title={t('clearSelection')}
              disabled={actionsDisabled}
              onClick={(event) => {
                event.stopPropagation();
                onSelectionChange(null);
              }}
            >
              <X className="size-3.5" aria-hidden="true" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="size-7 rounded-full text-primary"
              aria-label={t('confirmSelection')}
              title={t('confirmSelection')}
              disabled={actionsDisabled}
              onClick={(event) => {
                event.stopPropagation();
                onRangeConfirm(activeSelection);
              }}
            >
              <Check className="size-3.5" aria-hidden="true" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
