export const PROVIDER_NAMES = [
  'resend',
  'zapmail',
  'smtp',
  'google',
  'ses',
  'mailgun',
  'outlook',
] as const;
export type ProviderName = (typeof PROVIDER_NAMES)[number];

export interface SendEmailArgs {
  from: { address: string; name?: string };
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  headers?: Record<string, string>;
  threadingHints?: {
    inReplyTo?: string;
    references?: string;
  };
}

export interface SendEmailResult {
  providerMessageId: string;
  acceptedAt: Date;
}

export interface DomainStatus {
  domain: string;
  verified: boolean;
  spf?: boolean;
  dkim?: boolean;
  dmarc?: boolean;
}

export interface IEmailProvider {
  readonly name: ProviderName;
  send(args: SendEmailArgs): Promise<SendEmailResult>;
  verifyDomain?(domain: string): Promise<DomainStatus>;
}
