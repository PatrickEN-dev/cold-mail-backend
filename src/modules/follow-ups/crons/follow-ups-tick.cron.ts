import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { TypedConfigService } from '@infra/config/typed-config.service';

/// Wave 6: replaces N8N `0x9tjMCXLxba1LqZ`. Brief §18.1/§18.6 — runs Mon-Thu 12:00.
/// Bug B5 in legacy: only resend leads got follow-ups. Migration must include
/// every dispatch_platform.
/// TODO(wave-6): walk leads with status='sent'/'delivered' past N days without
/// reply, build follow-up template, enqueue dispatch.send.
@Injectable()
export class FollowUpsTickCron {
  private readonly logger = new Logger(FollowUpsTickCron.name);

  constructor(private readonly config: TypedConfigService) {}

  @Cron('0 12 * * 1-4', { name: 'follow-ups-tick', timeZone: 'America/Sao_Paulo' })
  handle(): void {
    if (!this.config.get('ENABLE_FOLLOWUPS_CRON')) return;
    this.logger.log('follow-ups-tick — TODO wave 6');
  }
}
