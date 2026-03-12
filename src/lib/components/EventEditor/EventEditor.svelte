<script lang="ts">
  import { onMount } from 'svelte';
  import { campaign } from '$lib/store/campaign.svelte';
  import { RELATION_TYPE_LABELS } from '$lib/types/schema';
  import type { CampaignEvent, EventRelation, FantasyDate } from '$lib/types/schema';
  import { clampDay } from '$lib/utils/calendar';
  import { generateId } from '$lib/utils/storage';
  import EntityDropdown from '$lib/components/common/EntityDropdown.svelte';

  const isNew = $derived(!campaign.editingEvent);
  const cal = $derived(campaign.data.calendar);
  const FALLBACK_CHAPTERS = [
    'Chapter 1 - The Tavern',
    'Chapter 2 - The Plateau',
    'Chapter 3 - The Flying Turtle',
    'Chapter 4 - The Battle of Brasboredon',
    'Chapter 5 - The Escape from Brasboredon',
  ];

  function blankDate(): FantasyDate {
    return { year: cal.epoch, month: 1, day: 1 };
  }

  function makeBlank(): CampaignEvent {
    const first = campaign.eventTypes[0];
    return {
      id: generateId(),
      title: '',
      description: '',
      date: blankDate(),
      endDate: null,
      timelineId: campaign.data.timelines[0]?.id ?? '',
      type: first?.id ?? 'quest',
      relations: [],
      tags: [],
      color: null,
      icon: first?.icon ?? 'scroll-text',
      secret: false,
      linkedChapter: '',
      linkedCharacters: [],
      location: null,
    };
  }

  let draft = $state<CampaignEvent>(makeBlank());
  let tagsInput = $state('');
  let hasEndDate = $state(false);
  let newRelTargetId = $state('');
  let newRelType = $state<EventRelation['type']>('related');
  let newRelLabel = $state('');
  let chapterOptions = $state<string[]>(FALLBACK_CHAPTERS);
  let chapterJsonEntries = $state<{ id: string; path: string }[]>([]);
  let wikiPlaces = $state<string[]>([]);

  const characterOptions = $derived(
    campaign.allCharacters.map((char) => ({ value: char, label: char })),
  );
  const placeOptions = $derived.by(() => {
    const merged = [...campaign.allPlaces, ...wikiPlaces];
    const deduped = new Map<string, string>();
    for (const place of merged) {
      const trimmed = place.trim();
      if (!trimmed) continue;
      const key = trimmed.toLowerCase();
      if (!deduped.has(key)) deduped.set(key, trimmed);
    }
    return [...deduped.values()]
      .sort((a, b) => a.localeCompare(b))
      .map((place) => ({ value: place, label: place }));
  });
  const relationTargetOptions = $derived(
    campaign.allEventOptions.filter((ev) => ev.value !== draft.id),
  );

  onMount(() => {
    return campaign.onEditorOpen((ev) => {
      if (ev) {
        draft = $state.snapshot(ev) as CampaignEvent;
        tagsInput = draft.tags.join(', ');
        hasEndDate = draft.endDate !== null;
      } else {
        draft = makeBlank();
        tagsInput = '';
        hasEndDate = false;
      }
      newRelTargetId = '';
      newRelType = 'related';
      newRelLabel = '';
    });
  });

  async function loadChapterOptions(branch: string) {
    try {
      const params = new URLSearchParams({ branch });
      const res = await fetch(`/api/wiki/chapters?${params}`);
      if (!res.ok) return;
      const data: {
        chapters?: string[];
        chapterJson?: { id: string; path: string }[];
      } = await res.json();
      chapterOptions = data.chapters?.length ? data.chapters : FALLBACK_CHAPTERS;
      chapterJsonEntries = data.chapterJson ?? [];
    } catch {
      // Keep editor usable if chapter list cannot be loaded.
      chapterOptions = FALLBACK_CHAPTERS;
      chapterJsonEntries = [];
    }
  }

  async function loadWikiPlaces(branch: string) {
    try {
      const params = new URLSearchParams({ branch });
      const res = await fetch(`/api/world/places?${params}`);
      if (!res.ok) return;
      const data: { places?: string[] } = await res.json();
      wikiPlaces = Array.isArray(data.places) ? data.places : [];
    } catch {
      // Keep location dropdown usable if place list cannot be loaded.
      wikiPlaces = [];
    }
  }

  $effect(() => {
    const branch = campaign.currentBranch;
    if (branch) {
      void loadChapterOptions(branch);
      void loadWikiPlaces(branch);
    }
  });

  function syncTags() {
    draft.tags = tagsInput.split(',').map((t) => t.trim()).filter(Boolean);
  }

  function onCharactersChange(nextValues: string[]) {
    draft.linkedCharacters = [...new Set(nextValues.map((value) => value.trim()).filter(Boolean))];
  }

  function onLocationChange(nextValues: string[]) {
    const location = nextValues[0]?.trim() ?? '';
    draft.location = location || null;
  }

  function onRelationTargetChange(nextValues: string[]) {
    newRelTargetId = nextValues[0] ?? '';
  }

  function onTypeChange() {
    const et = campaign.eventTypes.find((e) => e.id === draft.type);
    draft.icon = et?.icon ?? 'scroll-text';
    draft.color = null;
  }

  function typeColor(typeId: string) {
    return campaign.eventTypes.find((e) => e.id === typeId)?.color ?? '#888';
  }

  function toggleEndDate() {
    hasEndDate = !hasEndDate;
    draft.endDate = hasEndDate ? { ...draft.date } : null;
  }

  function clampDateDay(date: FantasyDate) {
    date.day = clampDay(date.day, date.month, cal);
  }

  function addRelation() {
    if (!newRelTargetId || newRelTargetId === draft.id) return;
    const exists = draft.relations.some((r) => r.targetId === newRelTargetId);
    if (exists) return;
    draft.relations.push({
      targetId: newRelTargetId,
      type: newRelType,
      label: newRelLabel || RELATION_TYPE_LABELS[newRelType],
    });
    newRelTargetId = '';
    newRelLabel = '';
  }

  function removeRelation(idx: number) {
    draft.relations.splice(idx, 1);
  }

  function save() {
    syncTags();
    if (!draft.title.trim()) return;
    if (isNew) {
      campaign.addEvent(draft);
    } else {
      campaign.updateEvent(draft);
    }
    campaign.closeEditor();
  }

  function handleDelete() {
    if (!draft.id) return;
    if (confirm(`Delete "${draft.title}"? This cannot be undone.`)) {
      campaign.deleteEvent(draft.id);
      campaign.closeEditor();
    }
  }

  function getEventTitle(id: string) {
    return campaign.data.events.find((e) => e.id === id)?.title ?? id;
  }

  const ICONS = [
    'swords', 'search', 'user', 'scroll-text', 'book-open', 'map-pin',
    'moon', 'shield', 'skull', 'flame', 'star', 'crown',
  ];
</script>

{#if campaign.editorOpen}
  <!-- Backdrop -->
  <button
    class="backdrop"
    aria-label="Close editor"
    onclick={() => campaign.closeEditor()}
  ></button>

  <!-- Drawer -->
  <div class="drawer" role="dialog" aria-modal="true" aria-label="Event Editor" data-testid="event-editor">
    <div class="drawer-header">
      <h2>{isNew ? 'New Event' : 'Edit Event'}</h2>
      <button class="close-btn" aria-label="Close" onclick={() => campaign.closeEditor()}>✕</button>
    </div>

    <div class="drawer-body">
      <!-- Title -->
      <div class="field">
        <label for="ev-title">Title <span class="req">*</span></label>
        <input id="ev-title" bind:value={draft.title} placeholder="Event title…" />
      </div>

      <!-- Description -->
      <div class="field">
        <label for="ev-desc">Description</label>
        <textarea id="ev-desc" bind:value={draft.description} rows={3} placeholder="What happened…"></textarea>
      </div>

      <!-- Type + Timeline row -->
      <div class="field-row">
        <div class="field">
          <label for="ev-type">Type</label>
          <select id="ev-type" bind:value={draft.type} onchange={onTypeChange}>
            {#each campaign.eventTypes as et}
              <option value={et.id}>{et.label}</option>
            {/each}
          </select>
        </div>
        <div class="field">
          <label for="ev-timeline">Timeline</label>
          <select id="ev-timeline" bind:value={draft.timelineId}>
            {#each campaign.data.timelines as tl}
              <option value={tl.id}>{tl.name}</option>
            {/each}
          </select>
        </div>
      </div>

      <!-- Date -->
      <div class="field-row">
        <div class="field date-field">
          <span class="field-heading">Start Date</span>
          <div class="date-row">
            <input
              type="number"
              bind:value={draft.date.day}
              onchange={() => clampDateDay(draft.date)}
              min="1"
              max={cal.months[draft.date.month - 1]?.days ?? 30}
              placeholder="Day"
            />
            <select bind:value={draft.date.month} onchange={() => clampDateDay(draft.date)}>
              {#each cal.months as m, i}
                <option value={i + 1}>{m.name}</option>
              {/each}
            </select>
            <input
              type="number"
              bind:value={draft.date.year}
              placeholder="Year"
              style="width:70px"
            />
            <span class="year-suffix">{cal.yearSuffix}</span>
          </div>
        </div>
      </div>

      <!-- End date toggle -->
      <div class="field">
        <label class="checkbox-label">
          <input type="checkbox" checked={hasEndDate} onchange={toggleEndDate} />
          Multi-day event (has end date)
        </label>
        {#if hasEndDate && draft.endDate}
          <div class="date-row" style="margin-top:6px">
            <input
              type="number"
              bind:value={draft.endDate.day}
              onchange={() => draft.endDate && clampDateDay(draft.endDate)}
              min="1"
              max={cal.months[(draft.endDate?.month ?? 1) - 1]?.days ?? 30}
              placeholder="Day"
            />
            <select bind:value={draft.endDate.month} onchange={() => draft.endDate && clampDateDay(draft.endDate)}>
              {#each cal.months as m, i}
                <option value={i + 1}>{m.name}</option>
              {/each}
            </select>
            <input
              type="number"
              bind:value={draft.endDate.year}
              placeholder="Year"
              style="width:70px"
            />
            <span class="year-suffix">{cal.yearSuffix}</span>
          </div>
        {/if}
      </div>

      <!-- Icon + Color row -->
      <div class="field-row">
        <div class="field">
          <label for="ev-icon">Icon</label>
          <select id="ev-icon" bind:value={draft.icon}>
            {#each ICONS as ic}
              <option value={ic}>{ic}</option>
            {/each}
          </select>
        </div>
        <div class="field">
          <label for="ev-color">Color override</label>
          <div class="color-row">
            <input
              id="ev-color"
              type="color"
              value={draft.color ?? typeColor(draft.type)}
              oninput={(e) => { draft.color = (e.target as HTMLInputElement).value; }}
            />
            {#if draft.color}
              <button class="clear-color" onclick={() => { draft.color = null; }}>Reset</button>
            {/if}
          </div>
        </div>
      </div>

      <!-- Tags -->
      <div class="field">
        <label for="ev-tags">Tags <span class="hint">(comma-separated)</span></label>
        <input
          id="ev-tags"
          bind:value={tagsInput}
          onblur={syncTags}
          placeholder="chapter-4, combat, dragon…"
        />
      </div>

      <!-- Linked chapter -->
      <div class="field">
        <label for="ev-chapter">Linked Chapter</label>
        <select id="ev-chapter" bind:value={draft.linkedChapter}>
          <option value="">— none —</option>
          {#each chapterOptions as chapter}
            <option value={chapter}>{chapter}</option>
          {/each}
          {#if chapterJsonEntries.length > 0}
            <optgroup label="Chapter JSON entries">
              {#each chapterJsonEntries as jsonEntry}
                <option value={jsonEntry.id}>[JSON] {jsonEntry.id}</option>
              {/each}
            </optgroup>
          {/if}
        </select>
      </div>

      <!-- Linked characters -->
      <div class="field">
        <span class="field-heading">Linked Characters <span class="hint">(select or create)</span></span>
        <EntityDropdown
          label="Linked characters"
          options={characterOptions}
          selectedValues={draft.linkedCharacters}
          onChange={onCharactersChange}
          testIdBase="event-characters"
          placeholder="Select or type characters…"
          searchPlaceholder="Search or create character…"
          multi={true}
          allowCreate={true}
        />
      </div>

      <!-- Location (for map) -->
      <div class="field">
        <span class="field-heading">Location <span class="hint">(place name for map)</span></span>
        <EntityDropdown
          label="Location"
          options={placeOptions}
          selectedValues={draft.location ? [draft.location] : []}
          onChange={onLocationChange}
          testIdBase="event-location"
          placeholder="Select or type a place…"
          searchPlaceholder="Search or create place…"
          allowCreate={true}
        />
      </div>

      <!-- Secret -->
      <div class="field">
        <label class="checkbox-label">
          <input type="checkbox" bind:checked={draft.secret} />
          Secret (DM-only, hidden from players)
        </label>
      </div>

      <!-- Relations -->
      <div class="field">
        <span class="field-heading">Event Relations</span>
        {#if draft.relations.length > 0}
          <ul class="relations-list">
            {#each draft.relations as rel, i}
              <li>
                <span class="rel-type">{RELATION_TYPE_LABELS[rel.type]}</span>
                <span class="rel-target">→ {getEventTitle(rel.targetId)}</span>
                {#if rel.label}
                  <span class="rel-label">"{rel.label}"</span>
                {/if}
                <button class="rel-remove" onclick={() => removeRelation(i)}>✕</button>
              </li>
            {/each}
          </ul>
        {/if}

        <div class="rel-add-row">
          <select bind:value={newRelType} style="width:120px">
            {#each Object.entries(RELATION_TYPE_LABELS) as [val, label]}
              <option value={val}>{label}</option>
            {/each}
          </select>
          <div class="rel-target">
            <EntityDropdown
              label="Relation target event"
              options={relationTargetOptions}
              selectedValues={newRelTargetId ? [newRelTargetId] : []}
              onChange={onRelationTargetChange}
              testIdBase="event-relations-event"
              placeholder="Pick event…"
              searchPlaceholder="Search events…"
            />
          </div>
          <input bind:value={newRelLabel} placeholder="label (opt)" style="width:110px" />
          <button class="rel-add-btn" onclick={addRelation} disabled={!newRelTargetId}>Add</button>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="drawer-footer">
      {#if !isNew}
        <button class="btn-danger" onclick={handleDelete} data-testid="event-delete">Delete</button>
      {/if}
      <button class="btn-ghost" onclick={() => campaign.closeEditor()} data-testid="event-cancel">Cancel</button>
      <button class="btn-primary" onclick={save} disabled={!draft.title.trim()} data-testid="event-save">
        {isNew ? 'Create Event' : 'Save Changes'}
      </button>
    </div>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.55);
    z-index: 40;
    border: none;
    cursor: pointer;
  }

  .drawer {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    width: 480px;
    max-width: 100vw;
    background: var(--surface);
    border-left: 1px solid var(--border-bright);
    z-index: 50;
    display: flex;
    flex-direction: column;
    box-shadow: -8px 0 32px rgba(0, 0, 0, 0.6);
  }

  .drawer-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }

  .drawer-header h2 {
    margin: 0;
    font-size: 18px;
    color: var(--gold);
  }

  .close-btn {
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: 18px;
    padding: 4px 8px;
    border-radius: 4px;
    transition: color 0.15s;
  }
  .close-btn:hover { color: var(--text); }

  .drawer-body {
    flex: 1;
    overflow-y: auto;
    padding: 16px 20px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .field-row {
    display: flex;
    gap: 12px;
  }
  .field-row .field { flex: 1; }

  label, .field-heading {
    font-size: 12px;
    font-family: 'Cinzel', serif;
    color: var(--text-muted);
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .hint {
    font-family: 'Crimson Text', serif;
    text-transform: none;
    font-size: 11px;
    opacity: 0.7;
  }

  .req { color: var(--battle); }

  input, textarea, select {
    width: 100%;
  }
  textarea { resize: vertical; min-height: 70px; }

  .date-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .date-row input[type="number"] { width: 52px; }
  .date-row select { flex: 1; }
  .year-suffix { font-size: 12px; color: var(--text-muted); white-space: nowrap; }

  .date-field { flex: 1; }

  .color-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .color-row input[type="color"] {
    width: 44px;
    height: 34px;
    padding: 2px;
    border-radius: 4px;
    cursor: pointer;
  }
  .clear-color {
    font-size: 12px;
    background: none;
    border: 1px solid var(--border);
    color: var(--text-muted);
    border-radius: 4px;
    padding: 3px 8px;
  }
  .clear-color:hover { color: var(--text); border-color: var(--border-bright); }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    font-family: 'Crimson Text', serif;
    font-size: 14px;
    text-transform: none;
    letter-spacing: 0;
    color: var(--text);
  }
  .checkbox-label input[type="checkbox"] {
    width: 16px;
    height: 16px;
    padding: 0;
    accent-color: var(--gold);
  }

  .relations-list {
    list-style: none;
    margin: 0 0 8px;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .relations-list li {
    display: flex;
    align-items: center;
    gap: 6px;
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 5px 8px;
    font-size: 13px;
  }
  .rel-type {
    color: var(--gold-dim);
    font-size: 11px;
    font-family: 'Cinzel', serif;
    text-transform: uppercase;
    white-space: nowrap;
  }
  .rel-target { color: var(--text); flex: 1; overflow: hidden; text-overflow: ellipsis; }
  .rel-label { color: var(--text-muted); font-style: italic; font-size: 12px; }
  .rel-remove {
    background: none;
    border: none;
    color: var(--text-dim);
    font-size: 12px;
    padding: 2px 4px;
    border-radius: 3px;
    flex-shrink: 0;
  }
  .rel-remove:hover { color: var(--battle); }

  .rel-add-row {
    display: flex;
    gap: 6px;
    align-items: flex-start;
  }
  .rel-target {
    flex: 1;
  }
  .rel-add-btn {
    padding: 6px 12px;
    background: var(--surface-3);
    border: 1px solid var(--border);
    color: var(--text);
    border-radius: 4px;
    font-size: 13px;
    white-space: nowrap;
  }
  .rel-add-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .rel-add-btn:not(:disabled):hover { border-color: var(--gold-dim); color: var(--gold); }

  .drawer-footer {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 14px 20px;
    border-top: 1px solid var(--border);
    flex-shrink: 0;
  }

  .btn-danger {
    background: none;
    border: 1px solid var(--battle);
    color: var(--battle);
    border-radius: 4px;
    padding: 7px 14px;
    font-size: 13px;
    font-family: 'Cinzel', serif;
    margin-right: auto;
  }
  .btn-danger:hover { background: var(--battle); color: #fff; }

  .btn-ghost {
    background: none;
    border: 1px solid var(--border);
    color: var(--text-muted);
    border-radius: 4px;
    padding: 7px 14px;
    font-size: 13px;
  }
  .btn-ghost:hover { border-color: var(--border-bright); color: var(--text); }

  .btn-primary {
    background: var(--gold-dim);
    border: none;
    color: #fff;
    border-radius: 4px;
    padding: 7px 18px;
    font-size: 13px;
    font-family: 'Cinzel', serif;
    letter-spacing: 0.03em;
  }
  .btn-primary:not(:disabled):hover { background: var(--gold); color: #0d0d1a; }
  .btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
