import type { CampaignData, CalendarConfig } from '$lib/types/schema.ts';
import type { CampaignEvent } from '$lib/types/schema.ts';
import { DEFAULT_EVENT_TYPES } from '$lib/types/schema.ts';
import { browser } from '$app/environment';

const STORAGE_KEY = 'frozen-sick-timeline-v1';
const UI_STORAGE_KEY = 'frozen-sick-timeline-ui-v1';
const GH_SYNC_KEY = 'frozen-sick-gh-sync';

export type ActiveTab = 'timeline' | 'graph' | 'settings';

export interface TimelineUIState {
  activeTab: ActiveTab;
}

const DEFAULT_UI_STATE: TimelineUIState = { activeTab: 'timeline' };

export function loadUIState(): TimelineUIState {
  if (!browser) return { ...DEFAULT_UI_STATE };
  try {
    const raw = localStorage.getItem(UI_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_UI_STATE };
    const parsed = JSON.parse(raw) as Partial<TimelineUIState>;
    const tab = parsed.activeTab;
    if (tab === 'timeline' || tab === 'graph' || tab === 'settings') {
      return { activeTab: tab };
    }
    return { ...DEFAULT_UI_STATE };
  } catch {
    return { ...DEFAULT_UI_STATE };
  }
}

export function saveUIState(ui: TimelineUIState): void {
  if (!browser) return;
  localStorage.setItem(UI_STORAGE_KEY, JSON.stringify(ui));
}

const GRAPH_LAYOUT_KEY = 'frozen-sick-timeline-graph-layout-v1';

export type GraphLayoutPositions = Record<string, { x: number; y: number }>;

export function loadGraphLayout(): GraphLayoutPositions {
  if (!browser) return {};
  try {
    const raw = localStorage.getItem(GRAPH_LAYOUT_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: GraphLayoutPositions = {};
    for (const [id, val] of Object.entries(parsed)) {
      if (val && typeof val === 'object' && 'x' in val && 'y' in val && typeof (val as { x: unknown }).x === 'number' && typeof (val as { y: unknown }).y === 'number') {
        out[id] = { x: (val as { x: number }).x, y: (val as { y: number }).y };
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function saveGraphLayout(positions: GraphLayoutPositions): void {
  if (!browser) return;
  localStorage.setItem(GRAPH_LAYOUT_KEY, JSON.stringify(positions));
}

/** Test event 100 years before campaign start — added so zoom-out can show long ranges. */
const TEST_EVENT_100Y: CampaignEvent = {
  id: 'test-100y-before',
  title: 'Ancient Founding (test)',
  description: 'Test event 100 years before campaign start — use zoom out to see it.',
  date: { year: 1389, month: 1, day: 1 },
  endDate: null,
  timelineId: 'main-story',
  type: 'lore',
  relations: [],
  tags: ['test', 'lore'],
  color: null,
  icon: 'book-open',
  secret: false,
  linkedChapter: '',
  linkedCharacters: [],
};

/** Harptos month stations and suggested colors (from Calendar of Harptos) for theming. */
export const HARPTOS_STATIONS: { station: string; color: string }[] = [
  { station: 'Deepwinter', color: '#6b8cae' },
  { station: 'The Claw of Winter', color: '#7a9bb8' },
  { station: 'The Claw of the Sunsets', color: '#7d9e7d' },
  { station: 'The Claw of the Storms', color: '#5a9a5a' },
  { station: 'The Melting', color: '#6bab6b' },
  { station: 'The Time of Flowers', color: '#8fbc8f' },
  { station: 'Summertide', color: '#c9a227' },
  { station: 'Highsun', color: '#d4a84b' },
  { station: 'The Fading', color: '#b8860b' },
  { station: 'Leaffall', color: '#a0522d' },
  { station: 'The Rotting', color: '#6b5b4f' },
  { station: 'The Drawing Down', color: '#4a5568' },
];

export const DEFAULT_CALENDAR: CalendarConfig = {
  name: 'Calendar of Harptos',
  yearSuffix: 'DR',
  epoch: 1489,
  months: [
    { id: 'hammer', name: 'Hammer', days: 30, station: 'Deepwinter', color: '#6b8cae' },
    { id: 'alturiak', name: 'Alturiak', days: 30, station: 'The Claw of Winter', color: '#7a9bb8' },
    { id: 'ches', name: 'Ches', days: 30, station: 'The Claw of the Sunsets', color: '#7d9e7d' },
    { id: 'tarsakh', name: 'Tarsakh', days: 30, station: 'The Claw of the Storms', color: '#5a9a5a' },
    { id: 'mirtul', name: 'Mirtul', days: 30, station: 'The Melting', color: '#6bab6b' },
    { id: 'kythorn', name: 'Kythorn', days: 30, station: 'The Time of Flowers', color: '#8fbc8f' },
    { id: 'flamerule', name: 'Flamerule', days: 30, station: 'Summertide', color: '#c9a227' },
    { id: 'eleasis', name: 'Eleasis', days: 30, station: 'Highsun', color: '#d4a84b' },
    { id: 'eleint', name: 'Eleint', days: 30, station: 'The Fading', color: '#b8860b' },
    { id: 'marpenoth', name: 'Marpenoth', days: 30, station: 'Leaffall', color: '#a0522d' },
    { id: 'uktar', name: 'Uktar', days: 30, station: 'The Rotting', color: '#6b5b4f' },
    { id: 'nightal', name: 'Nightal', days: 30, station: 'The Drawing Down', color: '#4a5568' },
  ],
  weekLength: 10,
  weekName: 'Tenday',
};

export const DEFAULT_CAMPAIGN: CampaignData = {
  meta: {
    campaignId: 'frozen-sick',
    campaignName: 'Frozen Sick',
    version: 1,
  },
  calendar: DEFAULT_CALENDAR,
  eventTypes: [...DEFAULT_EVENT_TYPES],
  suggestedTags: [],
  timelines: [
    {
      id: 'main-story',
      name: 'Main Story',
      color: '#d4af37',
      description: 'The primary campaign arc',
      order: 0,
    },
    {
      id: 'tidus',
      name: "Tidus's Arc",
      color: '#4a9a9a',
      description: 'Personal story of the Rogue / Waiter',
      order: 1,
    },
    {
      id: 'nixira',
      name: "Nixira's Arc",
      color: '#cc6644',
      description: 'Personal story of the Bard / Cook',
      order: 2,
    },
    {
      id: 'zacarias',
      name: "Zacarías's Arc",
      color: '#8a5a9a',
      description: 'Personal story of the Warlock / Guard',
      order: 3,
    },
  ],
  events: [
    TEST_EVENT_100Y,
    {
      id: 'ch1-tavern',
      title: 'The Tavern Job',
      description: 'The party meets at La ultima Gota and takes their first contract together.',
      date: { year: 1489, month: 1, day: 1 },
      endDate: null,
      timelineId: 'main-story',
      type: 'quest',
      relations: [
        { targetId: 'ch2-plateau', type: 'leads_to', label: 'leads to' },
      ],
      tags: ['chapter-1', 'party-origin'],
      color: null,
      icon: 'scroll-text',
      secret: false,
      linkedChapter: 'Chapter 1 - The Tavern',
      linkedCharacters: ['Tidus', 'Nixira', 'Zacarías'],
    },
    {
      id: 'ch2-plateau',
      title: 'The Plateau',
      description: 'The party ventures into the plateau region on their contract.',
      date: { year: 1489, month: 1, day: 15 },
      endDate: { year: 1489, month: 2, day: 5 },
      timelineId: 'main-story',
      type: 'travel',
      relations: [
        { targetId: 'ch1-tavern', type: 'caused', label: 'following' },
        { targetId: 'ch3-turtle', type: 'leads_to', label: 'leads to' },
      ],
      tags: ['chapter-2', 'exploration'],
      color: null,
      icon: 'map-pin',
      secret: false,
      linkedChapter: 'Chapter 2 - The Plateau',
      linkedCharacters: ['Tidus', 'Nixira', 'Zacarías'],
    },
    {
      id: 'ch3-turtle',
      title: 'The Flying Turtle',
      description: 'The party boards the legendary flying turtle ship.',
      date: { year: 1489, month: 2, day: 10 },
      endDate: null,
      timelineId: 'main-story',
      type: 'discovery',
      relations: [
        { targetId: 'ch4-battle', type: 'leads_to', label: 'leads to' },
      ],
      tags: ['chapter-3', 'ship'],
      color: null,
      icon: 'search',
      secret: false,
      linkedChapter: 'Chapter 3 - The Flying Turtle',
      linkedCharacters: ['Tidus', 'Nixira', 'Zacarías'],
    },
    {
      id: 'ch4-battle',
      title: 'Battle of Brasboredon',
      description: 'Full-scale battle in the streets. The revolution ignites.',
      date: { year: 1489, month: 3, day: 1 },
      endDate: { year: 1489, month: 3, day: 3 },
      timelineId: 'main-story',
      type: 'battle',
      relations: [
        { targetId: 'ch6-escape', type: 'leads_to', label: 'led to' },
        { targetId: 'ch3-turtle', type: 'caused', label: 'caused by' },
      ],
      tags: ['chapter-5', 'combat', 'revolution'],
      color: null,
      icon: 'swords',
      secret: false,
      linkedChapter: 'Chapter 5 - The Battle of Brasboredon',
      linkedCharacters: ['Tidus', 'Nixira', 'Zacarías'],
    },
    {
      id: 'ch6-escape',
      title: 'Escape from Brasboredon',
      description: 'The party flees the burning city under pursuit.',
      date: { year: 1489, month: 3, day: 4 },
      endDate: null,
      timelineId: 'main-story',
      type: 'travel',
      relations: [
        { targetId: 'ch4-battle', type: 'caused', label: 'caused by' },
      ],
      tags: ['chapter-6', 'escape'],
      color: null,
      icon: 'map-pin',
      secret: false,
      linkedChapter: 'Chapter 6 - The Escape from Brasboredon',
      linkedCharacters: ['Tidus', 'Nixira', 'Zacarías'],
    },
    {
      id: 'tidus-medallion',
      title: 'Val Medallion Discovered',
      description: 'Tidus discovers the Val medallion and its strange powers.',
      date: { year: 1489, month: 1, day: 20 },
      endDate: null,
      timelineId: 'tidus',
      type: 'discovery',
      relations: [
        { targetId: 'ch4-battle', type: 'related', label: 'ties into' },
      ],
      tags: ['tidus', 'medallion', 'artifact'],
      color: null,
      icon: 'search',
      secret: false,
      linkedChapter: 'Chapter 2 - The Plateau',
      linkedCharacters: ['Tidus'],
    },
  ],
};

export function loadCampaign(): CampaignData {
  if (!browser) return structuredClone(DEFAULT_CAMPAIGN);
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_CAMPAIGN);
    const data = JSON.parse(raw) as CampaignData;
    if (!Array.isArray(data.eventTypes) || data.eventTypes.length === 0) {
      data.eventTypes = [...DEFAULT_EVENT_TYPES];
    }
    if (!Array.isArray(data.suggestedTags)) {
      data.suggestedTags = [];
    }
    if (!data.events.some((e) => e.id === 'test-100y-before')) {
      data.events = [structuredClone(TEST_EVENT_100Y), ...data.events];
    }
    return data;
  } catch {
    return structuredClone(DEFAULT_CAMPAIGN);
  }
}

export function saveCampaign(data: CampaignData): void {
  if (!browser) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function exportCampaign(data: CampaignData): void {
  if (!browser) return;
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${data.meta.campaignId}-timeline.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importCampaign(): Promise<CampaignData> {
  return new Promise((resolve, reject) => {
    if (!browser) return reject(new Error('Not in browser'));
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return reject(new Error('No file selected'));
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(reader.result as string) as CampaignData;
          resolve(parsed);
        } catch {
          reject(new Error('Invalid JSON file'));
        }
      };
      reader.readAsText(file);
    };
    input.click();
  });
}

export function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

// ── GitHub Sync State ────────────────────────────────────────────────────────

export interface GitHubSyncState {
  headSha: string;
  treeSha: string;
  fileShas: Record<string, string>;
  lastSyncedFiles: Record<string, string>;
}

export function saveGitHubSyncState(state: GitHubSyncState): void {
  if (!browser) return;
  localStorage.setItem(GH_SYNC_KEY, JSON.stringify(state));
}

export function loadGitHubSyncState(): GitHubSyncState | null {
  if (!browser) return null;
  try {
    const raw = localStorage.getItem(GH_SYNC_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as GitHubSyncState;
  } catch {
    return null;
  }
}

export function clearGitHubSyncState(): void {
  if (!browser) return;
  localStorage.removeItem(GH_SYNC_KEY);
}

// ── Static File Loader ───────────────────────────────────────────────────────

export async function loadFromStaticBundle(): Promise<CampaignData | null> {
  if (typeof import.meta !== 'undefined' && import.meta.env && !import.meta.env.PROD) {
    return null;
  }
  try {
    const res = await fetch('/.data/bundle.json');
    if (!res.ok) return null;
    return (await res.json()) as CampaignData;
  } catch {
    return null;
  }
}
