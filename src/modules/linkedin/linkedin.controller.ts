import { Body, Controller, Headers, HttpCode, Inject, Logger, Post, Req } from '@nestjs/common';
import { ZodValidationPipe } from '@shared/pipes/zod-validation.pipe';
import { Public } from '@modules/auth/decorators/public.decorator';
import { CurrentUser } from '@modules/auth/decorators/current-user.decorator';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { PrismaService } from '@infra/database/prisma.service';
import { LINKEDIN_PROVIDER } from '@modules/providers/linkedin/linkedin.tokens';
import type { ILinkedInProvider } from '@modules/providers/linkedin/types';
import { TypedConfigService } from '@infra/config/typed-config.service';
import { ForbiddenError, NotFoundError } from '@shared/errors/domain.error';
import { verifyHmacSignature } from '@shared/http/idempotency';
import {
  sendLinkedInMessageSchema,
  type SendLinkedInMessageDto,
} from './dto/linkedin.dto';

/// Multi-tenant fix for bug B13: derive account from the authenticated user,
/// not a hardcoded attendee_id.
@Controller('linkedin')
export class LinkedInController {
  private readonly logger = new Logger(LinkedInController.name);

  constructor(
    private readonly config: TypedConfigService,
    private readonly prisma: PrismaService,
    @Inject(LINKEDIN_PROVIDER) private readonly provider: ILinkedInProvider,
  ) {}

  @Post('messages')
  @HttpCode(202)
  async send(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(sendLinkedInMessageSchema)) dto: SendLinkedInMessageDto,
  ) {
    // Ownership check: the account must belong to the authenticated tenant.
    // Legacy rows (NULL user_id) are intentionally locked out until backfill.
    const account = await this.prisma.linkedInAccount.findFirst({
      where: { accountId: dto.accountId, userId: user.id },
    });
    if (!account) {
      throw new NotFoundError(`LinkedIn account ${dto.accountId} not found`);
    }
    this.logger.log(
      { actorUserId: user.id, accountId: dto.accountId },
      'linkedin.send authorized',
    );

    const profile = await this.provider.lookupProfile({
      accountId: dto.accountId,
      publicIdentifier: dto.publicIdentifier,
    });
    if (profile.isRelationship) {
      return this.provider.sendDm({
        accountId: dto.accountId,
        attendeesIds: [profile.providerId],
        text: dto.message,
      });
    }
    return this.provider.sendInvite({
      accountId: dto.accountId,
      providerId: profile.providerId,
      message: dto.inviteMessage ?? dto.message,
    });
  }

  @Public()
  @Post('webhooks/unipile')
  @HttpCode(200)
  unipileWebhook(
    @Req() req: { rawBody?: Buffer },
    @Headers('x-unipile-signature') signature: string | undefined,
    @Headers('x-webhook-timestamp') timestamp: string | undefined,
    @Body() body: unknown,
  ) {
    const secret = this.config.get('UNIPILE_WEBHOOK_SECRET');
    if (secret) {
      if (!signature) throw new ForbiddenError('Missing webhook signature');
      if (!req.rawBody) throw new ForbiddenError('Raw body unavailable for signature verification');
      const ok = verifyHmacSignature({
        rawBody: req.rawBody,
        signature,
        secret,
        timestamp,
        toleranceSec: 300,
      });
      if (!ok) throw new ForbiddenError('Invalid webhook signature');
    }
    this.logger.log({ body }, 'unipile webhook received — TODO wave 7');
    return { status: 'accepted' };
  }
}
