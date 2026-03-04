import type {
  CampaignData,
  CampaignEvent,
  CampaignTimeline,
  CalendarConfig,
  FilterState,
} from '../types/schema.ts';
import { loadCampaign, saveCampaign, exportCampaign, importCampaign } from '../utils/storage.ts';

export type ActiveTab = 'timeline' | 'graph' | 'settings';

function createCampaignStore() {
  let data = $state<CampaignData>(loadCampaign());

  let filter = $state<FilterState>({
    search: '',
    types: [],
    tags: [],
    characters: [],
    timelineIds: [],
    showSecrets: false,
  });

  let selectedEventId = $state<string | null>(null);
  let activeTab = $state<ActiveTab>('timeline');
  let editorOpen = $state(false);
  let editingEvent = $state<CampaignEvent | null>(null);
  let editorOpenCallback: ((ev: CampaignEvent | null) => void) | null = null;
  let sidebarOpen = $state(true);
  let detailEventId = $state<string | null>(null);

  let filteredEvents = $derived(
    data.events.filter((ev) => {
      if (!filter.showSecrets && ev.secret) return false;
      if (
        filter.search &&
        !ev.title.toLowerCase().includes(filter.search.toLowerCase()) &&
        !ev.description.toLowerCase().includes(filter.search.toLowerCase())
      )
        return false;
      if (filter.types.length > 0 && !filter.types.includes(ev.type)) return false;
      if (filter.tags.length > 0 && !filter.tags.some((t) => ev.tags.includes(t))) return false;
      if (
        filter.characters.length > 0 &&
        !filter.characters.some((c) => ev.linkedCharacters.includes(c))
      )
        return false;
      if (
        filter.timelineIds.length > 0 &&
        !filter.timelineIds.includes(ev.timelineId)
      )
        return false;
      return true;
    }),
  );

  let allTags = $derived(
    [...new Set(data.events.flatMap((ev) => ev.tags))].sort(),
  );

  let allCharacters = $derived(
    [...new Set(data.events.flatMap((ev) => ev.linkedCharacters))].sort(),
  );

  let detailEvent = $derived(
    detailEventId ? data.events.find((e) => e.id === detailEventId) ?? null : null,
  );

  function persist() {
    saveCampaign(data);
  }

  return {
    get data() { return data; },
    get filter() { return filter; },
    get filteredEvents() { return filteredEvents; },
    get allTags() { return allTags; },
    get allCharacters() { return allCharacters; },
    get selectedEventId() { return selectedEventId; },
    get activeTab() { return activeTab; },
    get editorOpen() { return editorOpen; },
    get editingEvent() { return editingEvent; },
    get sidebarOpen() { return sidebarOpen; },
    get detailEventId() { return detailEventId; },
    get detailEvent() { return detailEvent; },

    setActiveTab(tab: ActiveTab) {
      activeTab = tab;
    },

    setSelectedEvent(id: string | null) {
      selectedEventId = id;
    },

    openDetail(id: string) {
      detailEventId = id;
    },

    closeDetail() {
      detailEventId = null;
    },

    toggleSidebar() {
      sidebarOpen = !sidebarOpen;
    },

    onEditorOpen(cb: (ev: CampaignEvent | null) => void) {
      editorOpenCallback = cb;
      return () => { editorOpenCallback = null; };
    },

    openEditor(event?: CampaignEvent) {
      editingEvent = event ?? null;
      editorOpen = true;
      editorOpenCallback?.(editingEvent);
    },

    closeEditor() {
      editorOpen = false;
      editingEvent = null;
    },

    // ── Events ──────────────────────────────────────────────────────────────

    addEvent(event: CampaignEvent) {
      data.events.push(event);
      persist();
    },

    updateEvent(updated: CampaignEvent) {
      const idx = data.events.findIndex((e) => e.id === updated.id);
      if (idx >= 0) data.events[idx] = updated;
      persist();
    },

    deleteEvent(id: string) {
      data.events = data.events.filter((e) => e.id !== id);
      data.events.forEach((ev) => {
        ev.relations = ev.relations.filter((r) => r.targetId !== id);
      });
      if (selectedEventId === id) selectedEventId = null;
      if (detailEventId === id) detailEventId = null;
      persist();
    },

    // ── Timelines ───────────────────────────────────────────────────────────

    addTimeline(timeline: CampaignTimeline) {
      data.timelines.push(timeline);
      persist();
    },

    updateTimeline(updated: CampaignTimeline) {
      const idx = data.timelines.findIndex((t) => t.id === updated.id);
      if (idx >= 0) data.timelines[idx] = updated;
      persist();
    },

    deleteTimeline(id: string) {
      data.timelines = data.timelines.filter((t) => t.id !== id);
      persist();
    },

    // ── Calendar ────────────────────────────────────────────────────────────

    updateCalendar(cal: CalendarConfig) {
      data.calendar = cal;
      persist();
    },

    // ── Meta ────────────────────────────────────────────────────────────────

    updateMeta(name: string) {
      data.meta.campaignName = name;
      persist();
    },

    // ── Filter ──────────────────────────────────────────────────────────────

    setFilter(updates: Partial<FilterState>) {
      Object.assign(filter, updates);
    },

    toggleFilterType(type: FilterState['types'][number]) {
      const idx = filter.types.indexOf(type);
      if (idx >= 0) filter.types.splice(idx, 1);
      else filter.types.push(type);
    },

    toggleFilterTag(tag: string) {
      const idx = filter.tags.indexOf(tag);
      if (idx >= 0) filter.tags.splice(idx, 1);
      else filter.tags.push(tag);
    },

    toggleFilterCharacter(char: string) {
      const idx = filter.characters.indexOf(char);
      if (idx >= 0) filter.characters.splice(idx, 1);
      else filter.characters.push(char);
    },

    toggleFilterTimeline(id: string) {
      const idx = filter.timelineIds.indexOf(id);
      if (idx >= 0) filter.timelineIds.splice(idx, 1);
      else filter.timelineIds.push(id);
    },

    resetFilter() {
      filter.search = '';
      filter.types = [];
      filter.tags = [];
      filter.characters = [];
      filter.timelineIds = [];
      filter.showSecrets = false;
    },

    // ── Import / Export ─────────────────────────────────────────────────────

    exportData() {
      exportCampaign(data);
    },

    async importData() {
      const imported = await importCampaign();
      data = imported;
      persist();
    },
  };
}

export const campaign = createCampaignStore();
