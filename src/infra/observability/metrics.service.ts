import { Injectable, OnModuleInit } from '@nestjs/common';
import { Counter, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

@Injectable()
export class MetricsService implements OnModuleInit {
  readonly registry = new Registry();

  readonly dispatchTotal = new Counter({
    name: 'coldmail_dispatch_total',
    help: 'Total dispatch attempts by provider and status',
    labelNames: ['provider', 'status'] as const,
  });

  readonly webhookEventsTotal = new Counter({
    name: 'coldmail_webhook_events_total',
    help: 'Webhook events received by provider and type',
    labelNames: ['provider', 'event', 'outcome'] as const,
  });

  readonly senderQuotaSkipsTotal = new Counter({
    name: 'coldmail_sender_quota_skips_total',
    help: 'Times a send was skipped because the sender hit dailyLimit',
    labelNames: ['provider'] as const,
  });

  readonly providerSendDuration = new Histogram({
    name: 'coldmail_provider_send_duration_seconds',
    help: 'Provider send() duration in seconds',
    labelNames: ['provider', 'status'] as const,
    buckets: [0.1, 0.25, 0.5, 1, 2, 5, 10, 30],
  });

  onModuleInit(): void {
    collectDefaultMetrics({ register: this.registry, prefix: 'coldmail_node_' });
    this.registry.registerMetric(this.dispatchTotal);
    this.registry.registerMetric(this.webhookEventsTotal);
    this.registry.registerMetric(this.senderQuotaSkipsTotal);
    this.registry.registerMetric(this.providerSendDuration);
  }
}
