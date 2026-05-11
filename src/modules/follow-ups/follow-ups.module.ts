import { Module } from '@nestjs/common';
import { LeadsModule } from '@modules/leads/leads.module';
import { TemplatesModule } from '@modules/templates/templates.module';
import { FollowUpsTickCron } from './crons/follow-ups-tick.cron';

@Module({
  imports: [LeadsModule, TemplatesModule],
  providers: [FollowUpsTickCron],
})
export class FollowUpsModule {}
