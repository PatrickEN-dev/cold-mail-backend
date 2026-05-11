/// Queue names. Use these constants — never raw strings.
export const QUEUE_NAMES = {
  DISPATCH: 'dispatch',
  WARMUP: 'warmup',
  FOLLOWUPS: 'followups',
  SCHEDULES: 'schedules',
  WEBHOOKS: 'webhooks',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

/// Job names within each queue.
export const JOB_NAMES = {
  // dispatch
  DISPATCH_SEND: 'dispatch.send',
  DISPATCH_BATCH_FINALIZE: 'dispatch.batch-finalize',

  // warmup
  WARMUP_TICK: 'warmup.tick',
  WARMUP_SEND: 'warmup.send',
  WARMUP_REPLY: 'warmup.reply',
  WARMUP_BOUNCE_CHECK: 'warmup.bounce-check',

  // followups
  FOLLOWUPS_TICK: 'followups.tick',
  FOLLOWUPS_SEND: 'followups.send',

  // schedules
  SCHEDULES_TICK: 'schedules.tick',
  SCHEDULES_FIRE: 'schedules.fire',

  // webhooks
  WEBHOOK_PROCESS: 'webhook.process',
} as const;
