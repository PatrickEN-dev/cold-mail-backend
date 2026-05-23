export const QUEUE_NAMES = {
  DISPATCH: 'dispatch',
  WARMUP: 'warmup',
  FOLLOWUPS: 'followups',
  SCHEDULES: 'schedules',
  WEBHOOKS: 'webhooks',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export const JOB_NAMES = {
  DISPATCH_SEND: 'dispatch.send',
  DISPATCH_BATCH_FINALIZE: 'dispatch.batch-finalize',

  WARMUP_TICK: 'warmup.tick',
  WARMUP_SEND: 'warmup.send',
  WARMUP_REPLY: 'warmup.reply',
  WARMUP_BOUNCE_CHECK: 'warmup.bounce-check',

  FOLLOWUPS_TICK: 'followups.tick',
  FOLLOWUPS_SEND: 'followups.send',

  SCHEDULES_TICK: 'schedules.tick',
  SCHEDULES_FIRE: 'schedules.fire',

  WEBHOOK_PROCESS: 'webhook.process',
} as const;
