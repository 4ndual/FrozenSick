<script lang="ts">
  import { campaign } from '$lib/store/campaign.svelte';

  const hasFilters = $derived(
    campaign.filter.search !== '' ||
    campaign.filter.types.length > 0 ||
    campaign.filter.tags.length > 0 ||
    campaign.filter.characters.length > 0 ||
    campaign.filter.timelineIds.length > 0
  );

  const filteredCount = $derived(campaign.filteredEvents.length);
  const totalCount = $derived(campaign.data.events.length);
</script>

<aside class="sidebar">
  <div class="sidebar-header">
    <span class="sidebar-title">Filter & Search</span>
    {#if hasFilters}
      <button class="clear-btn" onclick={() => campaign.resetFilter()}>Clear all</button>
    {/if}
  </div>

  <!-- Search -->
  <div class="sidebar-group">
    <div class="search-wrap">
      <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
        <circle cx="11" cy="11" r="8"></circle>
        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
      </svg>
      <input
        class="search-input"
        type="search"
        placeholder="Search events…"
        value={campaign.filter.search}
        oninput={(e) => campaign.setFilter({ search: (e.target as HTMLInputElement).value })}
      />
    </div>
  </div>

  <!-- Event count -->
  <div class="event-count">
    Showing <strong>{filteredCount}</strong> of <strong>{totalCount}</strong> events
  </div>

  <!-- Event Types -->
  <div class="sidebar-group">
    <div class="group-label">Event Type</div>
    <div class="type-grid">
      {#each campaign.eventTypes as et}
        {@const active = campaign.filter.types.includes(et.id)}
        <button
          class="type-chip"
          class:active
          style="--chip-color: {et.color}"
          onclick={() => campaign.toggleFilterType(et.id)}
        >
          {et.label}
        </button>
      {/each}
    </div>
  </div>

  <!-- Timelines -->
  <div class="sidebar-group">
    <div class="group-label">Timelines</div>
    <div class="check-list">
      {#each campaign.data.timelines as tl}
        {@const active = campaign.filter.timelineIds.includes(tl.id)}
        <label class="check-item">
          <input
            type="checkbox"
            checked={active}
            onchange={() => campaign.toggleFilterTimeline(tl.id)}
          />
          <span class="tl-dot" style="background:{tl.color}"></span>
          {tl.name}
        </label>
      {/each}
    </div>
  </div>

  <!-- Characters -->
  {#if campaign.allCharacters.length > 0}
    <div class="sidebar-group">
      <div class="group-label">Characters</div>
      <div class="check-list">
        {#each campaign.allCharacters as char}
          {@const active = campaign.filter.characters.includes(char)}
          <label class="check-item">
            <input
              type="checkbox"
              checked={active}
              onchange={() => campaign.toggleFilterCharacter(char)}
            />
            {char}
          </label>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Tags -->
  {#if campaign.allTags.length > 0}
    <div class="sidebar-group">
      <div class="group-label">Tags</div>
      <div class="tags-wrap">
        {#each campaign.allTags as tag}
          {@const active = campaign.filter.tags.includes(tag)}
          <button
            class="tag-chip"
            class:active
            onclick={() => campaign.toggleFilterTag(tag)}
          >
            {tag}
          </button>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Show Secrets -->
  <div class="sidebar-group">
    <label class="check-item">
      <input
        type="checkbox"
        checked={campaign.filter.showSecrets}
        onchange={() => campaign.setFilter({ showSecrets: !campaign.filter.showSecrets })}
      />
      Show secret events
    </label>
  </div>

  <div class="sidebar-footer">
    <button class="add-btn" onclick={() => campaign.openEditor()}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <line x1="5" y1="12" x2="19" y2="12"></line>
      </svg>
      New Event
    </button>
  </div>
</aside>

<style>
  .sidebar {
    width: 230px;
    min-width: 230px;
    background: var(--surface);
    border-right: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .sidebar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 14px 10px;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }

  .sidebar-title {
    font-family: 'Cinzel', serif;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
  }

  .clear-btn {
    background: none;
    border: none;
    color: var(--gold-dim);
    font-size: 11px;
    cursor: pointer;
    text-decoration: underline dotted;
    padding: 0;
  }
  .clear-btn:hover { color: var(--gold); }

  .search-wrap {
    position: relative;
  }

  .search-icon {
    position: absolute;
    left: 9px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--text-dim);
    pointer-events: none;
  }

  .search-input {
    width: 100%;
    padding-left: 30px !important;
  }

  .event-count {
    font-size: 11px;
    color: var(--text-dim);
    padding: 0 14px 2px;
    font-style: italic;
  }
  .event-count strong { color: var(--text-muted); }

  .sidebar-group {
    padding: 10px 14px;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }

  .group-label {
    font-size: 10px;
    font-family: 'Cinzel', serif;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--text-dim);
    margin-bottom: 7px;
  }

  .type-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
  }

  .type-chip {
    background: var(--surface-2);
    border: 1px solid var(--border);
    color: var(--text-muted);
    border-radius: 4px;
    padding: 3px 8px;
    font-size: 11px;
    cursor: pointer;
    transition: all 0.15s;
  }
  .type-chip:hover {
    border-color: var(--chip-color, #888);
    color: var(--chip-color, #888);
  }
  .type-chip.active {
    background: var(--chip-color, #888);
    border-color: var(--chip-color, #888);
    color: #fff;
  }

  .check-list {
    display: flex;
    flex-direction: column;
    gap: 5px;
    max-height: 140px;
    overflow-y: auto;
  }

  .check-item {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 13px;
    color: var(--text-muted);
    cursor: pointer;
    font-family: 'Crimson Text', serif;
  }
  .check-item input[type="checkbox"] {
    width: 14px;
    height: 14px;
    padding: 0;
    accent-color: var(--gold);
  }
  .check-item:hover { color: var(--text); }

  .tl-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .tags-wrap {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    max-height: 100px;
    overflow-y: auto;
  }

  .tag-chip {
    background: var(--surface-2);
    border: 1px solid var(--border);
    color: var(--text-dim);
    border-radius: 3px;
    padding: 2px 7px;
    font-size: 11px;
    cursor: pointer;
    transition: all 0.15s;
  }
  .tag-chip:hover { color: var(--text-muted); border-color: var(--border-bright); }
  .tag-chip.active {
    background: var(--surface-3);
    border-color: var(--gold-dim);
    color: var(--gold-dim);
  }

  .sidebar-footer {
    margin-top: auto;
    padding: 12px 14px;
    border-top: 1px solid var(--border);
    flex-shrink: 0;
  }

  .add-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    width: 100%;
    background: var(--gold-dim);
    border: none;
    color: #fff;
    border-radius: 4px;
    padding: 8px;
    font-size: 13px;
    font-family: 'Cinzel', serif;
    letter-spacing: 0.03em;
  }
  .add-btn:hover { background: var(--gold); color: #0d0d1a; }
</style>
