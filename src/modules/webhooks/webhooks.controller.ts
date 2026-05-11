import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import type { FastifyRequest } from 'fastify';
import { Public } from '@modules/auth/decorators/public.decorator';
import { TypedConfigService } from '@infra/config/typed-config.service';
import { ForbiddenError } from '@shared/errors/domain.error';
import { verifyHmacSignature } from '@shared/http/idempotency';
import { ResendWebhookParser } from './parsers/resend.parser';
import { SmartLeadWebhookParser } from './parsers/smartlead.parser';
import { ZapmailWebhookParser } from './parsers/zapmail.parser';
import { IngestEmailEventUseCase } from './application/ingest-email-event.use-case';
import type { EmailEventProvider } from './parsers/normalized-event';

interface RawBodyRequest extends FastifyRequest {
  rawBody?: Buffer;
}

@Controller('webhooks')
export class WebhooksController {
  constructor(
    private readonly config: TypedConfigService,
    private readonly resendParser: ResendWebhookParser,
    private readonly smartLeadParser: SmartLeadWebhookParser,
    private readonly zapmailParser: ZapmailWebhookParser,
    private readonly ingest: IngestEmailEventUseCase,
  ) {}

  @Public()
  @Post('email-events')
  @HttpCode(200)
  async emailEvents(
    @Req() req: RawBodyRequest,
    @Query('provider') provider: EmailEventProvider | undefined,
    @Headers('x-signature') signature: string | undefined,
    @Headers('x-webhook-timestamp') timestamp: string | undefined,
    @Headers('x-webhook-secret') secretHeader: string | undefined,
    @Body() body: unknown,
  ): Promise<{ status: string }> {
    if (!provider) throw new BadRequestException('?provider= is required');

    this.verifySignature(provider, req.rawBody, signature, timestamp, secretHeader);

    const normalized =
      provider === 'resend'
        ? this.resendParser.parse(body)
        : provider === 'smartlead'
          ? this.smartLeadParser.parse(body)
          : this.zapmailParser.parse(body);

    if (!normalized) return { status: 'ignored' };

    const result = await this.ingest.execute(normalized);
    return { status: result.applied ? 'applied' : 'skipped' };
  }

  private verifySignature(
    provider: EmailEventProvider,
    rawBody: Buffer | undefined,
    signature: string | undefined,
    timestamp: string | undefined,
    secretHeader: string | undefined,
  ): void {
    const secret =
      provider === 'smartlead'
        ? this.config.get('SMARTLEAD_WEBHOOK_SECRET')
        : provider === 'zapmail'
          ? this.config.get('ZAPMAIL_WEBHOOK_SECRET')
          : this.config.get('WEBHOOK_HMAC_SECRET');

    if (!secret) return;

    if (signature) {
      if (!rawBody) {
        throw new ForbiddenError('Cannot verify signature: raw body unavailable');
      }
      // When `x-webhook-timestamp` is sent, we enforce a 5-min replay window
      // (Stripe-style). Without it we fall back to plain HMAC of the body.
      const ok = verifyHmacSignature({
        rawBody,
        signature,
        secret,
        timestamp,
        toleranceSec: 300,
      });
      if (!ok) throw new ForbiddenError('Invalid webhook signature');
      return;
    }
    if (secretHeader) {
      // Constant-time compare on shared-secret header (some providers use this).
      const sigBuf = Buffer.from(secretHeader, 'utf8');
      const expBuf = Buffer.from(secret, 'utf8');
      if (sigBuf.length !== expBuf.length) throw new ForbiddenError('Invalid webhook secret');
      if (!timingSafeEqual(sigBuf, expBuf)) {
        throw new ForbiddenError('Invalid webhook secret');
      }
      return;
    }
    throw new ForbiddenError('Missing webhook signature');
  }
}
