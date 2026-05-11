import { Module } from '@nestjs/common';
import { EmailProviderRegistry } from './email-provider.registry';
import { EMAIL_PROVIDER_TOKENS } from './providers.tokens';
import { ResendEmailProvider } from './strategies/resend.provider';
import { ZapmailEmailProvider } from './strategies/zapmail.provider';
import { SmtpEmailProvider } from './strategies/smtp.provider';
import { GoogleEmailProvider } from './strategies/google.provider';
import { SesEmailProvider } from './strategies/ses.provider';
import { MailgunEmailProvider } from './strategies/mailgun.provider';
import { OutlookEmailProvider } from './strategies/outlook.provider';

@Module({
  providers: [
    { provide: EMAIL_PROVIDER_TOKENS.resend, useClass: ResendEmailProvider },
    { provide: EMAIL_PROVIDER_TOKENS.zapmail, useClass: ZapmailEmailProvider },
    { provide: EMAIL_PROVIDER_TOKENS.smtp, useClass: SmtpEmailProvider },
    { provide: EMAIL_PROVIDER_TOKENS.google, useClass: GoogleEmailProvider },
    { provide: EMAIL_PROVIDER_TOKENS.ses, useClass: SesEmailProvider },
    { provide: EMAIL_PROVIDER_TOKENS.mailgun, useClass: MailgunEmailProvider },
    { provide: EMAIL_PROVIDER_TOKENS.outlook, useClass: OutlookEmailProvider },
    EmailProviderRegistry,
  ],
  exports: [EmailProviderRegistry],
})
export class EmailProvidersModule {}
