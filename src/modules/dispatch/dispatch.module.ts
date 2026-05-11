import { Module } from '@nestjs/common';
import { LeadsModule } from '@modules/leads/leads.module';
import { SendersModule } from '@modules/senders/senders.module';
import { TemplatesModule } from '@modules/templates/templates.module';
import { EmailProvidersModule } from '@modules/providers/email/email-providers.module';
import { DispatchController } from './dispatch.controller';
import { SendBatchUseCase } from './application/send-batch.use-case';
import { SendOneUseCase } from './application/send-one.use-case';
import { DispatchWorker } from './workers/dispatch.worker';

@Module({
  imports: [LeadsModule, SendersModule, TemplatesModule, EmailProvidersModule],
  controllers: [DispatchController],
  providers: [SendBatchUseCase, SendOneUseCase, DispatchWorker],
  exports: [SendBatchUseCase],
})
export class DispatchModule {}
