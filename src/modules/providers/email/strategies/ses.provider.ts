import { Injectable } from '@nestjs/common';
import { SendEmailCommand, SESClient } from '@aws-sdk/client-ses';
import { TypedConfigService } from '@infra/config/typed-config.service';
import { ExternalServiceError } from '@shared/errors/domain.error';
import type { IEmailProvider, SendEmailArgs, SendEmailResult } from '../types';

/// AWS SES — 0 senders in prod today, kept dormant.
@Injectable()
export class SesEmailProvider implements IEmailProvider {
  readonly name = 'ses' as const;
  private readonly client: SESClient | null;

  constructor(config: TypedConfigService) {
    const accessKey = config.get('SES_AWS_ACCESS_KEY_ID');
    const secretKey = config.get('SES_AWS_SECRET_ACCESS_KEY');
    if (!accessKey || !secretKey) {
      this.client = null;
      return;
    }
    this.client = new SESClient({
      region: config.get('SES_REGION'),
      credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
    });
  }

  async send(args: SendEmailArgs): Promise<SendEmailResult> {
    if (!this.client) {
      throw new ExternalServiceError('SES', 'AWS SES credentials not configured');
    }
    const command = new SendEmailCommand({
      Source: args.from.name
        ? `"${args.from.name}" <${args.from.address}>`
        : args.from.address,
      Destination: { ToAddresses: [args.to] },
      Message: {
        Subject: { Data: args.subject, Charset: 'UTF-8' },
        Body: {
          Html: { Data: args.html, Charset: 'UTF-8' },
          ...(args.text ? { Text: { Data: args.text, Charset: 'UTF-8' } } : {}),
        },
      },
      ReplyToAddresses: args.replyTo ? [args.replyTo] : undefined,
    });
    const result = await this.client.send(command);
    if (!result.MessageId) {
      throw new ExternalServiceError('SES', 'Missing message id in response');
    }
    return { providerMessageId: result.MessageId, acceptedAt: new Date() };
  }
}
