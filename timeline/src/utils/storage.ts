import type { CampaignData, CalendarConfig } from '../types/schema.ts';

const STORAGE_KEY = 'frozen-sick-timeline-v1';

export const DEFAULT_CALENDAR: CalendarConfig = {
  name: 'Calendar of Harptos',
  yearSuffix: 'DR',
  epoch: 1489,
  months: [
    { id: 'hammer', name: 'Hammer', days: 30 },
    { id: 'alturiak', name: 'Alturiak', days: 30 },
    { id: 'ches', name: 'Ches', days: 30 },
    { id: 'tarsakh', name: 'Tarsakh', days: 30 },
    { id: 'mirtul', name: 'Mirtul', days: 30 },
    { id: 'kythorn', name: 'Kythorn', days: 30 },
    { id: 'flamerule', name: 'Flamerule', days: 30 },
    { id: 'eleasis', name: 'Eleasis', days: 30 },
    { id: 'eleint', name: 'Eleint', days: 30 },
    { id: 'marpenoth', name: 'Marpenoth', days: 30 },
    { id: 'uktar', name: 'Uktar', days: 30 },
    { id: 'nightal', name: 'Nightal', days: 30 },
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
    {
      id: 'ch1-tavern',
      title: 'The Tavern Job',
      description: 'The party meets at La Última Gota and takes their first contract together.',
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
        { targetId: 'ch5-escape', type: 'leads_to', label: 'led to' },
        { targetId: 'ch3-turtle', type: 'caused', label: 'caused by' },
      ],
      tags: ['chapter-4', 'combat', 'revolution'],
      color: null,
      icon: 'swords',
      secret: false,
      linkedChapter: 'Chapter 4 - The Battle of Brasboredon',
      linkedCharacters: ['Tidus', 'Nixira', 'Zacarías'],
    },
    {
      id: 'ch5-escape',
      title: 'Escape from Brasboredon',
      description: 'The party flees the burning city under pursuit.',
      date: { year: 1489, month: 3, day: 4 },
      endDate: null,
      timelineId: 'main-story',
      type: 'travel',
      relations: [
        { targetId: 'ch4-battle', type: 'caused', label: 'caused by' },
      ],
      tags: ['chapter-5', 'escape'],
      color: null,
      icon: 'map-pin',
      secret: false,
      linkedChapter: 'Chapter 5 - The Escape from Brasboredon',
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
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_CAMPAIGN);
    return JSON.parse(raw) as CampaignData;
  } catch {
    return structuredClone(DEFAULT_CAMPAIGN);
  }
}

export function saveCampaign(data: CampaignData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function exportCampaign(data: CampaignData): void {
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
