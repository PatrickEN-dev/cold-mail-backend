import { Injectable, Logger } from '@nestjs/common';
import { SendersRepository } from '../senders.repository';

/// Global tenant-less reset triggered daily at 00:00 by the cron (legitimate
/// multi-tenant exception, see CLAUDE.md).
@Injectable()
export class ResetDailyUsageUseCase {
  private readonly logger = new Logger(ResetDailyUsageUseCase.name);

  constructor(private readonly senders: SendersRepository) {}

  async execute(): Promise<{ resetCount: number; ranAt: Date }> {
    const startedAt = new Date();
    const { count } = await this.senders.resetAllDailyUsage();
    this.logger.log(
      { resetCount: count, durationMs: Date.now() - startedAt.getTime() },
      'reset daily usage executed',
    );
    return { resetCount: count, ranAt: startedAt };
  }
}
