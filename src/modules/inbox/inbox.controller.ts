import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { CurrentUser } from '@modules/auth/decorators/current-user.decorator';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { InboxRepository } from './inbox.repository';

@Controller('emails')
export class InboxController {
  constructor(private readonly repository: InboxRepository) {}

  @Get(':id/messages')
  list(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) emailId: string,
  ) {
    return this.repository.listForEmail(emailId, user.id);
  }
}
