import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { randomUUID } from 'node:crypto';
import { JOB_NAMES, QUEUE_NAMES } from '@infra/queue/queue.constants';
import { ValidationError } from '@shared/errors/domain.error';
import type { DispatchBatchDto, DispatchSendJobData } from '../dto/dispatch.dto';

/// Pacing window between sends from the same sender — matches legacy N8N pt2
/// (Wait1 90-120s + Wait2 140-149s) averaged to a uniform 90-150s.
const PACING_MIN_MS = 90 * 1000;
const PACING_MAX_MS = 150 * 1000;

/// Pacing is per-sender (delay grows linearly within each sender block) so
/// two senders can send in parallel but the same mailbox spaces its requests.
@Injectable()
export class SendBatchUseCase {
  private readonly logger = new Logger(SendBatchUseCase.name);

  constructor(
    @InjectQueue(QUEUE_NAMES.DISPATCH) private readonly queue: Queue<DispatchSendJobData>,
  ) {}

  async execute(
    userId: string,
    dto: DispatchBatchDto,
  ): Promise<{ batchId: string; enqueued: number }> {
    const batchId = randomUUID();
    const scheduledDelayMs = this.computeScheduleDelayMs(dto);
    const jobs: { name: string; data: DispatchSendJobData; opts: { jobId: string; delay: number } }[] = [];

    for (const block of dto.dispatches) {
      if (!block.sender_email?.id) {
        throw new ValidationError('dispatches[].sender_email.id is required');
      }
      block.emails.forEach((lead, i) => {
        const pacingDelay = i === 0 ? 0 : this.cumulativePacingDelayMs(i);
        jobs.push({
          name: JOB_NAMES.DISPATCH_SEND,
          data: {
            userId,
            batchId,
            leadEmail: lead.email,
            leadName: lead.name ?? undefined,
            emailId: lead.id,
            senderEmailId: block.sender_email.id,
            senderEmailAddress: block.sender_email.email_address,
            senderDisplayName: block.sender_email.display_name ?? undefined,
            senderProvider: block.sender_email.provider,
            platform: block.platform,
            scheduledFor: dto.date,
          },
          opts: {
            jobId: `${batchId}:${block.sender_email.id}:${i}`,
            delay: scheduledDelayMs + pacingDelay,
          },
        });
      });
    }

    if (jobs.length > 0) await this.queue.addBulk(jobs);

    this.logger.log({ batchId, enqueued: jobs.length, userId }, 'send-batch enqueued');
    return { batchId, enqueued: jobs.length };
  }

  private computeScheduleDelayMs(dto: DispatchBatchDto): number {
    if (!dto.schedule || !dto.date) return 0;
    const diff = new Date(dto.date).getTime() - Date.now();
    return diff > 0 ? diff : 0;
  }

  private cumulativePacingDelayMs(index: number): number {
    let total = 0;
    for (let i = 0; i < index; i++) {
      total += PACING_MIN_MS + Math.random() * (PACING_MAX_MS - PACING_MIN_MS);
    }
    return Math.floor(total);
  }
}
