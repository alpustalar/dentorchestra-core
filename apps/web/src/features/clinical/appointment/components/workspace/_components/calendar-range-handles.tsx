'use client';

import type * as React from 'react';
import { useTranslations } from 'next-intl';
import { DateTimeManager } from '@shared/common';
import {
  CALENDAR_TIMELINE,
  type CalendarSelection,
  type SelectionEdge,
} from './calendar-selection';

type Props = {
  range: CalendarSelection;
  label?: string;
  onPointerDown: (event: React.PointerEvent, edge: SelectionEdge) => void;
  onKeyDown: (event: React.KeyboardEvent, edge: SelectionEdge) => void;
};

/** Each handle covers half the range, with separate touch targets for short ranges. */
export function CalendarRangeHandles({
  range,
  label,
  onPointerDown,
  onKeyDown,
}: Props) {
  const t = useTranslations('AppointmentCalendar');
  const { startMinute, endMinute, stepMinutes, hourHeight } = CALENDAR_TIMELINE;
  const compact =
    ((range.endMinute - range.startMinute) * hourHeight) / 60 < 88;
  return (['start', 'end'] as const).map((edge) => {
    const value = range[edge === 'start' ? 'startMinute' : 'endMinute'];
    return (
      <button
        key={edge}
        type="button"
        role="slider"
        data-calendar-interactive
        aria-label={`${label ? `${label}, ` : ''}${t(edge === 'start' ? 'resizeStart' : 'resizeEnd')}`}
        aria-orientation="vertical"
        aria-valuemin={
          edge === 'start' ? startMinute : range.startMinute + stepMinutes
        }
        aria-valuemax={
          edge === 'start' ? range.endMinute - stepMinutes : endMinute
        }
        aria-valuenow={value}
        aria-valuetext={DateTimeManager.minutesToHHMM(value)}
        onPointerDown={(event) => onPointerDown(event, edge)}
        onKeyDown={(event) => onKeyDown(event, edge)}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        className={`pointer-events-auto absolute z-30 flex min-h-11 touch-none cursor-ns-resize justify-center rounded hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${compact ? 'h-11 w-1/2' : 'inset-x-0 h-1/2'} ${edge === 'start' ? 'left-0 top-0 items-start pt-0.5' : 'bottom-0 right-0 items-end pb-0.5'}`}
      >
        <span className="h-1 w-2/3 max-w-32 rounded-full border border-background bg-primary shadow" />
      </button>
    );
  });
}
