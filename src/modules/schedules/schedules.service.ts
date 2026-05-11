import { Injectable } from '@nestjs/common';
import { NotFoundError } from '@shared/errors/domain.error';
import { SchedulesRepository } from './schedules.repository';
import { ScheduleClock } from './application/schedule-clock';
import type { CreateScheduleDto, UpdateScheduleDto } from './dto/schedule.dto';
import type { Prisma, Schedule } from '@prisma/client';

@Injectable()
export class SchedulesService {
  constructor(
    private readonly repository: SchedulesRepository,
    private readonly clock: ScheduleClock,
  ) {}

  list(userId: string): Promise<Schedule[]> {
    return this.repository.listForUser(userId);
  }

  async getById(id: string, userId: string): Promise<Schedule> {
    const schedule = await this.repository.findByIdForUser(id, userId);
    if (!schedule) throw new NotFoundError('Schedule not found');
    return schedule;
  }

  create(userId: string, dto: CreateScheduleDto): Promise<Schedule> {
    const nextRunAt = this.clock.nextRunAtFromInput({
      scheduleType: dto.type,
      scheduledDate: dto.scheduledDate,
      scheduledTime: dto.scheduledTime,
      recurringDays: dto.recurringDays,
      tz: dto.tz,
    });
    return this.repository.create({
      userId,
      name: dto.name,
      type: dto.type,
      status: dto.status,
      scheduledDate: dto.scheduledDate ? new Date(`${dto.scheduledDate}T00:00:00Z`) : null,
      scheduledTime: new Date(`1970-01-01T${dto.scheduledTime}:00Z`),
      recurringDays: dto.recurringDays,
      leadSelections: dto.leadSelections as Prisma.InputJsonValue,
      totalLeads: dto.totalLeads,
      ...(dto.senderEmailId
        ? { sender: { connect: { id: dto.senderEmailId } } }
        : {}),
      nextRunAt,
    });
  }

  async update(id: string, userId: string, dto: UpdateScheduleDto): Promise<Schedule> {
    const current = await this.getById(id, userId);

    const hasTimingChange =
      dto.scheduledDate !== undefined ||
      dto.scheduledTime !== undefined ||
      dto.recurringDays !== undefined ||
      dto.tz !== undefined;

    const nextRunAt = hasTimingChange
      ? this.clock.nextRunAtFromInput({
          scheduleType: current.type as 'one_time' | 'recurring',
          scheduledDate: dto.scheduledDate ?? this.dateToYMD(current.scheduledDate),
          scheduledTime: dto.scheduledTime ?? this.timeToHHMM(current.scheduledTime),
          recurringDays: dto.recurringDays ?? current.recurringDays,
          tz: dto.tz ?? 'America/Sao_Paulo',
        })
      : current.nextRunAt;

    return this.repository.update(id, {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.status !== undefined ? { status: dto.status } : {}),
      ...(dto.scheduledDate !== undefined
        ? { scheduledDate: new Date(`${dto.scheduledDate}T00:00:00Z`) }
        : {}),
      ...(dto.scheduledTime !== undefined
        ? { scheduledTime: new Date(`1970-01-01T${dto.scheduledTime}:00Z`) }
        : {}),
      ...(dto.recurringDays !== undefined ? { recurringDays: dto.recurringDays } : {}),
      ...(dto.leadSelections !== undefined
        ? { leadSelections: dto.leadSelections as Prisma.InputJsonValue }
        : {}),
      ...(dto.totalLeads !== undefined ? { totalLeads: dto.totalLeads } : {}),
      ...(dto.senderEmailId !== undefined
        ? { sender: { connect: { id: dto.senderEmailId } } }
        : {}),
      nextRunAt,
    });
  }

  async delete(id: string, userId: string): Promise<void> {
    await this.getById(id, userId);
    await this.repository.delete(id);
  }

  private dateToYMD(d: Date | null): string | undefined {
    return d ? d.toISOString().slice(0, 10) : undefined;
  }

  private timeToHHMM(d: Date | null): string | undefined {
    return d ? d.toISOString().slice(11, 16) : undefined;
  }
}
