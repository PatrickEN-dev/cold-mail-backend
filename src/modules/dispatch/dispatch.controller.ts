import { Body, Controller, HttpCode, Post, UsePipes } from '@nestjs/common';
import { ZodValidationPipe } from '@shared/pipes/zod-validation.pipe';
import { CurrentUser } from '@modules/auth/decorators/current-user.decorator';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { SendBatchUseCase } from './application/send-batch.use-case';
import { dispatchBatchSchema, type DispatchBatchDto } from './dto/dispatch.dto';

@Controller('dispatch')
export class DispatchController {
  constructor(private readonly sendBatch: SendBatchUseCase) {}

  @Post()
  @HttpCode(202)
  @UsePipes(new ZodValidationPipe(dispatchBatchSchema))
  async create(
    @CurrentUser() user: AuthUser,
    @Body() dto: DispatchBatchDto,
  ): Promise<{ batchId: string; enqueued: number }> {
    return this.sendBatch.execute(user.id, dto);
  }
}
