export type EventType = 'battle' | 'discovery' | 'npc' | 'quest' | 'lore' | 'travel' | 'rest';

/** User-defined or built-in event type (id is the key used on events) */
export interface CustomEventType {
  id: string;
  label: string;
  color: string;
  icon: string;
}

export type RelationType = 'caused' | 'leads_to' | 'concurrent' | 'related' | 'contradicts';

export interface FantasyDate {
  year: number;
  month: number; // 1-indexed
  day: number;   // 1-indexed
}

export interface CalendarMonth {
  id: string;
  name: string;
  days: number;
}

export interface CalendarConfig {
  name: string;
  yearSuffix: string;
  epoch: number;
  months: CalendarMonth[];
  weekLength: number;
  weekName: string;
}

export interface CampaignTimeline {
  id: string;
  name: string;
  color: string;
  description: string;
  order: number;
}

export interface EventRelation {
  targetId: string;
  type: RelationType;
  label: string;
}

export interface CampaignEvent {
  id: string;
  title: string;
  description: string;
  date: FantasyDate;
  endDate: FantasyDate | null;
  timelineId: string;
  /** Event type id (built-in or custom from campaign.eventTypes) */
  type: string;
  relations: EventRelation[];
  tags: string[];
  color: string | null;
  icon: string;
  secret: boolean;
  linkedChapter: string;
  linkedCharacters: string[];
}

export interface CampaignMeta {
  campaignId: string;
  campaignName: string;
  version: number;
}

export interface CampaignData {
  meta: CampaignMeta;
  calendar: CalendarConfig;
  timelines: CampaignTimeline[];
  eventTypes?: CustomEventType[];
  suggestedTags?: string[];
  events: CampaignEvent[];
}

export interface FilterState {
  search: string;
  types: string[];
  tags: string[];
  characters: string[];
  timelineIds: string[];
  showSecrets: boolean;
}

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  battle: 'Battle',
  discovery: 'Discovery',
  npc: 'NPC Encounter',
  quest: 'Quest',
  lore: 'Lore',
  travel: 'Travel',
  rest: 'Rest',
};

export const RELATION_TYPE_LABELS: Record<RelationType, string> = {
  caused: 'Caused',
  leads_to: 'Leads To',
  concurrent: 'Concurrent',
  related: 'Related',
  contradicts: 'Contradicts',
};

export const EVENT_TYPE_COLORS: Record<EventType, string> = {
  battle: '#cc2222',
  discovery: '#4a9a4a',
  npc: '#9a5a2a',
  quest: '#8a4a9a',
  lore: '#4a6a9a',
  travel: '#7a6a3a',
  rest: '#3a5a3a',
};

export const EVENT_TYPE_ICONS: Record<EventType, string> = {
  battle: 'swords',
  discovery: 'search',
  npc: 'user',
  quest: 'scroll-text',
  lore: 'book-open',
  travel: 'map-pin',
  rest: 'moon',
};

/** Default event types used when campaign has no eventTypes (migration) */
export const DEFAULT_EVENT_TYPES: CustomEventType[] = [
  { id: 'battle', label: 'Battle', color: '#cc2222', icon: 'swords' },
  { id: 'discovery', label: 'Discovery', color: '#4a9a4a', icon: 'search' },
  { id: 'npc', label: 'NPC Encounter', color: '#9a5a2a', icon: 'user' },
  { id: 'quest', label: 'Quest', color: '#8a4a9a', icon: 'scroll-text' },
  { id: 'lore', label: 'Lore', color: '#4a6a9a', icon: 'book-open' },
  { id: 'travel', label: 'Travel', color: '#7a6a3a', icon: 'map-pin' },
  { id: 'rest', label: 'Rest', color: '#3a5a3a', icon: 'moon' },
];
