<script lang="ts">
  import { campaign } from '../../store/campaign.svelte.ts';
  import { RELATION_TYPE_LABELS } from '../../types/schema.ts';
  import { formatDate } from '../../utils/calendar.ts';

  const ev = $derived(campaign.detailEvent);
  const cal = $derived(campaign.data.calendar);

  function getTypeLabel(typeId: string) {
    return campaign.eventTypes.find((e) => e.id === typeId)?.label ?? typeId;
  }

  function getTypeColor(typeId: string) {
    return campaign.eventTypes.find((e) => e.id === typeId)?.color ?? '#888';
  }

  function getRelatedEvent(id: string) {
    return campaign.data.events.find((e) => e.id === id);
  }

  function getTimelineName(id: string) {
    return campaign.data.timelines.find((t) => t.id === id)?.name ?? id;
  }

  function getTimelineColor(id: string) {
    return campaign.data.timelines.find((t) => t.id === id)?.color ?? '#888';
  }
</script>

{#if ev}
  <div class="detail-panel">
    <div class="detail-header">
      <div class="detail-type" style="color: {getTypeColor(ev.type)}">
        {getTypeLabel(ev.type)}
      </div>
      <div class="detail-actions">
        <button class="action-btn" onclick={() => campaign.openEditor(ev!)} title="Edit">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
          Edit
        </button>
        <button class="action-btn action-btn-close" onclick={() => campaign.closeDetail()} title="Close">✕</button>
      </div>
    </div>

    <h3 class="detail-title">{ev.title}</h3>

    <div class="detail-meta">
      <span class="meta-row">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="16" y1="2" x2="16" y2="6"></line>
          <line x1="8" y1="2" x2="8" y2="6"></line>
          <line x1="3" y1="10" x2="21" y2="10"></line>
        </svg>
        {formatDate(ev.date, cal)}
        {#if ev.endDate}
          → {formatDate(ev.endDate, cal)}
        {/if}
      </span>
      <span class="meta-row">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
        </svg>
        <span style="color:{getTimelineColor(ev.timelineId)}">{getTimelineName(ev.timelineId)}</span>
      </span>
      {#if ev.secret}
        <span class="meta-row secret-badge">🔒 Secret — DM only</span>
      {/if}
    </div>

    {#if ev.description}
      <p class="detail-desc">{ev.description}</p>
    {/if}

    {#if ev.tags.length > 0}
      <div class="tags-row">
        {#each ev.tags as tag}
          <span class="tag">{tag}</span>
        {/each}
      </div>
    {/if}

    {#if ev.linkedCharacters.length > 0}
      <div class="section">
        <div class="section-label">Characters</div>
        <div class="tags-row">
          {#each ev.linkedCharacters as char}
            <span class="tag tag-char">{char}</span>
          {/each}
        </div>
      </div>
    {/if}

    {#if ev.linkedChapter}
      <div class="section">
        <div class="section-label">Chapter</div>
        <a href="/chapters/{ev.linkedChapter.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}/summary"
           class="chapter-link"
           target="_blank" rel="noopener">
          {ev.linkedChapter}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="11" height="11">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
            <polyline points="15 3 21 3 21 9"></polyline>
            <line x1="10" y1="14" x2="21" y2="3"></line>
          </svg>
        </a>
      </div>
    {/if}

    {#if ev.relations.length > 0}
      <div class="section">
        <div class="section-label">Relations</div>
        <ul class="rel-list">
          {#each ev.relations as rel}
            {@const target = getRelatedEvent(rel.targetId)}
            {#if target}
              <li>
                <span class="rel-chip">{RELATION_TYPE_LABELS[rel.type]}</span>
                <button
                  class="rel-link"
                  onclick={() => {
                    campaign.setSelectedEvent(target.id);
                    campaign.openDetail(target.id);
                  }}
                >
                  {target.title}
                </button>
                {#if rel.label}
                  <span class="rel-label-text">"{rel.label}"</span>
                {/if}
              </li>
            {/if}
          {/each}
        </ul>
      </div>
    {/if}
  </div>
{/if}

<style>
  .detail-panel {
    background: var(--surface);
    border-top: 1px solid var(--border);
    padding: 14px 16px;
    min-height: 0;
    overflow-y: auto;
    max-height: 300px;
    flex-shrink: 0;
  }

  .detail-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 6px;
  }

  .detail-type {
    font-size: 11px;
    font-family: 'Cinzel', serif;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .detail-actions {
    display: flex;
    gap: 6px;
    align-items: center;
  }

  .action-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    background: none;
    border: 1px solid var(--border);
    color: var(--text-muted);
    border-radius: 4px;
    padding: 3px 8px;
    font-size: 12px;
    font-family: 'Cinzel', serif;
  }
  .action-btn:hover { border-color: var(--gold-dim); color: var(--gold); }

  .action-btn-close {
    font-size: 14px;
    padding: 3px 7px;
  }
  .action-btn-close:hover { border-color: var(--battle); color: var(--battle); }

  .detail-title {
    margin: 0 0 8px;
    font-size: 18px;
    color: var(--text);
    font-weight: 600;
  }

  .detail-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 16px;
    margin-bottom: 10px;
  }

  .meta-row {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 13px;
    color: var(--text-muted);
  }

  .secret-badge {
    color: var(--gold-dim);
    font-style: italic;
  }

  .detail-desc {
    margin: 0 0 10px;
    font-size: 14px;
    color: var(--text);
    line-height: 1.6;
    font-style: italic;
  }

  .tags-row {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    margin-bottom: 8px;
  }

  .tag {
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: 3px;
    padding: 2px 7px;
    font-size: 11px;
    color: var(--text-muted);
  }

  .tag-char {
    border-color: var(--gold-dim);
    color: var(--gold-dim);
  }

  .section {
    margin-top: 10px;
  }

  .section-label {
    font-size: 11px;
    font-family: 'Cinzel', serif;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-dim);
    margin-bottom: 5px;
  }

  .chapter-link {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: var(--lore);
    font-size: 13px;
    text-decoration: none;
  }
  .chapter-link:hover { color: var(--gold); }

  .rel-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .rel-list li {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
  }

  .rel-chip {
    font-size: 10px;
    font-family: 'Cinzel', serif;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: 3px;
    padding: 1px 5px;
    color: var(--gold-dim);
    white-space: nowrap;
  }

  .rel-link {
    background: none;
    border: none;
    color: var(--text);
    text-decoration: underline dotted;
    cursor: pointer;
    font-size: 13px;
    font-family: inherit;
    padding: 0;
  }
  .rel-link:hover { color: var(--gold); }

  .rel-label-text {
    color: var(--text-dim);
    font-style: italic;
    font-size: 12px;
  }
</style>
