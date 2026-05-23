import { Injectable } from '@nestjs/common';
import { PrismaService } from '@infra/database/prisma.service';
import type { Email, Prisma } from '@prisma/client';

interface ListFilters {
  userId: string;
  status?: string;
  campaignName?: string;
  limit: number;
  offset: number;
}

@Injectable()
export class LeadsRepository {
  constructor(private readonly prisma: PrismaService) {}

  listForUser(filters: ListFilters): Promise<Email[]> {
    return this.prisma.email.findMany({
      where: {
        userId: filters.userId,
        status: filters.status,
        campaignName: filters.campaignName,
      },
      orderBy: { createdAt: 'desc' },
      take: filters.limit,
      skip: filters.offset,
    });
  }

  async findByIdForUser(id: string, userId: string): Promise<Email | null> {
    const lead = await this.prisma.email.findUnique({ where: { id } });
    return lead && lead.userId === userId ? lead : null;
  }

  findLatestByEmailForUser(email: string, userId: string): Promise<Email | null> {
    return this.prisma.email.findFirst({
      where: { userId, email },
      orderBy: { dateSent: 'desc' },
    });
  }

  /// Cross-tenant lookup — only used by webhooks where the provider event
  /// carries an email address but no user_id. Caller must scope downstream.
  findLatestByEmailAny(email: string): Promise<Email | null> {
    return this.prisma.email.findFirst({
      where: { email },
      orderBy: { dateSent: 'desc' },
    });
  }

  create(data: Prisma.EmailCreateInput): Promise<Email> {
    return this.prisma.email.create({ data });
  }

  /// Caller MUST verify ownership via findByIdForUser before update/delete.
  update(id: string, data: Prisma.EmailUpdateInput): Promise<Email> {
    return this.prisma.email.update({ where: { id }, data });
  }

  updateStatus(id: string, status: string): Promise<Email> {
    return this.prisma.email.update({ where: { id }, data: { status } });
  }

  delete(id: string): Promise<Email> {
    return this.prisma.email.delete({ where: { id } });
  }
}
