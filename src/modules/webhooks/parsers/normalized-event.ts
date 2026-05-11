export type NormalizedEventType = 'sent' | 'delivered' | 'bounced' | 'opened' | 'replied';
export type EmailEventProvider = 'resend' | 'smartlead' | 'zapmail';

export interface NormalizedEmailEvent {
  provider: EmailEventProvider;
  type: NormalizedEventType;
  externalMessageId: string;
  occurredAt: Date;
  to: string;
  from: string;
  fromName?: string;
  subject?: string;
  reply?: {
    fromName?: string;
    subject?: string;
    bodyText?: string;
    bodyHtml?: string;
    inReplyTo?: string;
  };
  bounce?: {
    type: 'hard' | 'soft';
    reason?: string;
  };
}

/// Extract addr from "Name <addr@x.com>" — mirrors N8N regex in §18.2.
export function extractEmailAddress(input: string): string {
  const match = input.match(/<([^>]+)>/);
  return match?.[1] ?? input.trim();
}
