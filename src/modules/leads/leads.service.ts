import { Injectable } from '@nestjs/common';
import { NotFoundError } from '@shared/errors/domain.error';
import { LeadsRepository } from './leads.repository';
import type { CreateLeadDto, ListLeadsQuery, UpdateLeadDto } from './dto/lead.dto';
import type { Email } from '@prisma/client';

@Injectable()
export class LeadsService {
  constructor(private readonly repository: LeadsRepository) {}

  list(userId: string, query: ListLeadsQuery): Promise<Email[]> {
    return this.repository.listForUser({
      userId,
      status: query.status,
      campaignName: query.campaignName,
      limit: query.limit,
      offset: query.offset,
    });
  }

  async getById(id: string, userId: string): Promise<Email> {
    const lead = await this.repository.findByIdForUser(id, userId);
    if (!lead) throw new NotFoundError('Lead not found');
    return lead;
  }

  create(userId: string, dto: CreateLeadDto): Promise<Email> {
    return this.repository.create({ userId, ...dto });
  }

  async update(id: string, userId: string, dto: UpdateLeadDto): Promise<Email> {
    await this.getById(id, userId);
    return this.repository.update(id, dto);
  }

  async delete(id: string, userId: string): Promise<void> {
    await this.getById(id, userId);
    await this.repository.delete(id);
  }
}
