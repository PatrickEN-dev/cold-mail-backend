import { Module } from '@nestjs/common';
import { LeadsModule } from '@modules/leads/leads.module';
import { InboxModule } from '@modules/inbox/inbox.module';
import { WebhooksController } from './webhooks.controller';
import { ResendWebhookParser } from './parsers/resend.parser';
import { SmartLeadWebhookParser } from './parsers/smartlead.parser';
import { ZapmailWebhookParser } from './parsers/zapmail.parser';
import { IngestEmailEventUseCase } from './application/ingest-email-event.use-case';

@Module({
  imports: [LeadsModule, InboxModule],
  controllers: [WebhooksController],
  providers: [
    ResendWebhookParser,
    SmartLeadWebhookParser,
    ZapmailWebhookParser,
    IngestEmailEventUseCase,
  ],
})
export class WebhooksModule {}
