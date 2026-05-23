import { Injectable } from '@nestjs/common';

const WEEKDAY_INDEX: Record<string, number> = {
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
};

/// Computes next_run_at honoring the schedule's IANA timezone — without this,
/// schedules drift 3h because Railway runs UTC.
@Injectable()
export class ScheduleClock {
  nextRunAtFromInput(input: {
    scheduleType: 'one_time' | 'recurring';
    scheduledDate?: string | null;
    scheduledTime?: string | null;
    recurringDays: string[];
    tz: string;
    from?: Date;
  }): Date | null {
    if (!input.scheduledTime) return null;
    const from = input.from ?? new Date();
    if (input.scheduleType === 'one_time') {
      if (!input.scheduledDate) return null;
      return this.combineDateTimeInTz(input.scheduledDate, input.scheduledTime, input.tz);
    }
    return this.nextRecurring(input.scheduledTime, input.recurringDays, input.tz, from);
  }

  nextRecurring(timeHHMM: string, days: string[], tz: string, from: Date): Date | null {
    if (days.length === 0) return null;
    const allowedDows = new Set(days.map((d) => WEEKDAY_INDEX[d]).filter((n) => n !== undefined));
    for (let offset = 0; offset < 14; offset++) {
      const candidate = this.addDaysInTz(from, offset, tz);
      const candidateYMD = this.formatYMDInTz(candidate, tz);
      const candidateDow = this.weekdayInTz(candidate, tz);
      if (!allowedDows.has(candidateDow)) continue;
      const at = this.combineDateTimeInTz(candidateYMD, timeHHMM, tz);
      if (at.getTime() > from.getTime()) return at;
    }
    return null;
  }

  private combineDateTimeInTz(ymd: string, hhmm: string, tz: string): Date {
    const isoNaive = `${ymd}T${hhmm}:00`;
    const naiveUtc = new Date(`${isoNaive}Z`).getTime();
    const tzOffsetMs = this.offsetMsAt(new Date(naiveUtc), tz);
    return new Date(naiveUtc - tzOffsetMs);
  }

  private offsetMsAt(date: Date, tz: string): number {
    const tzFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    const parts = tzFormatter.formatToParts(date);
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? '0');
    const asUtc = Date.UTC(
      get('year'),
      get('month') - 1,
      get('day'),
      get('hour') === 24 ? 0 : get('hour'),
      get('minute'),
      get('second'),
    );
    return asUtc - date.getTime();
  }

  private addDaysInTz(base: Date, days: number, tz: string): Date {
    const ymd = this.formatYMDInTz(base, tz);
    const [y, m, d] = ymd.split('-').map(Number);
    const baseUtcMidnight = Date.UTC(y, m - 1, d);
    return new Date(baseUtcMidnight + days * 86_400_000);
  }

  private formatYMDInTz(date: Date, tz: string): string {
    const f = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return f.format(date);
  }

  private weekdayInTz(date: Date, tz: string): number {
    const f = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' });
    const map: Record<string, number> = {
      Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
    };
    return map[f.format(date)] ?? 0;
  }
}
