import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SendersRepository } from '@modules/senders/senders.repository';
import { TemplatesService } from '@modules/templates/templates.service';
import { EmailProviderRegistry } from '@modules/providers/email/email-provider.registry';
import { PrismaService } from '@infra/database/prisma.service';
import { MetricsService } from '@infra/observability/metrics.service';
import { EmailSendFailedEvent, EmailSentEvent } from '@shared/events/events';
import { ExternalServiceError, NotFoundError } from '@shared/errors/domain.error';
import type { DispatchSendJobData } from '../dto/dispatch.dto';
import { PROVIDER_NAMES, type ProviderName, type SendEmailArgs } from '@modules/providers/email/types';

/// Wave 4: runs one provider send. Persists the outbound message and updates
/// the lead status. Emits domain events for downstream subscribers.
@Injectable()
export class SendOneUseCase {
  private readonly logger = new Logger(SendOneUseCase.name);

  constructor(
    private readonly senders: SendersRepository,
    private readonly templates: TemplatesService,
    private readonly providers: EmailProviderRegistry,
    private readonly events: EventEmitter2,
    private readonly prisma: PrismaService,
    private readonly metrics: MetricsService,
  ) {}

  async execute(job: DispatchSendJobData): Promise<void> {
    const sender = await this.senders.findByAddressForUser(job.senderEmailAddress, job.userId);
    if (!sender) throw new NotFoundError(`Sender ${job.senderEmailAddress} not found`);

    // Atomic quota reservation: increments today_usage only if still below dailyLimit.
    // Returns count=0 when the slot was already consumed by another worker —
    // we skip the send rather than risk going over (prevents race seen with N8N pt2).
    const reservation = await this.prisma.senderEmail.updateMany({
      where: { id: sender.id, todayUsage: { lt: sender.dailyLimit } },
      data: { todayUsage: { increment: 1 } },
    });
    if (reservation.count === 0) {
      this.metrics.senderQuotaSkipsTotal.inc({ provider: sender.provider });
      this.logger.warn(
        { senderId: sender.id, dailyLimit: sender.dailyLimit },
        'sender quota exhausted (atomic reservation failed) — skipping',
      );
      return;
    }

    const template = await this.templates.pickRandomVariant(job.userId, sender.platform);
    if (!template) {
      throw new NotFoundError(
        `No active template for platform=${sender.platform} (user=${job.userId})`,
      );
    }

    const args: SendEmailArgs = {
      from: { address: sender.emailAddress, name: sender.displayName },
      to: job.leadEmail,
      subject: this.renderTemplate(template.subject, { sender, lead: job }),
      html: this.renderTemplate(template.bodyHtml, { sender, lead: job }),
      replyTo: sender.emailAddress,
    };

    if (!PROVIDER_NAMES.includes(sender.provider as ProviderName)) {
      throw new NotFoundError(`Unsupported sender.provider: ${sender.provider}`);
    }
    const provider = this.providers.resolve(sender.provider as ProviderName);

    const stopTimer = this.metrics.providerSendDuration.startTimer({ provider: sender.provider });
    try {
      const result = await provider.send(args);
      stopTimer({ status: 'success' });
      this.metrics.dispatchTotal.inc({ provider: sender.provider, status: 'success' });
      await this.persistOutbound({ job, sender, args, providerMessageId: result.providerMessageId });
      this.events.emit(
        'email.sent',
        new EmailSentEvent({
          emailId: job.emailId ?? '',
          userId: job.userId,
          senderEmailId: sender.id,
          providerMessageId: result.providerMessageId,
          sentAt: result.acceptedAt,
        }),
      );
    } catch (err) {
      stopTimer({ status: 'failure' });
      this.metrics.dispatchTotal.inc({ provider: sender.provider, status: 'failure' });
      // Rollback the quota reservation when the actual send fails — otherwise
      // failed attempts permanently consume the daily budget.
      await this.prisma.senderEmail.update({
        where: { id: sender.id },
        data: { todayUsage: { decrement: 1 } },
      });
      const error = err instanceof Error ? err : new Error('Unknown error');
      this.events.emit(
        'email.send-failed',
        new EmailSendFailedEvent({
          emailId: job.emailId ?? '',
          userId: job.userId,
          error: {
            code: err instanceof ExternalServiceError ? err.code : 'SEND_FAILED',
            message: error.message,
          },
          attemptedAt: new Date(),
        }),
      );
      throw err;
    }
  }

  private renderTemplate(
    template: string,
    ctx: { sender: { displayName: string; emailAddress: string }; lead: DispatchSendJobData },
  ): string {
    return template
      .replace(/\{\{\s*sender_name\s*\}\}/g, ctx.sender.displayName)
      .replace(/\{\{\s*sender_email\s*\}\}/g, ctx.sender.emailAddress)
      .replace(/\{\{\s*lead_name\s*\}\}/g, ctx.lead.leadName ?? '')
      .replace(/\{\{\s*lead_email\s*\}\}/g, ctx.lead.leadEmail);
  }

  private async persistOutbound(args: {
    job: DispatchSendJobData;
    sender: { id: string; emailAddress: string; displayName: string; provider: string };
    args: SendEmailArgs;
    providerMessageId: string;
  }): Promise<void> {
    const { job, sender, args: sendArgs, providerMessageId } = args;
    const emailId = job.emailId;
    if (!emailId) return;

    // today_usage was already incremented atomically by the quota reservation,
    // so this transaction only persists the lead update + outbound message.
    await this.prisma.$transaction(async (tx) => {
      await tx.email.update({
        where: { id: emailId },
        data: {
          status: 'sent',
          senderEmailId: sender.id,
          dispatchPlatform: sender.provider,
          dateSent: new Date(),
        },
      });
      await tx.emailMessage.create({
        data: {
          userId: job.userId,
          emailId,
          direction: 'outbound',
          providerMessageId,
          fromAddress: sender.emailAddress,
          fromName: sender.displayName,
          toAddress: sendArgs.to,
          subject: sendArgs.subject,
          bodyHtml: sendArgs.html,
          bodyText: sendArgs.text,
          provider: sender.provider,
          sentAt: new Date(),
        },
      });
    });
  }
}
