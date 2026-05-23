import { Body, Controller, HttpCode, Logger, Post } from '@nestjs/common';
import { ZodValidationPipe } from '@shared/pipes/zod-validation.pipe';
import { CurrentUser } from '@modules/auth/decorators/current-user.decorator';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { searchRequestSchema, type SearchRequestDto } from './dto/search.dto';

/// Fixes bug B2 by using the authenticated user's id (legacy hardcoded a uuid).
/// TODO(wave-6): wire RapidAPI geocoding + local-business-data + verify-email
/// + AI classifier, then persist enriched leads.
@Controller('search')
export class SearchController {
  private readonly logger = new Logger(SearchController.name);

  @Post()
  @HttpCode(202)
  enqueue(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(searchRequestSchema)) dto: SearchRequestDto,
  ) {
    this.logger.log({ userId: user.id, dto }, 'search request received — TODO wave 6');
    return { status: 'accepted', userId: user.id, dto };
  }
}
