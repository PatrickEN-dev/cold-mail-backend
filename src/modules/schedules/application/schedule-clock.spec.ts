import { describe, expect, it } from 'vitest';
import { ScheduleClock } from './schedule-clock';

describe('ScheduleClock', () => {
  const clock = new ScheduleClock();

  it('computes next_run_at for one_time schedule in São Paulo TZ', () => {
    const result = clock.nextRunAtFromInput({
      scheduleType: 'one_time',
      scheduledDate: '2026-12-15',
      scheduledTime: '14:30',
      recurringDays: [],
      tz: 'America/Sao_Paulo',
    });
    expect(result).not.toBeNull();
    // 14:30 in São Paulo (UTC-3) = 17:30 UTC
    expect(result!.toISOString()).toBe('2026-12-15T17:30:00.000Z');
  });

  it('finds next allowed weekday for a recurring schedule', () => {
    const monday = new Date('2026-05-11T03:00:00.000Z'); // Sunday in São Paulo
    const result = clock.nextRunAtFromInput({
      scheduleType: 'recurring',
      scheduledTime: '09:00',
      recurringDays: ['mon', 'wed'],
      tz: 'America/Sao_Paulo',
      from: monday,
    });
    expect(result).not.toBeNull();
    // Next Monday after a Sunday at 03:00 UTC (= Sun 00:00 SP) is the same day
    // at 09:00 SP = 12:00 UTC. Mon = day 1.
    const dow = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Sao_Paulo',
      weekday: 'short',
    }).format(result!);
    expect(['Mon', 'Wed']).toContain(dow);
  });
});
