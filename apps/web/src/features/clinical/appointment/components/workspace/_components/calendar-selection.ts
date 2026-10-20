export const CALENDAR_TIMELINE = {
  startMinute: 8 * 60,
  endMinute: 20 * 60,
  hourHeight: 96,
  stepMinutes: 5,
  initialDurationMinutes: 60,
} as const;

export const CALENDAR_SLOT_DURATIONS = [15, 30, 45, 60, 90, 120] as const;

export type CalendarDay = { date: string; label: string };
export type CalendarSelection = {
  date: string;
  startMinute: number;
  endMinute: number;
};
export type SelectionEdge = 'start' | 'end';

export function createSlotSelection(
  date: string,
  minute: number,
  durationMinutes: number
): CalendarSelection {
  const { startMinute, endMinute } = CALENDAR_TIMELINE;
  const duration = Math.max(5, Math.round(durationMinutes / 5) * 5);
  const slotIndex = Math.max(
    0,
    Math.min(
      Math.ceil((endMinute - startMinute) / duration) - 1,
      Math.floor((minute - startMinute) / duration)
    )
  );
  const start = startMinute + slotIndex * duration;
  return {
    date,
    startMinute: start,
    endMinute: Math.min(endMinute, start + duration),
  };
}

export function getCalendarSlots(durationMinutes: number) {
  const slots: CalendarSelection[] = [];
  for (
    let startMinute = CALENDAR_TIMELINE.startMinute;
    startMinute < CALENDAR_TIMELINE.endMinute;
    startMinute += durationMinutes
  ) {
    slots.push({
      date: '',
      startMinute,
      endMinute: Math.min(
        CALENDAR_TIMELINE.endMinute,
        startMinute + durationMinutes
      ),
    });
  }
  return slots;
}

export function snapCalendarMinute(minute: number) {
  const { startMinute, endMinute, stepMinutes } = CALENDAR_TIMELINE;
  return Math.max(
    startMinute,
    Math.min(endMinute, Math.round(minute / stepMinutes) * stepMinutes)
  );
}

export function createCalendarSelection(
  date: string,
  minute: number
): CalendarSelection {
  const { endMinute, stepMinutes, initialDurationMinutes } = CALENDAR_TIMELINE;
  const start = Math.min(endMinute - stepMinutes, snapCalendarMinute(minute));
  return {
    date,
    startMinute: start,
    endMinute: Math.min(endMinute, start + initialDurationMinutes),
  };
}

export function dragCalendarSelection(
  date: string,
  anchorMinute: number,
  minute: number
): CalendarSelection {
  const target = snapCalendarMinute(minute);
  const start = Math.min(anchorMinute, target);
  return {
    date,
    startMinute: start,
    endMinute: Math.max(
      start + CALENDAR_TIMELINE.stepMinutes,
      anchorMinute,
      target
    ),
  };
}

export function resizeCalendarSelection(
  selection: CalendarSelection,
  edge: SelectionEdge,
  minute: number
): CalendarSelection {
  const target = snapCalendarMinute(minute);
  return edge === 'start'
    ? {
        ...selection,
        startMinute: Math.min(
          target,
          selection.endMinute - CALENDAR_TIMELINE.stepMinutes
        ),
      }
    : {
        ...selection,
        endMinute: Math.max(
          target,
          selection.startMinute + CALENDAR_TIMELINE.stepMinutes
        ),
      };
}
