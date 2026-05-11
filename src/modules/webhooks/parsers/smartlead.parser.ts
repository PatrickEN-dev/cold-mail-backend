import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { ValidationError } from '@shared/errors/domain.error';
import {
  type EmailEventProvider,
  extractEmailAddress,
  type NormalizedEmailEvent,
  type NormalizedEventType,
} from './normalized-event';

/// SmartLead webhook payload (brief §18.8 — captured from prod 2026-04-15).
const smartLeadPayloadSchema = z.object({
  event_type: z.enum(['EMAIL_SENT', 'EMAIL_BOUNCE', 'EMAIL_OPEN', 'EMAIL_REPLY']),
  from_email: z.string(),
  to_email: z.string(),
  to_name: z.string().optional(),
  subject: z.string().optional(),
  custom_subject: z.string().optional(),
  sent_message: z
    .object({
      message_id: z.string(),
      html: z.string().optional(),
      text: z.string().optional(),
      time: z.string().optional(),
    })
    .optional(),
  reply_message: z
    .object({
      message_id: z.string().optional(),
      in_reply_to: z.string().optional(),
      subject: z.string().optional(),
      html: z.string().optional(),
      text: z.string().optional(),
    })
    .optional(),
  bounce: z.object({ type: z.enum(['hard', 'soft']), reason: z.string().optional() }).optional(),
});

const TYPE_MAP: Record<string, NormalizedEventType> = {
  EMAIL_SENT: 'sent',
  EMAIL_BOUNCE: 'bounced',
  EMAIL_OPEN: 'opened',
  EMAIL_REPLY: 'replied',
};

@Injectable()
export class SmartLeadWebhookParser {
  readonly provider: EmailEventProvider = 'smartlead';

  parse(raw: unknown): NormalizedEmailEvent {
    const result = smartLeadPayloadSchema.safeParse(raw);
    if (!result.success) {
      throw new ValidationError(`SmartLead payload invalid: ${result.error.message}`);
    }
    const { data } = result;
    const externalMessageId =
      data.reply_message?.message_id ?? data.sent_message?.message_id ?? `${data.event_type}:${data.to_email}`;

    return {
      provider: this.provider,
      type: TYPE_MAP[data.event_type],
      externalMessageId,
      occurredAt: data.sent_message?.time ? new Date(data.sent_message.time) : new Date(),
      to: extractEmailAddress(data.to_email),
      from: extractEmailAddress(data.from_email),
      subject: data.custom_subject ?? data.subject,
      reply:
        data.event_type === 'EMAIL_REPLY' && data.reply_message
          ? {
              subject: data.reply_message.subject,
              bodyHtml: data.reply_message.html,
              bodyText: data.reply_message.text,
              inReplyTo: data.reply_message.in_reply_to,
            }
          : undefined,
      bounce: data.bounce,
    };
  }
}
