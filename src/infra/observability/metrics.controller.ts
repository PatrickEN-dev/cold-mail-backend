import { Controller, Get, Header } from '@nestjs/common';
import { Public } from '@modules/auth/decorators/public.decorator';
import { MetricsService } from './metrics.service';

@Controller('metrics')
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Public()
  @Get()
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  expose(): Promise<string> {
    return this.metrics.registry.metrics();
  }
}
