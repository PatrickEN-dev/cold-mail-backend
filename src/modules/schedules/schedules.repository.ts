import { Injectable } from '@nestjs/common';
import { PrismaService } from '@infra/database/prisma.service';
import type { Prisma, Schedule } from '@prisma/client';

@Injectable()
export class SchedulesRepository {
  constructor(private readonly prisma: PrismaService) {}

  listForUser(userId: string): Promise<Schedule[]> {
    return this.prisma.schedule.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByIdForUser(id: string, userId: string): Promise<Schedule | null> {
    const schedule = await this.prisma.schedule.findUnique({ where: { id } });
    return schedule && schedule.userId === userId ? schedule : null;
  }

  create(data: Prisma.ScheduleCreateInput): Promise<Schedule> {
    return this.prisma.schedule.create({ data });
  }

  /// Caller MUST verify ownership via findByIdForUser before update/delete.
  update(id: string, data: Prisma.ScheduleUpdateInput): Promise<Schedule> {
    return this.prisma.schedule.update({ where: { id }, data });
  }

  delete(id: string): Promise<Schedule> {
    return this.prisma.schedule.delete({ where: { id } });
  }

  /// Global cron query — intentionally not scoped by userId (legitimate
  /// multi-tenant exception, see CLAUDE.md).
  findDue(now: Date, limit = 50): Promise<Schedule[]> {
    return this.prisma.schedule.findMany({
      where: { status: 'active', nextRunAt: { lte: now } },
      orderBy: { nextRunAt: 'asc' },
      take: limit,
    });
  }

  markFired(id: string, nextRunAt: Date | null, status: string): Promise<Schedule> {
    return this.prisma.schedule.update({
      where: { id },
      data: { lastRunAt: new Date(), nextRunAt, status },
    });
  }
}
