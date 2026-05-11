import { Injectable, Logger } from '@nestjs/common';
import { ExternalServiceError } from '@shared/errors/domain.error';
import type { IEmailProvider, SendEmailArgs, SendEmailResult } from '../types';

/// Outlook / Microsoft Graph — 0 senders in prod (brief §6.3). Stub for now.
/// TODO: implement when an Outlook sender is configured by a client.
@Injectable()
export class OutlookEmailProvider implements IEmailProvider {
  readonly name = 'outlook' as const;
  private readonly logger = new Logger(OutlookEmailProvider.name);

  send(_args: SendEmailArgs): Promise<SendEmailResult> {
    this.logger.warn('OutlookEmailProvider.send not implemented yet — see TODO');
    throw new ExternalServiceError('Outlook', 'OutlookEmailProvider not implemented yet');
  }
}
