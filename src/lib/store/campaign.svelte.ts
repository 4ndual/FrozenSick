import type {
  CampaignData,
  CampaignEvent,
  CampaignTimeline,
  CalendarConfig,
  CustomEventType,
  FilterState,
} from '$lib/types/schema.ts';
import { DEFAULT_EVENT_TYPES } from '$lib/types/schema.ts';
import { validateCampaignData } from '$lib/types/validation.ts';
import {
  loadCampaign,
  saveCampaign,
  exportCampaign,
  importCampaign,
  loadUIState,
  saveUIState,
  saveGitHubSyncState,
  loadGitHubSyncState,
  clearGitHubSyncState,
  loadFromStaticBundle,
} from '$lib/utils/storage.ts';
import type { ActiveTab, GitHubSyncState } from '$lib/utils/storage.ts';
import {
  extractTokenFromHash,
  getToken,
  saveToken,
  clearToken,
  fetchGitHubUser,
  saveUser,
  getCachedUser,
  loginUrl,
} from '$lib/utils/auth.ts';
import type { GitHubUser } from '$lib/utils/auth.ts';
import {
  loadFromGitHub,
  shardCampaignData,
  diffFiles,
  buildCommitMessage,
  getRepoConfig,
  listBranches as fetchBranchList,
} from '$lib/utils/github.ts';

export type { ActiveTab };
export type SyncStatus = 'idle' | 'synced' | 'dirty' | 'saving' | 'loading' | 'error';

function createCampaignStore() {
  let data = $state<CampaignData>(loadCampaign());
  const initialUI = loadUIState();

  let filter = $state<FilterState>({
    search: '',
    types: [],
    tags: [],
    characters: [],
    timelineIds: [],
    showSecrets: false,
  });

  let selectedEventId = $state<string | null>(null);
  let activeTab = $state<ActiveTab>(initialUI.activeTab);
  let editorOpen = $state(false);
  let editingEvent = $state<CampaignEvent | null>(null);
  let editorOpenCallback: ((ev: CampaignEvent | null) => void) | null = null;
  let sidebarOpen = $state(true);
  let detailEventId = $state<string | null>(null);

  // ── Auth state ──────────────────────────────────────────────────────────
  let ghUser = $state<GitHubUser | null>(getCachedUser());
  let ghToken = $state<string | null>(getToken());
  let authLoading = $state(false);

  // ── Sync state ──────────────────────────────────────────────────────────
  let syncStatus = $state<SyncStatus>('idle');
  let syncError = $state<string | null>(null);
  let lastSyncedFiles = $state<Record<string, string> | null>(
    loadGitHubSyncState()?.lastSyncedFiles ?? null,
  );
  let headSha = $state<string | null>(loadGitHubSyncState()?.headSha ?? null);
  let treeSha = $state<string | null>(loadGitHubSyncState()?.treeSha ?? null);
  let fileShas = $state<Record<string, string>>(loadGitHubSyncState()?.fileShas ?? {});

  // ── Branch state ────────────────────────────────────────────────────────
  let currentBranch = $state(getRepoConfig().branch);
  let availableBranches = $state<string[]>([]);

  let isAuthenticated = $derived(!!ghToken && !!ghUser);

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

  let eventTypes = $derived(
    (data.eventTypes?.length ? data.eventTypes : DEFAULT_EVENT_TYPES) as CustomEventType[],
  );

  let suggestedTags = $derived((data.suggestedTags ?? []).slice().sort());

  let initializing = false;

  function persist() {
    saveCampaign(data);
    if (initializing) return;
    if (isAuthenticated && syncStatus !== 'saving' && syncStatus !== 'loading') {
      syncStatus = 'dirty';
    }
  }

  async function attemptSave(token: string, isRetry: boolean): Promise<void> {
    const cfg = { ...getRepoConfig(), branch: currentBranch };

    if (!headSha || !treeSha || isRetry) {
      const snapshot = await loadFromGitHub(cfg, token);
      headSha = snapshot.headSha;
      treeSha = snapshot.treeSha;
      fileShas = snapshot.fileShas;
      lastSyncedFiles = shardCampaignData(snapshot.data);
    }

    const currentFiles = shardCampaignData(data);
    const baseFiles = lastSyncedFiles ?? {};
    const changes = diffFiles(currentFiles, baseFiles);

    if (changes.length === 0) {
      syncStatus = 'synced';
      return;
    }

    const message = buildCommitMessage(changes);

    const res = await fetch('/api/timeline/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        changes,
        message,
        parentSha: headSha,
        baseTreeSha: treeSha,
        branch: currentBranch,
      }),
    });

    const result = await res.json();

    if (res.status === 409 && !isRetry) {
      headSha = null;
      treeSha = null;
      clearGitHubSyncState();
      return attemptSave(token, true);
    }

    if (!res.ok) {
      throw new Error(result.error || 'Save failed');
    }

    const mergedShas = { ...fileShas, ...result.newFileShas };
    for (const ch of changes) {
      if (ch.content === null) delete mergedShas[ch.path];
    }

    updateSyncCache(result.commitSha, result.treeSha, mergedShas, currentFiles);
  }

  function updateSyncCache(
    newHeadSha: string,
    newTreeSha: string,
    newFileShas: Record<string, string>,
    files: Record<string, string>,
  ) {
    headSha = newHeadSha;
    treeSha = newTreeSha;
    fileShas = newFileShas;
    lastSyncedFiles = files;
    saveGitHubSyncState({
      headSha: newHeadSha,
      treeSha: newTreeSha,
      fileShas: newFileShas,
      lastSyncedFiles: files,
    });
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
    get eventTypes() { return eventTypes; },
    get suggestedTags() { return suggestedTags; },

    // ── Auth getters ────────────────────────────────────────────────────────
    get ghUser() { return ghUser; },
    get ghToken() { return ghToken; },
    get isAuthenticated() { return isAuthenticated; },
    get authLoading() { return authLoading; },

    // ── Sync getters ────────────────────────────────────────────────────────
    get syncStatus() { return syncStatus; },
    get syncError() { return syncError; },

    // ── Branch getters ───────────────────────────────────────────────────────
    get currentBranch() { return currentBranch; },
    get availableBranches() { return availableBranches; },

    setActiveTab(tab: ActiveTab) {
      activeTab = tab;
      saveUIState({ activeTab });
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

    // ── Auth actions ────────────────────────────────────────────────────────

    login() {
      window.location.href = loginUrl();
    },

    logout() {
      clearToken();
      clearGitHubSyncState();
      ghUser = null;
      ghToken = null;
      syncStatus = 'idle';
      syncError = null;
      lastSyncedFiles = null;
      headSha = null;
      treeSha = null;
      fileShas = {};
    },

    async initAuth() {
      initializing = true;
      try {
        const hashToken = extractTokenFromHash();
        if (hashToken) {
          saveToken(hashToken);
          ghToken = hashToken;
        }

        // Validate token if present
        const token = ghToken;
        if (token) {
          authLoading = true;
          try {
            const user = await fetchGitHubUser(token);
            saveUser(user);
            ghUser = user;
          } catch {
            clearToken();
            ghToken = null;
            ghUser = null;
          }
          authLoading = false;
        }

        // Fetch available branches if authenticated
        if (isAuthenticated) {
          try {
            const cfg = getRepoConfig();
            availableBranches = await fetchBranchList(cfg, ghToken!);
          } catch {
            availableBranches = [];
          }
        }

        // Load latest data from static bundle (works for everyone, no auth needed)
        try {
          const staticData = await loadFromStaticBundle();
          if (staticData) {
            data = staticData;
            saveCampaign(data);
          }
        } catch {
          // Static fetch failed — localStorage is the fallback (already loaded)
        }

        if (isAuthenticated) {
          const files = shardCampaignData(data);
          lastSyncedFiles = files;
          syncStatus = 'synced';
        }
      } finally {
        initializing = false;
      }
    },

    // ── GitHub sync actions ─────────────────────────────────────────────────

    async pushToGitHub() {
      const token = ghToken;
      if (!token) throw new Error('Not authenticated');

      syncStatus = 'saving';
      syncError = null;

      try {
        validateCampaignData(data);
        await attemptSave(token, false);
        syncStatus = 'synced';
      } catch (err) {
        syncStatus = 'error';
        syncError = err instanceof Error ? err.message : String(err);
        throw err;
      }
    },

    // ── Branch actions ─────────────────────────────────────────────────────

    async fetchBranches() {
      const token = ghToken;
      if (!token) return;
      try {
        const cfg = getRepoConfig();
        availableBranches = await fetchBranchList(cfg, token);
      } catch {
        availableBranches = [];
      }
    },

    async setBranch(branch: string) {
      const token = ghToken;
      if (!token) throw new Error('Not authenticated');
      if (branch === currentBranch) return;

      currentBranch = branch;
      syncStatus = 'loading';
      syncError = null;

      // Reset sync state for the new branch
      headSha = null;
      treeSha = null;
      fileShas = {};
      lastSyncedFiles = null;
      clearGitHubSyncState();

      try {
        const cfg = { ...getRepoConfig(), branch };
        const snapshot = await loadFromGitHub(cfg, token);
        data = snapshot.data;
        saveCampaign(data);
        updateSyncCache(
          snapshot.headSha,
          snapshot.treeSha,
          snapshot.fileShas,
          shardCampaignData(snapshot.data),
        );
        syncStatus = 'synced';
      } catch (err) {
        syncStatus = 'error';
        syncError = err instanceof Error ? err.message : String(err);
        throw err;
      }
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

    // ── Event types & suggested tags ─────────────────────────────────────────

    addEventType(et: CustomEventType) {
      if (!data.eventTypes) data.eventTypes = [...DEFAULT_EVENT_TYPES];
      if (data.eventTypes.some((e) => e.id === et.id)) return;
      data.eventTypes.push(et);
      persist();
    },

    updateEventType(id: string, updates: Partial<CustomEventType>) {
      const list = data.eventTypes ?? DEFAULT_EVENT_TYPES;
      const idx = list.findIndex((e) => e.id === id);
      if (idx < 0) return;
      if (!data.eventTypes || data.eventTypes === DEFAULT_EVENT_TYPES) {
        data.eventTypes = [...(data.eventTypes ?? DEFAULT_EVENT_TYPES)];
      }
      const target = data.eventTypes[idx];
      const next = { ...target, ...updates };
      if (updates.id !== undefined && updates.id !== id) {
        data.events.forEach((e) => { if (e.type === id) e.type = updates.id!; });
      }
      data.eventTypes[idx] = next;
      persist();
    },

    deleteEventType(id: string) {
      const used = data.events.some((e) => e.type === id);
      if (used) return false;
      if (!data.eventTypes) return true;
      if (data.eventTypes === DEFAULT_EVENT_TYPES) data.eventTypes = [...DEFAULT_EVENT_TYPES];
      data.eventTypes = data.eventTypes.filter((e) => e.id !== id);
      if (data.eventTypes.length === 0) data.eventTypes = [...DEFAULT_EVENT_TYPES];
      persist();
      return true;
    },

    addSuggestedTag(tag: string) {
      const t = tag.trim();
      if (!t) return;
      if (!data.suggestedTags) data.suggestedTags = [];
      if (data.suggestedTags.includes(t)) return;
      data.suggestedTags.push(t);
      data.suggestedTags.sort();
      persist();
    },

    removeSuggestedTag(tag: string) {
      if (!data.suggestedTags) return;
      data.suggestedTags = data.suggestedTags.filter((t) => t !== tag);
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
