import { Injectable } from '@nestjs/common';
import { PrismaService } from '@infra/database/prisma.service';
import type { EmailMessage, Prisma } from '@prisma/client';

@Injectable()
export class InboxRepository {
  constructor(private readonly prisma: PrismaService) {}

  listForEmail(emailId: string, userId: string): Promise<EmailMessage[]> {
    return this.prisma.emailMessage.findMany({
      where: { emailId, userId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async existsByProviderMessageId(
    providerMessageId: string,
    direction: 'inbound' | 'outbound',
  ): Promise<boolean> {
    const found = await this.prisma.emailMessage.findFirst({
      where: { providerMessageId, direction },
      select: { id: true },
    });
    return Boolean(found);
  }

  create(data: Prisma.EmailMessageCreateInput): Promise<EmailMessage> {
    return this.prisma.emailMessage.create({ data });
  }
}
