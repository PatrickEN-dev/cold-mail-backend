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
import { SchedulesService } from './schedules.service';
import {
  createScheduleSchema,
  type CreateScheduleDto,
  updateScheduleSchema,
  type UpdateScheduleDto,
} from './dto/schedule.dto';

@Controller('schedules')
export class SchedulesController {
  constructor(private readonly service: SchedulesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.service.list(user.id);
  }

  @Get(':id')
  getById(@CurrentUser() user: AuthUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.getById(id, user.id);
  }

  @Post()
  @HttpCode(201)
  @UsePipes(new ZodValidationPipe(createScheduleSchema))
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateScheduleDto) {
    return this.service.create(user.id, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(updateScheduleSchema)) dto: UpdateScheduleDto,
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

  /// Wave 5: manual trigger — replaces app/api/schedules/trigger/ in Next.
  /// TODO(wave-5): enqueue dispatch.send via BullMQ producer once dispatch is wired.
  @Post(':id/trigger')
  @HttpCode(202)
  async trigger(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<{ scheduledAt: string; scheduleId: string }> {
    const schedule = await this.service.getById(id, user.id);
    return { scheduleId: schedule.id, scheduledAt: new Date().toISOString() };
  }
}
