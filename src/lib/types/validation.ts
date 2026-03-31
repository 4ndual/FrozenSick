import { z } from 'zod';
import { compareDate, isValidDate } from '$lib/utils/calendar';
import { ALLOW_YEAR_ZERO, YEAR_MAX, YEAR_MIN } from '$lib/types/date-policy';
import type { CalendarConfig, CampaignData, CampaignEvent, FantasyDate } from '$lib/types/schema';

export const FantasyDateSchema = z.object({
  year: z.number().int().min(YEAR_MIN).max(YEAR_MAX),
  month: z.number().int().positive(),
  day: z.number().int().positive(),
}).superRefine((date, ctx) => {
  if (!ALLOW_YEAR_ZERO && date.year === 0) {
    ctx.addIssue({
      code: 'custom',
      message: 'Year 0 is not allowed.',
      path: ['year'],
    });
  }
});

export const EventRelationSchema = z.object({
  targetId: z.string(),
  type: z.enum(['caused', 'leads_to', 'concurrent', 'related', 'contradicts']),
  label: z.string(),
});

export const CampaignEventSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  description: z.string(),
  date: FantasyDateSchema,
  endDate: FantasyDateSchema.nullable(),
  timelineId: z.string(),
  type: z.string(),
  relations: z.array(EventRelationSchema),
  tags: z.array(z.string()),
  color: z.string().nullable(),
  icon: z.string(),
  secret: z.boolean(),
  linkedChapter: z.string(),
  linkedCharacters: z.array(z.string()),
  location: z.string().nullable().optional(),
});

export const CampaignTimelineSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  color: z.string(),
  description: z.string(),
  order: z.number(),
});

export const CalendarMonthSchema = z.object({
  id: z.string(),
  name: z.string(),
  days: z.number().int().positive(),
  station: z.string().optional(),
  color: z.string().optional(),
});

export const CalendarConfigSchema = z.object({
  name: z.string(),
  yearSuffix: z.string(),
  epoch: z.number(),
  months: z.array(CalendarMonthSchema),
  weekLength: z.number().int().positive(),
  weekName: z.string(),
});

export const CustomEventTypeSchema = z.object({
  id: z.string().min(1),
  label: z.string(),
  color: z.string(),
  icon: z.string(),
});

export const CampaignMetaSchema = z.object({
  campaignId: z.string(),
  campaignName: z.string(),
  version: z.number(),
});

export const CampaignDataSchema = z.object({
  meta: CampaignMetaSchema,
  calendar: CalendarConfigSchema,
  timelines: z.array(CampaignTimelineSchema),
  eventTypes: z.array(CustomEventTypeSchema).optional(),
  suggestedTags: z.array(z.string()).optional(),
  events: z.array(CampaignEventSchema),
});

/**
 * Validate campaign data before saving. Returns the validated data or throws
 * a human-readable error message.
 */
export function validateCampaignData(data: unknown): z.infer<typeof CampaignDataSchema> {
  const result = CampaignDataSchema.safeParse(data);
  if (!result.success) {
    const issues = result.error.issues
      .slice(0, 5)
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    throw new Error(`Invalid campaign data: ${issues}`);
  }
  return result.data;
}

export function validateFantasyDateWithCalendar(
  date: FantasyDate,
  calendar: CalendarConfig,
): string[] {
  const errors: string[] = [];

  if (date.year < YEAR_MIN || date.year > YEAR_MAX) {
    errors.push(`Year must be between ${YEAR_MIN} and ${YEAR_MAX}.`);
  }

  if (!ALLOW_YEAR_ZERO && date.year === 0) {
    errors.push('Year 0 is not allowed.');
  }

  if (!isValidDate(date, calendar)) {
    errors.push('Date is invalid for the current calendar.');
  }

  return errors;
}

export function validateCampaignEventWithCalendar(
  event: CampaignEvent,
  calendar: CalendarConfig,
): string[] {
  const errors = validateFantasyDateWithCalendar(event.date, calendar);

  if (event.endDate) {
    errors.push(...validateFantasyDateWithCalendar(event.endDate, calendar));
    if (compareDate(event.endDate, event.date) < 0) {
      errors.push('End date must be on or after start date.');
    }
  }

  return errors;
}

export function validateCampaignDataWithCalendar(data: CampaignData): string[] {
  const errors: string[] = [];

  for (const event of data.events) {
    const eventErrors = validateCampaignEventWithCalendar(event, data.calendar);
    if (eventErrors.length > 0) {
      errors.push(`${event.id}: ${eventErrors.join(' ')}`);
    }
  }

  return errors;
}
