import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '@modules/auth/decorators/current-user.decorator';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly service: AnalyticsService) {}

  @Get('pipeline-metrics')
  pipelineMetrics(@CurrentUser() user: AuthUser) {
    return this.service.pipelineMetrics(user.id);
  }

  @Get('sender-email-stats')
  senderEmailStats(@CurrentUser() user: AuthUser) {
    return this.service.senderEmailStats(user.id);
  }

  @Get('campaigns')
  userCampaignNames(@CurrentUser() user: AuthUser) {
    return this.service.userCampaignNames(user.id);
  }
}
