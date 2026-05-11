import { z } from 'zod';

export const scheduleTypes = ['one_time', 'recurring'] as const;
export const scheduleStatuses = ['active', 'paused', 'completed', 'draft'] as const;
export const weekdays = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

/// `tz` not in DB yet — wave 5 must add via migration. Until then it's an app
/// hint that we still honor when computing nextRunAt.
export const createScheduleSchema = z
  .object({
    name: z.string().min(1),
    type: z.enum(scheduleTypes),
    status: z.enum(scheduleStatuses).default('draft'),
    scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    scheduledTime: z.string().regex(/^\d{2}:\d{2}$/),
    recurringDays: z.array(z.enum(weekdays)).default([]),
    tz: z.string().default('America/Sao_Paulo'),
    leadSelections: z.array(z.unknown()).default([]),
    totalLeads: z.number().int().nonnegative().default(0),
    senderEmailId: z.string().uuid().optional(),
  })
  .refine((s) => s.type !== 'one_time' || !!s.scheduledDate, {
    message: 'scheduledDate required for one_time schedules',
    path: ['scheduledDate'],
  })
  .refine((s) => s.type !== 'recurring' || s.recurringDays.length > 0, {
    message: 'recurringDays required for recurring schedules',
    path: ['recurringDays'],
  });
export type CreateScheduleDto = z.infer<typeof createScheduleSchema>;

export const updateScheduleSchema = z.object({
  name: z.string().optional(),
  status: z.enum(scheduleStatuses).optional(),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  scheduledTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  recurringDays: z.array(z.enum(weekdays)).optional(),
  tz: z.string().optional(),
  leadSelections: z.array(z.unknown()).optional(),
  totalLeads: z.number().int().nonnegative().optional(),
  senderEmailId: z.string().uuid().optional(),
});
export type UpdateScheduleDto = z.infer<typeof updateScheduleSchema>;
