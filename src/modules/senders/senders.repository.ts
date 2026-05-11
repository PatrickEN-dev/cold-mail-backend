import { Injectable } from '@nestjs/common';
import { PrismaService } from '@infra/database/prisma.service';
import type { Prisma, SenderEmail } from '@prisma/client';

@Injectable()
export class SendersRepository {
  constructor(private readonly prisma: PrismaService) {}

  findManyByUser(userId: string): Promise<SenderEmail[]> {
    return this.prisma.senderEmail.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByIdForUser(id: string, userId: string): Promise<SenderEmail | null> {
    const sender = await this.prisma.senderEmail.findUnique({ where: { id } });
    return sender && sender.userId === userId ? sender : null;
  }

  /// Looks up a sender by its address scoped to a tenant (unique constraint
  /// in prod is `(user_id, email_address)`).
  findByAddressForUser(emailAddress: string, userId: string): Promise<SenderEmail | null> {
    return this.prisma.senderEmail.findUnique({
      where: { userId_emailAddress: { userId, emailAddress } },
    });
  }

  create(data: Prisma.SenderEmailCreateInput): Promise<SenderEmail> {
    return this.prisma.senderEmail.create({ data });
  }

  /// Caller MUST verify ownership via findByIdForUser before update/delete.
  update(id: string, data: Prisma.SenderEmailUpdateInput): Promise<SenderEmail> {
    return this.prisma.senderEmail.update({ where: { id }, data });
  }

  delete(id: string): Promise<SenderEmail> {
    return this.prisma.senderEmail.delete({ where: { id } });
  }

  /// Wave 1: replaces N8N workflow `[Tigger] - zera limite`.
  /// Equivalent of: UPDATE sender_emails SET today_usage = 0 WHERE today_usage != 0;
  /// Does NOT migrate the second UPDATE (max_interactions=0) — that's bug B11.
  async resetAllDailyUsage(): Promise<{ count: number }> {
    const result = await this.prisma.senderEmail.updateMany({
      where: { todayUsage: { gt: 0 } },
      data: { todayUsage: 0 },
    });
    return { count: result.count };
  }
}
