import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { ValidationError } from '@shared/errors/domain.error';
import {
  type EmailEventProvider,
  extractEmailAddress,
  type NormalizedEmailEvent,
  type NormalizedEventType,
} from './normalized-event';

/// Resend webhook payload (brief §2.1 — Onda 2).
/// Note: Resend does NOT emit reply events on its standard webhook —
/// inbound parsing is configured at the domain level. SmartLead is where
/// EMAIL_REPLY arrives today.
const resendPayloadSchema = z.object({
  type: z.string(),
  created_at: z.string(),
  data: z.object({
    email_id: z.string(),
    from: z.string(),
    to: z.array(z.string()).or(z.string()),
    subject: z.string().optional(),
  }),
});

const TYPE_MAP: Record<string, NormalizedEventType | null> = {
  'email.sent': 'sent',
  'email.delivered': 'delivered',
  'email.bounced': 'bounced',
  'email.opened': 'opened',
  'email.complained': null, // ignored
};

@Injectable()
export class ResendWebhookParser {
  readonly provider: EmailEventProvider = 'resend';

  parse(raw: unknown): NormalizedEmailEvent | null {
    const result = resendPayloadSchema.safeParse(raw);
    if (!result.success) {
      throw new ValidationError(`Resend payload invalid: ${result.error.message}`);
    }
    const { data } = result;
    const eventType = TYPE_MAP[data.type];
    if (!eventType) return null;
    const to = Array.isArray(data.data.to) ? data.data.to[0] : data.data.to;
    return {
      provider: this.provider,
      type: eventType,
      externalMessageId: data.data.email_id,
      occurredAt: new Date(data.created_at),
      to: extractEmailAddress(to),
      from: extractEmailAddress(data.data.from),
      subject: data.data.subject,
    };
  }
}
