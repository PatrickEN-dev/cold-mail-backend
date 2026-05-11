import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypedConfigService } from '../config/typed-config.service';
import { QUEUE_NAMES } from './queue.constants';

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [TypedConfigService],
      useFactory: (config: TypedConfigService) => {
        const url = config.getOrThrow('REDIS_URL');
        return {
          connection: { url, maxRetriesPerRequest: null },
          defaultJobOptions: {
            attempts: 3,
            backoff: { type: 'exponential', delay: 5_000 },
            removeOnComplete: { age: 60 * 60 * 24, count: 1000 },
            removeOnFail: { age: 60 * 60 * 24 * 7 },
          },
        };
      },
    }),
    BullModule.registerQueue(
      { name: QUEUE_NAMES.DISPATCH },
      { name: QUEUE_NAMES.WARMUP },
      { name: QUEUE_NAMES.FOLLOWUPS },
      { name: QUEUE_NAMES.SCHEDULES },
      { name: QUEUE_NAMES.WEBHOOKS },
    ),
  ],
  exports: [BullModule],
})
export class QueueModule {}
