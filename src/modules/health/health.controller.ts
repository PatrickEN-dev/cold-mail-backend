import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '@infra/database/prisma.service';
import { RedisService } from '@infra/cache/redis.service';
import { Public } from '@modules/auth/decorators/public.decorator';

interface HealthCheck {
  status: 'ok' | 'degraded' | 'down';
  uptimeSeconds: number;
  checks: {
    postgres: { ok: boolean; error?: string };
    redis: { ok: boolean; error?: string };
  };
  timestamp: string;
}

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Public()
  @Get()
  async check(): Promise<HealthCheck> {
    const [postgres, redis] = await Promise.all([this.checkPostgres(), this.checkRedis()]);
    const allOk = postgres.ok && redis.ok;
    return {
      status: allOk ? 'ok' : 'degraded',
      uptimeSeconds: Math.round(process.uptime()),
      checks: { postgres, redis },
      timestamp: new Date().toISOString(),
    };
  }

  private async checkPostgres(): Promise<{ ok: boolean; error?: string }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'unknown' };
    }
  }

  private async checkRedis(): Promise<{ ok: boolean; error?: string }> {
    try {
      const ok = await this.redis.ping();
      return { ok };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'unknown' };
    }
  }
}
