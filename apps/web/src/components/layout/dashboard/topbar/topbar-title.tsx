import { DateTimeManager } from '@shared/common';
import { formatWeekdayDate } from '@/lib/date-time';

export function TopbarTitle() {
  return (
    <div className="flex flex-col leading-tight">
      <p className="hidden text-xs text-muted-foreground sm:block truncate">
        {formatWeekdayDate(DateTimeManager.create())}
      </p>
    </div>
  );
}
