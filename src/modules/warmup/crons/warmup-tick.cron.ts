import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TypedConfigService } from '@infra/config/typed-config.service';

/// Wave 3: 3x/day batch tick. For each enabled sender_warmups:
///   - call warmup-budget edge function
///   - if remaining > 0, enqueue warmup.send job (paired with another sender)
/// TODO(wave-3): wire to WarmupBudgetClient + pairing + queue producer.
@Injectable()
export class WarmupTickCron {
  private readonly logger = new Logger(WarmupTickCron.name);

  constructor(private readonly config: TypedConfigService) {}

  @Cron(CronExpression.EVERY_DAY_AT_8AM, {
    name: 'warmup-tick-morning',
    timeZone: 'America/Sao_Paulo',
  })
  morning(): void {
    this.runBatch('morning');
  }

  @Cron(CronExpression.EVERY_DAY_AT_2PM, {
    name: 'warmup-tick-afternoon',
    timeZone: 'America/Sao_Paulo',
  })
  afternoon(): void {
    this.runBatch('afternoon');
  }

  @Cron(CronExpression.EVERY_DAY_AT_8PM, {
    name: 'warmup-tick-evening',
    timeZone: 'America/Sao_Paulo',
  })
  evening(): void {
    this.runBatch('evening');
  }

  private runBatch(slot: 'morning' | 'afternoon' | 'evening'): void {
    if (!this.config.get('ENABLE_WARMUP_WORKER')) return;
    this.logger.log(`warmup-tick (${slot}) — TODO wave 3`);
  }
}
