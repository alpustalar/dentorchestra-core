'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DateTimeManager } from '@shared/common';
import { appointmentGetAll } from '@/api/generated/appointment-query/appointment-query';
import { appointmentReschedule } from '@/api/generated/appointment-command/appointment-command';
import { appointments } from '../data/mock-appointments';
import { appointmentKeys } from './appointment.keys';
import type { CalendarAppointment } from '../calendar-appointment.types';

const calendarKeys = ['appointment-calendar-records'] as const;
const mockTimes = new Map<string, { startTime: Date; endTime: Date }>();

type CalendarData = { items: CalendarAppointment[]; groups: string[] };
type Filter = { clinicId: string; startDate: string; endDate: string };
export type CalendarAppointmentResize = {
  appointment: CalendarAppointment;
  startTime: Date;
  endTime: Date;
};

export function useCalendarAppointments(filter: Filter) {
  const mockingEnabled = process.env.NEXT_PUBLIC_API_MOCKING === 'enabled';
  return useQuery({
    queryKey: [...calendarKeys, filter],
    enabled: Boolean(filter.clinicId),
    queryFn: async ({ signal }): Promise<CalendarData> => {
      if (mockingEnabled) {
        const start = DateTimeManager.create(filter.startDate);
        const end = DateTimeManager.create(filter.endDate);
        return {
          groups: ['INTERNAL'],
          items: appointments
            .map((item) => ({ ...item, ...mockTimes.get(item.id) }))
            .filter(
              (item) =>
                item.clinicId === filter.clinicId &&
                item.startTime >= start &&
                item.startTime <= end
            ),
        };
      }

      const items: CalendarAppointment[] = [];
      let groups: string[] = [];
      let page = 1;
      let totalPages = 1;
      do {
        const response = await appointmentGetAll(
          { ...filter, page, limit: 100 },
          signal
        );
        const responseGroups =
          response.serialization?.groups ??
          (
            response.meta?.serializationOptions as
              | { groups?: string[] }
              | undefined
          )?.groups;
        groups =
          page === 1
            ? (responseGroups ?? [])
            : groups.filter((group) => responseGroups?.includes(group));
        items.push(
          ...response.data.map((item) => ({
            ...item,
            startTime: DateTimeManager.create(item.startTime),
            endTime: DateTimeManager.create(item.endTime),
          }))
        );
        totalPages = response.meta?.pagination?.totalPages ?? 1;
        page += 1;
      } while (page <= totalPages);
      return { items, groups };
    },
  });
}

export function useCalendarAppointmentResize() {
  const queryClient = useQueryClient();
  const mockingEnabled = process.env.NEXT_PUBLIC_API_MOCKING === 'enabled';
  return useMutation({
    mutationFn: async ({
      appointment,
      startTime,
      endTime,
    }: CalendarAppointmentResize) => {
      if (mockingEnabled) {
        mockTimes.set(appointment.id, { startTime, endTime });
        return;
      }
      await appointmentReschedule(appointment.id, {
        appointmentId: appointment.id,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
      });
    },
    onMutate: async ({ appointment, startTime, endTime }) => {
      await queryClient.cancelQueries({ queryKey: calendarKeys });
      const previous = queryClient.getQueriesData<CalendarData>({
        queryKey: calendarKeys,
      });
      queryClient.setQueriesData<CalendarData>(
        { queryKey: calendarKeys },
        (current) =>
          current && {
            ...current,
            items: current.items.map((item) =>
              item.id === appointment.id
                ? { ...item, startTime, endTime }
                : item
            ),
          }
      );
      return { previous };
    },
    onError: (_error, variables, context) => {
      context?.previous.forEach(([key, data]) => {
        const original = data?.items.find(
          (item) => item.id === variables.appointment.id
        );
        if (!original) return;
        queryClient.setQueryData<CalendarData>(
          key,
          (current) =>
            current && {
              ...current,
              items: current.items.map((item) =>
                item.id === original.id &&
                item.startTime.toISOString() ===
                  variables.startTime.toISOString() &&
                item.endTime.toISOString() === variables.endTime.toISOString()
                  ? {
                      ...item,
                      startTime: original.startTime,
                      endTime: original.endTime,
                    }
                  : item
              ),
            }
        );
      });
    },
    onSettled: async (_data, _error, { appointment }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: calendarKeys }),
        queryClient.invalidateQueries({
          queryKey: appointmentKeys.days(appointment.clinicId),
        }),
        queryClient.invalidateQueries({
          queryKey: appointmentKeys.summaries(appointment.clinicId),
        }),
        queryClient.invalidateQueries({
          queryKey: appointmentKeys.detail(appointment.id),
        }),
      ]);
    },
  });
}
