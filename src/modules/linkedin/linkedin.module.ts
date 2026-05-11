import { Module } from '@nestjs/common';
import { LinkedInProviderModule } from '@modules/providers/linkedin/linkedin-provider.module';
import { LinkedInController } from './linkedin.controller';

@Module({
  imports: [LinkedInProviderModule],
  controllers: [LinkedInController],
})
export class LinkedInModule {}
