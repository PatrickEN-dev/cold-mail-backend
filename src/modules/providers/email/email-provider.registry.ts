import { Inject, Injectable } from '@nestjs/common';
import { ExternalServiceError } from '@shared/errors/domain.error';
import { ResilientEmailProvider } from './resilience/resilient-provider';
import { EMAIL_PROVIDER_TOKENS } from './providers.tokens';
import type { IEmailProvider, ProviderName } from './types';

/// Resolves the right strategy based on `sender_emails.provider`.
/// Each strategy is wrapped with retry + timeout + circuit breaker.
@Injectable()
export class EmailProviderRegistry {
  private readonly map: Record<ProviderName, IEmailProvider>;

  constructor(
    @Inject(EMAIL_PROVIDER_TOKENS.resend) resend: IEmailProvider,
    @Inject(EMAIL_PROVIDER_TOKENS.zapmail) zapmail: IEmailProvider,
    @Inject(EMAIL_PROVIDER_TOKENS.smtp) smtp: IEmailProvider,
    @Inject(EMAIL_PROVIDER_TOKENS.google) google: IEmailProvider,
    @Inject(EMAIL_PROVIDER_TOKENS.ses) ses: IEmailProvider,
    @Inject(EMAIL_PROVIDER_TOKENS.mailgun) mailgun: IEmailProvider,
    @Inject(EMAIL_PROVIDER_TOKENS.outlook) outlook: IEmailProvider,
  ) {
    this.map = {
      resend: new ResilientEmailProvider(resend),
      zapmail: new ResilientEmailProvider(zapmail),
      smtp: new ResilientEmailProvider(smtp),
      google: new ResilientEmailProvider(google),
      ses: new ResilientEmailProvider(ses),
      mailgun: new ResilientEmailProvider(mailgun),
      outlook: new ResilientEmailProvider(outlook),
    };
  }

  resolve(name: ProviderName): IEmailProvider {
    const provider = this.map[name];
    if (!provider) {
      throw new ExternalServiceError('EmailProviderRegistry', `Unknown provider: ${name}`);
    }
    return provider;
  }
}
