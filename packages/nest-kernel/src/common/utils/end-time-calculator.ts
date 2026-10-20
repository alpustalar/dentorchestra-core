import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';
import { Guard } from '@common/domain/guards';

export type EndTimeCalculatorProps = {
  startTime: Date;
  endTime?: Date | null;
  duration?: number | null;
};

export function endTimeCalculator({
  startTime,
  endTime,
  duration,
}: EndTimeCalculatorProps) {
  let returnTime: Date | undefined;
  if (endTime) {
    returnTime = DateTimeManager.create(endTime);
  }

  if (duration && duration > 0) {
    returnTime = DateTimeManager.addMinutes(startTime, duration);
  }

  return Guard.monitor(
    returnTime,
    !!returnTime,
    () => new Error('Bitiş zamanı belirlenemedi.')
  );
}
