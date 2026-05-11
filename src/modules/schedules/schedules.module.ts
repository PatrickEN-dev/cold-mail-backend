import { Module } from '@nestjs/common';
import { DispatchModule } from '@modules/dispatch/dispatch.module';
import { LeadsModule } from '@modules/leads/leads.module';
import { SendersModule } from '@modules/senders/senders.module';
import { SchedulesController } from './schedules.controller';
import { SchedulesService } from './schedules.service';
import { SchedulesRepository } from './schedules.repository';
import { ScheduleClock } from './application/schedule-clock';
import { FireScheduleUseCase } from './application/fire-schedule.use-case';
import { SchedulesTickCron } from './crons/schedules-tick.cron';

@Module({
  imports: [DispatchModule, LeadsModule, SendersModule],
  controllers: [SchedulesController],
  providers: [
    SchedulesService,
    SchedulesRepository,
    ScheduleClock,
    FireScheduleUseCase,
    SchedulesTickCron,
  ],
  exports: [SchedulesService, SchedulesRepository, ScheduleClock],
})
export class SchedulesModule {}
