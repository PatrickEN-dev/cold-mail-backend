import { Module } from '@nestjs/common';
import { SendersController } from './senders.controller';
import { SendersService } from './senders.service';
import { SendersRepository } from './senders.repository';
import { ResetDailyUsageUseCase } from './application/reset-daily-usage.use-case';
import { ResetDailyUsageCron } from './crons/reset-daily-usage.cron';

@Module({
  controllers: [SendersController],
  providers: [SendersService, SendersRepository, ResetDailyUsageUseCase, ResetDailyUsageCron],
  exports: [SendersService, SendersRepository],
})
export class SendersModule {}
