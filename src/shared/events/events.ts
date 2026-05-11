import { BaseDomainEvent } from '../domain/domain-event';
import { EVENT_NAMES } from './event-names';

export interface EmailSentPayload {
  emailId: string;
  userId: string;
  senderEmailId: string;
  providerMessageId: string;
  sentAt: Date;
}
export class EmailSentEvent extends BaseDomainEvent<EmailSentPayload> {
  readonly name = EVENT_NAMES.EMAIL_SENT;
  constructor(payload: EmailSentPayload) {
    super(payload);
  }
}

export interface EmailSendFailedPayload {
  emailId: string;
  userId: string;
  error: { code: string; message: string };
  attemptedAt: Date;
}
export class EmailSendFailedEvent extends BaseDomainEvent<EmailSendFailedPayload> {
  readonly name = EVENT_NAMES.EMAIL_SEND_FAILED;
  constructor(payload: EmailSendFailedPayload) {
    super(payload);
  }
}

export interface ReplyReceivedPayload {
  emailId: string;
  userId: string;
  fromAddress: string;
  fromName?: string;
  subject?: string;
  bodyText?: string;
  bodyHtml?: string;
  providerMessageId: string;
  receivedAt: Date;
}
export class ReplyReceivedEvent extends BaseDomainEvent<ReplyReceivedPayload> {
  readonly name = EVENT_NAMES.REPLY_RECEIVED;
  constructor(payload: ReplyReceivedPayload) {
    super(payload);
  }
}

export interface BounceReceivedPayload {
  emailId: string;
  userId: string;
  senderEmailId: string;
  bounceType: 'hard' | 'soft';
  reason?: string;
  receivedAt: Date;
}
export class BounceReceivedEvent extends BaseDomainEvent<BounceReceivedPayload> {
  readonly name = EVENT_NAMES.BOUNCE_RECEIVED;
  constructor(payload: BounceReceivedPayload) {
    super(payload);
  }
}

export interface EmailOpenedPayload {
  emailId: string;
  userId: string;
  openedAt: Date;
}
export class EmailOpenedEvent extends BaseDomainEvent<EmailOpenedPayload> {
  readonly name = EVENT_NAMES.EMAIL_OPENED;
  constructor(payload: EmailOpenedPayload) {
    super(payload);
  }
}

export interface WarmupSentPayload {
  senderEmailId: string;
  userId: string;
  threadId: string;
  sentAt: Date;
}
export class WarmupSentEvent extends BaseDomainEvent<WarmupSentPayload> {
  readonly name = EVENT_NAMES.WARMUP_SENT;
  constructor(payload: WarmupSentPayload) {
    super(payload);
  }
}

export interface WarmupAutoPausedPayload {
  senderEmailId: string;
  userId: string;
  reason: string;
  bounceRatePct: number;
}
export class WarmupAutoPausedEvent extends BaseDomainEvent<WarmupAutoPausedPayload> {
  readonly name = EVENT_NAMES.WARMUP_AUTO_PAUSED;
  constructor(payload: WarmupAutoPausedPayload) {
    super(payload);
  }
}

export interface ScheduleFiredPayload {
  scheduleId: string;
  userId: string;
  leadIds: string[];
  senderEmailId: string;
}
export class ScheduleFiredEvent extends BaseDomainEvent<ScheduleFiredPayload> {
  readonly name = EVENT_NAMES.SCHEDULE_FIRED;
  constructor(payload: ScheduleFiredPayload) {
    super(payload);
  }
}

export interface LinkedInMessageReceivedPayload {
  messageId: string;
  userId: string;
  accountId: string;
  fromIdentifier: string;
  body: string;
  receivedAt: Date;
}
export class LinkedInMessageReceivedEvent extends BaseDomainEvent<LinkedInMessageReceivedPayload> {
  readonly name = EVENT_NAMES.LINKEDIN_MESSAGE_RECEIVED;
  constructor(payload: LinkedInMessageReceivedPayload) {
    super(payload);
  }
}
