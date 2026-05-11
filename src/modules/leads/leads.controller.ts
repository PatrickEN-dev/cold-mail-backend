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
  Query,
  UsePipes,
} from '@nestjs/common';
import { ZodValidationPipe } from '@shared/pipes/zod-validation.pipe';
import { CurrentUser } from '@modules/auth/decorators/current-user.decorator';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { LeadsService } from './leads.service';
import {
  createLeadSchema,
  type CreateLeadDto,
  listLeadsQuerySchema,
  type ListLeadsQuery,
  updateLeadSchema,
  type UpdateLeadDto,
} from './dto/lead.dto';

@Controller('leads')
export class LeadsController {
  constructor(private readonly service: LeadsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(listLeadsQuerySchema)) query: ListLeadsQuery,
  ) {
    return this.service.list(user.id, query);
  }

  @Get(':id')
  getById(@CurrentUser() user: AuthUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.getById(id, user.id);
  }

  @Post()
  @HttpCode(201)
  @UsePipes(new ZodValidationPipe(createLeadSchema))
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateLeadDto) {
    return this.service.create(user.id, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(updateLeadSchema)) dto: UpdateLeadDto,
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
