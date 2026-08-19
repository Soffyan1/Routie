import { z } from "zod";
import { DEFAULT_PLAN_LIMITS, socialChannelSchema, type SocialChannel } from "./types";

export const calendarRequestSchema = z.object({
  year: z.number().int().min(2024).max(2100),
  month: z.number().int().min(1).max(12),
  conceptsPerDay: z.number().int().min(1).max(DEFAULT_PLAN_LIMITS.maxConceptsPerDay),
  timezone: z.string().min(1),
  times: z.array(z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)).min(1).max(3),
  channels: z.array(socialChannelSchema).min(1),
  useWebSearch: z.boolean().default(false)
});

export type CalendarRequest = z.input<typeof calendarRequestSchema>;

export interface CalendarSlot {
  index: number;
  localDate: string;
  localTime: string;
  timezone: string;
  channels: SocialChannel[];
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function conceptCount(year: number, month: number, conceptsPerDay: number): number {
  if (!Number.isInteger(conceptsPerDay) || conceptsPerDay < 1 || conceptsPerDay > 3) {
    throw new RangeError("conceptsPerDay must be an integer between 1 and 3");
  }
  return daysInMonth(year, month) * conceptsPerDay;
}

export function buildMonthlySlots(input: CalendarRequest): CalendarSlot[] {
  const value = calendarRequestSchema.parse(input);
  if (value.times.length < value.conceptsPerDay) {
    throw new RangeError("Provide at least one posting time for each daily concept");
  }

  const count = daysInMonth(value.year, value.month);
  const slots: CalendarSlot[] = [];
  let index = 0;
  for (let day = 1; day <= count; day += 1) {
    for (let sequence = 0; sequence < value.conceptsPerDay; sequence += 1) {
      const localDate = `${value.year}-${String(value.month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      slots.push({
        index,
        localDate,
        localTime: value.times[sequence]!,
        timezone: value.timezone,
        channels: [...value.channels]
      });
      index += 1;
    }
  }
  return slots;
}
