import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ResetDailyUsageUseCase } from '../application/reset-daily-usage.use-case';

@Injectable()
export class ResetDailyUsageCron {
  private readonly logger = new Logger(ResetDailyUsageCron.name);

  constructor(private readonly useCase: ResetDailyUsageUseCase) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, {
    name: 'reset-daily-usage',
    timeZone: 'America/Sao_Paulo',
  })
  async handle(): Promise<void> {
    try {
      const result = await this.useCase.execute();
      this.logger.log(`reset-daily-usage: ${result.resetCount} sender(s) zeroed`);
    } catch (err) {
      this.logger.error('reset-daily-usage failed', err);
    }
  }
}
