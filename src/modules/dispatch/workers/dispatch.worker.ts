import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { JOB_NAMES, QUEUE_NAMES } from '@infra/queue/queue.constants';
import { SendOneUseCase } from '../application/send-one.use-case';
import type { DispatchSendJobData } from '../dto/dispatch.dto';

@Processor(QUEUE_NAMES.DISPATCH)
export class DispatchWorker extends WorkerHost {
  private readonly logger = new Logger(DispatchWorker.name);

  constructor(private readonly sendOne: SendOneUseCase) {
    super();
  }

  async process(job: Job<DispatchSendJobData>): Promise<void> {
    switch (job.name) {
      case JOB_NAMES.DISPATCH_SEND:
        await this.sendOne.execute(job.data);
        return;
      default:
        this.logger.warn(`Unknown dispatch job name: ${job.name}`);
    }
  }
}
