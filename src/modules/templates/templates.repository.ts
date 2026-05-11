import { Injectable } from '@nestjs/common';
import { PrismaService } from '@infra/database/prisma.service';
import type { EmailTemplate, Prisma } from '@prisma/client';

@Injectable()
export class TemplatesRepository {
  constructor(private readonly prisma: PrismaService) {}

  listForUser(userId: string): Promise<EmailTemplate[]> {
    return this.prisma.emailTemplate.findMany({
      where: { userId },
      orderBy: [{ platform: 'asc' }, { name: 'asc' }],
    });
  }

  async findByIdForUser(id: string, userId: string): Promise<EmailTemplate | null> {
    const template = await this.prisma.emailTemplate.findUnique({ where: { id } });
    return template && template.userId === userId ? template : null;
  }

  findByPlatform(userId: string, platform: string): Promise<EmailTemplate[]> {
    return this.prisma.emailTemplate.findMany({
      where: { userId, platform },
      orderBy: { name: 'asc' },
    });
  }

  create(data: Prisma.EmailTemplateCreateInput): Promise<EmailTemplate> {
    return this.prisma.emailTemplate.create({ data });
  }

  /// Caller MUST verify ownership via findByIdForUser before update/delete.
  update(id: string, data: Prisma.EmailTemplateUpdateInput): Promise<EmailTemplate> {
    return this.prisma.emailTemplate.update({ where: { id }, data });
  }

  delete(id: string): Promise<EmailTemplate> {
    return this.prisma.emailTemplate.delete({ where: { id } });
  }
}
