import { Module } from '@nestjs/common';
import { UnipileProvider } from './unipile.provider';
import { LINKEDIN_PROVIDER } from './linkedin.tokens';

@Module({
  providers: [{ provide: LINKEDIN_PROVIDER, useClass: UnipileProvider }],
  exports: [LINKEDIN_PROVIDER],
})
export class LinkedInProviderModule {}
