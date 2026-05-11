import { Injectable } from '@nestjs/common';
import { NotFoundError } from '@shared/errors/domain.error';
import { SendersRepository } from './senders.repository';
import type { CreateSenderDto, UpdateSenderDto } from './dto/sender.dto';
import type { SenderEmail } from '@prisma/client';

@Injectable()
export class SendersService {
  constructor(private readonly repository: SendersRepository) {}

  listForUser(userId: string): Promise<SenderEmail[]> {
    return this.repository.findManyByUser(userId);
  }

  async getByIdForUser(id: string, userId: string): Promise<SenderEmail> {
    const sender = await this.repository.findByIdForUser(id, userId);
    if (!sender) throw new NotFoundError('Sender email not found');
    return sender;
  }

  create(userId: string, dto: CreateSenderDto): Promise<SenderEmail> {
    return this.repository.create({ userId, ...dto });
  }

  async update(id: string, userId: string, dto: UpdateSenderDto): Promise<SenderEmail> {
    await this.getByIdForUser(id, userId);
    return this.repository.update(id, dto);
  }

  async delete(id: string, userId: string): Promise<void> {
    await this.getByIdForUser(id, userId);
    await this.repository.delete(id);
  }
}
