/// Authoritative domain event catalog. See brief §7.4.
/// Use these constants — never raw strings.
export const EVENT_NAMES = {
  EMAIL_SENT: 'email.sent',
  EMAIL_SEND_FAILED: 'email.send-failed',
  EMAIL_OPENED: 'email.opened',
  REPLY_RECEIVED: 'reply.received',
  BOUNCE_RECEIVED: 'bounce.received',

  WARMUP_SENT: 'warmup.sent',
  WARMUP_AUTO_PAUSED: 'warmup.auto-paused',

  SCHEDULE_FIRED: 'schedule.fired',

  LINKEDIN_MESSAGE_RECEIVED: 'linkedin.message-received',
} as const;

export type EventName = (typeof EVENT_NAMES)[keyof typeof EVENT_NAMES];
