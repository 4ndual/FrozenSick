import { z } from 'zod';

export const FantasyDateSchema = z.object({
  year: z.number(),
  month: z.number(),
  day: z.number(),
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
