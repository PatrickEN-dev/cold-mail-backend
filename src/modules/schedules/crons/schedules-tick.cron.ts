import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TypedConfigService } from '@infra/config/typed-config.service';
import { SchedulesRepository } from '../schedules.repository';
import { ScheduleClock } from '../application/schedule-clock';
import { FireScheduleUseCase } from '../application/fire-schedule.use-case';

/// Wave 5: replaces N8N pt1 Wait-as-scheduler. Runs every minute and fires
/// any schedule whose next_run_at has passed, then advances next_run_at
/// (recurring) or marks completed (one_time).
@Injectable()
export class SchedulesTickCron {
  private readonly logger = new Logger(SchedulesTickCron.name);

  constructor(
    private readonly config: TypedConfigService,
    private readonly repository: SchedulesRepository,
    private readonly clock: ScheduleClock,
    private readonly fireSchedule: FireScheduleUseCase,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE, { name: 'schedules-tick' })
  async handle(): Promise<void> {
    if (!this.config.get('ENABLE_SCHEDULES_CRON')) return;

    const now = new Date();
    const due = await this.repository.findDue(now);
    if (due.length === 0) return;

    this.logger.log(`schedules-tick: ${due.length} due`);

    for (const schedule of due) {
      try {
        await this.fireSchedule.execute(schedule);
        if (schedule.type === 'one_time') {
          await this.repository.markFired(schedule.id, null, 'completed');
        } else {
          const nextRunAt = this.clock.nextRunAtFromInput({
            scheduleType: schedule.type as 'one_time' | 'recurring',
            scheduledDate: schedule.scheduledDate?.toISOString().slice(0, 10),
            scheduledTime: schedule.scheduledTime.toISOString().slice(11, 16),
            recurringDays: schedule.recurringDays,
            // TODO(wave-5-finalize): read tz from schedules.tz once column is added.
            tz: 'America/Sao_Paulo',
            from: new Date(now.getTime() + 60_000),
          });
          await this.repository.markFired(schedule.id, nextRunAt, 'active');
        }
      } catch (err) {
        this.logger.error(`schedule ${schedule.id} fire failed`, err);
      }
    }
  }
}
