import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';

import { ConfigModule } from '@infra/config/config.module';
import { LoggerModule } from '@infra/observability/logger.module';
import { ObservabilityModule } from '@infra/observability/observability.module';
import { PrismaModule } from '@infra/database/prisma.module';
import { CacheModule } from '@infra/cache/cache.module';
import { QueueModule } from '@infra/queue/queue.module';
import { SentryExceptionFilter } from '@infra/observability/sentry.exception-filter';
import { DomainExceptionFilter } from '@shared/errors/domain-exception.filter';

import { AuthModule } from '@modules/auth/auth.module';
import { HealthModule } from '@modules/health/health.module';
import { LeadsModule } from '@modules/leads/leads.module';
import { SendersModule } from '@modules/senders/senders.module';
import { TemplatesModule } from '@modules/templates/templates.module';
import { SchedulesModule } from '@modules/schedules/schedules.module';
import { DispatchModule } from '@modules/dispatch/dispatch.module';
import { WebhooksModule } from '@modules/webhooks/webhooks.module';
import { InboxModule } from '@modules/inbox/inbox.module';
import { WarmupModule } from '@modules/warmup/warmup.module';
import { FollowUpsModule } from '@modules/follow-ups/follow-ups.module';
import { AiModule } from '@modules/ai/ai.module';
import { AnalyticsModule } from '@modules/analytics/analytics.module';
import { SearchModule } from '@modules/search/search.module';
import { LinkedInModule } from '@modules/linkedin/linkedin.module';
import { EmailProvidersModule } from '@modules/providers/email/email-providers.module';

@Module({
  imports: [
    ConfigModule,
    LoggerModule,
    ObservabilityModule,
    PrismaModule,
    CacheModule,
    QueueModule,
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot({ wildcard: true }),

    AuthModule,
    HealthModule,

    LeadsModule,
    SendersModule,
    TemplatesModule,
    SchedulesModule,
    EmailProvidersModule,
    DispatchModule,
    WebhooksModule,
    InboxModule,
    WarmupModule,
    FollowUpsModule,
    AiModule,
    AnalyticsModule,
    SearchModule,
    LinkedInModule,
  ],
  providers: [
    // Nest picks the filter whose `@Catch(...)` is most specific to the thrown
    // error — array order does not matter here. DomainExceptionFilter handles
    // DomainError; SentryExceptionFilter is the catch-all and reports to Sentry.
    { provide: APP_FILTER, useClass: SentryExceptionFilter },
    { provide: APP_FILTER, useClass: DomainExceptionFilter },
  ],
})
export class AppModule {}
