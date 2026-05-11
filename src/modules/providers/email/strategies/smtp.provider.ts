import { Injectable } from '@nestjs/common';
import { createTransport, type Transporter, type SendMailOptions } from 'nodemailer';
import { TypedConfigService } from '@infra/config/typed-config.service';
import { ExternalServiceError } from '@shared/errors/domain.error';
import type { IEmailProvider, SendEmailArgs, SendEmailResult } from '../types';

interface SmtpSentInfo {
  messageId: string;
}

/// Generic SMTP fallback. Functional out of the box if SMTP_* envs are set.
@Injectable()
export class SmtpEmailProvider implements IEmailProvider {
  readonly name = 'smtp' as const;
  private readonly transporter: Transporter | null;

  constructor(config: TypedConfigService) {
    const host = config.get('SMTP_HOST');
    if (!host) {
      this.transporter = null;
      return;
    }
    this.transporter = createTransport({
      host,
      port: config.get('SMTP_PORT'),
      secure: config.get('SMTP_PORT') === 465,
      auth: config.get('SMTP_USER')
        ? { user: config.get('SMTP_USER'), pass: config.get('SMTP_PASSWORD') }
        : undefined,
    });
  }

  async send(args: SendEmailArgs): Promise<SendEmailResult> {
    if (!this.transporter) {
      throw new ExternalServiceError('SMTP', 'SMTP_HOST not configured');
    }
    const mail: SendMailOptions = {
      from: args.from.name
        ? `"${args.from.name}" <${args.from.address}>`
        : args.from.address,
      to: args.to,
      subject: args.subject,
      html: args.html,
      text: args.text,
      replyTo: args.replyTo,
      headers: args.headers,
      inReplyTo: args.threadingHints?.inReplyTo,
      references: args.threadingHints?.references,
    };
    const info = (await this.transporter.sendMail(mail)) as SmtpSentInfo;
    return { providerMessageId: info.messageId, acceptedAt: new Date() };
  }
}
