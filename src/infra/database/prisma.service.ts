import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { TypedConfigService } from '../config/typed-config.service';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(config: TypedConfigService) {
    // Prefer the pooled connection for runtime (pgbouncer) and fall back
    // to the direct URL when no pool is configured.
    const url = config.get('DATABASE_POOL_URL') ?? config.getOrThrow('DATABASE_URL');
    super({
      datasources: { db: { url } },
      log:
        config.get('NODE_ENV') === 'production'
          ? ['warn', 'error']
          : ['warn', 'error', 'info'],
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Prisma connected');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.log('Prisma disconnected');
  }
}
