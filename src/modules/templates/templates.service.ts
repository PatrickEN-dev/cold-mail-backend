import { Injectable } from '@nestjs/common';
import { NotFoundError } from '@shared/errors/domain.error';
import { TemplatesRepository } from './templates.repository';
import type { CreateTemplateDto, UpdateTemplateDto } from './dto/template.dto';
import type { EmailTemplate } from '@prisma/client';

@Injectable()
export class TemplatesService {
  constructor(private readonly repository: TemplatesRepository) {}

  list(userId: string): Promise<EmailTemplate[]> {
    return this.repository.listForUser(userId);
  }

  async getById(id: string, userId: string): Promise<EmailTemplate> {
    const template = await this.repository.findByIdForUser(id, userId);
    if (!template) throw new NotFoundError('Template not found');
    return template;
  }

  create(userId: string, dto: CreateTemplateDto): Promise<EmailTemplate> {
    return this.repository.create({ userId, ...dto });
  }

  async update(id: string, userId: string, dto: UpdateTemplateDto): Promise<EmailTemplate> {
    await this.getById(id, userId);
    return this.repository.update(id, dto);
  }

  async delete(id: string, userId: string): Promise<void> {
    await this.getById(id, userId);
    await this.repository.delete(id);
  }

  /// Picks a random template among the union of platform-specific templates
  /// AND `platform='any'` templates. Lets admins seed cross-platform templates
  /// once while still allowing per-platform overrides to coexist in the pool.
  async pickRandomVariant(userId: string, platform: string): Promise<EmailTemplate | null> {
    const variants =
      (await this.repository.findByPlatform(userId, platform)).concat(
        platform === 'any' ? [] : await this.repository.findByPlatform(userId, 'any'),
      );
    if (variants.length === 0) return null;
    return variants[Math.floor(Math.random() * variants.length)];
  }
}
