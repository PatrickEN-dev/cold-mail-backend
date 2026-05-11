import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@infra/database/prisma.service';
import { MetricsService } from '@infra/observability/metrics.service';
import { LeadsRepository } from '@modules/leads/leads.repository';
import { InboxRepository } from '@modules/inbox/inbox.repository';
import {
  BounceReceivedEvent,
  EmailOpenedEvent,
  ReplyReceivedEvent,
} from '@shared/events/events';
import type { NormalizedEmailEvent } from '../parsers/normalized-event';

/// Wave 2: applies a NormalizedEmailEvent to the database.
/// - inbound replies → email_messages + emails.status='replied' + reply_time
/// - delivered → senders.today_usage++ (parity with N8N §18.2 sub-flow)
/// - bounced / opened → emails.status update
/// Idempotent on (provider_message_id, direction).
@Injectable()
export class IngestEmailEventUseCase {
  private readonly logger = new Logger(IngestEmailEventUseCase.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly leads: LeadsRepository,
    private readonly inbox: InboxRepository,
    private readonly events: EventEmitter2,
    private readonly metrics: MetricsService,
  ) {}

  async execute(event: NormalizedEmailEvent): Promise<{ applied: boolean }> {
    const result = await this.dispatch(event);
    this.metrics.webhookEventsTotal.inc({
      provider: event.provider,
      event: event.type,
      outcome: result.applied ? 'applied' : 'skipped',
    });
    return result;
  }

  private dispatch(event: NormalizedEmailEvent): Promise<{ applied: boolean }> {
    switch (event.type) {
      case 'replied':
        return this.applyReply(event);
      case 'bounced':
        return this.applyBounce(event);
      case 'opened':
        return this.applyOpen(event);
      case 'delivered':
        return this.applyDelivered(event);
      case 'sent':
        return Promise.resolve({ applied: false });
    }
  }

  private async applyReply(event: NormalizedEmailEvent): Promise<{ applied: boolean }> {
    const already = await this.inbox.existsByProviderMessageId(event.externalMessageId, 'inbound');
    if (already) {
      this.logger.debug({ id: event.externalMessageId }, 'reply already ingested — skipping');
      return { applied: false };
    }
    const lead = await this.leads.findLatestByEmailAny(event.from);
    if (!lead || !lead.userId) {
      this.logger.warn(
        { from: event.from, leadId: lead?.id },
        'reply with no matching lead or missing tenant — dropping',
      );
      return { applied: false };
    }
    const userId = lead.userId;
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.emailMessage.create({
          data: {
            userId,
            emailId: lead.id,
            direction: 'inbound',
            providerMessageId: event.externalMessageId,
            inReplyTo: event.reply?.inReplyTo,
            fromAddress: event.from,
            fromName: event.reply?.fromName,
            toAddress: event.to,
            subject: event.reply?.subject ?? event.subject,
            bodyHtml: event.reply?.bodyHtml,
            bodyText: event.reply?.bodyText,
            provider: event.provider,
            sentAt: event.occurredAt,
            receivedAt: event.occurredAt,
          },
        });
        await tx.email.update({
          where: { id: lead.id },
          // emails.reply_time is text in prod (legacy schema).
          data: { status: 'replied', replyTime: event.occurredAt.toISOString() },
        });
      });
    } catch (err) {
      // P2002 = unique violation on (provider_message_id, direction). Means
      // another worker beat us to ingesting this same webhook event. Skip
      // silently — the desired state is already in the DB.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        this.logger.debug(
          { id: event.externalMessageId },
          'reply already ingested by another worker (race) — skipping',
        );
        return { applied: false };
      }
      throw err;
    }
    this.events.emit(
      'reply.received',
      new ReplyReceivedEvent({
        emailId: lead.id,
        userId,
        fromAddress: event.from,
        fromName: event.reply?.fromName,
        subject: event.reply?.subject,
        bodyText: event.reply?.bodyText,
        bodyHtml: event.reply?.bodyHtml,
        providerMessageId: event.externalMessageId,
        receivedAt: event.occurredAt,
      }),
    );
    return { applied: true };
  }

  private async applyBounce(event: NormalizedEmailEvent): Promise<{ applied: boolean }> {
    const lead = await this.leads.findLatestByEmailAny(event.to);
    if (!lead || !lead.userId) return { applied: false };
    await this.leads.updateStatus(lead.id, 'bounced');
    this.events.emit(
      'bounce.received',
      new BounceReceivedEvent({
        emailId: lead.id,
        userId: lead.userId,
        senderEmailId: lead.senderEmailId ?? '',
        bounceType: event.bounce?.type ?? 'hard',
        reason: event.bounce?.reason,
        receivedAt: event.occurredAt,
      }),
    );
    return { applied: true };
  }

  private async applyOpen(event: NormalizedEmailEvent): Promise<{ applied: boolean }> {
    const lead = await this.leads.findLatestByEmailAny(event.to);
    if (!lead || !lead.userId) return { applied: false };
    if (lead.status === 'sent' || lead.status === 'delivered') {
      await this.leads.updateStatus(lead.id, 'opened');
    }
    this.events.emit(
      'email.opened',
      new EmailOpenedEvent({
        emailId: lead.id,
        userId: lead.userId,
        openedAt: event.occurredAt,
      }),
    );
    return { applied: true };
  }

  private async applyDelivered(event: NormalizedEmailEvent): Promise<{ applied: boolean }> {
    // today_usage is already incremented at send time (SendOneUseCase atomic
    // reservation). The legacy N8N flow incremented here as well, which
    // double-counted; we intentionally diverge to keep the counter accurate.
    const lead = await this.leads.findLatestByEmailAny(event.to);
    if (!lead) return { applied: false };
    if (lead.status !== 'replied') {
      await this.leads.updateStatus(lead.id, 'delivered');
    }
    return { applied: true };
  }
}
