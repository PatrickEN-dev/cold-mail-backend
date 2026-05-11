import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UsePipes,
} from '@nestjs/common';
import { ZodValidationPipe } from '@shared/pipes/zod-validation.pipe';
import { CurrentUser } from '@modules/auth/decorators/current-user.decorator';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { SendersService } from './senders.service';
import {
  type CreateSenderDto,
  createSenderSchema,
  type UpdateSenderDto,
  updateSenderSchema,
} from './dto/sender.dto';

@Controller('senders')
export class SendersController {
  constructor(private readonly service: SendersService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.service.listForUser(user.id);
  }

  @Get(':id')
  getById(@CurrentUser() user: AuthUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.getByIdForUser(id, user.id);
  }

  @Post()
  @HttpCode(201)
  @UsePipes(new ZodValidationPipe(createSenderSchema))
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateSenderDto) {
    return this.service.create(user.id, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(updateSenderSchema)) dto: UpdateSenderDto,
  ) {
    return this.service.update(id, user.id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  async delete(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    await this.service.delete(id, user.id);
  }
}
