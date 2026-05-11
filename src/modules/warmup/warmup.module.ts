import { Module } from '@nestjs/common';
import { SendersModule } from '@modules/senders/senders.module';
import { EmailProvidersModule } from '@modules/providers/email/email-providers.module';
import { AiModule } from '@modules/ai/ai.module';
import { WarmupBudgetClient } from './warmup-budget.client';
import { WarmupTickCron } from './crons/warmup-tick.cron';

@Module({
  imports: [SendersModule, EmailProvidersModule, AiModule],
  providers: [WarmupBudgetClient, WarmupTickCron],
  exports: [WarmupBudgetClient],
})
export class WarmupModule {}
