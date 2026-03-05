<script lang="ts">
  import { campaign } from '$lib/store/campaign.svelte';
  import { generateId } from '$lib/utils/storage';
  import type { CampaignTimeline } from '$lib/types/schema';

  let editingId = $state<string | null>(null);
  let draft = $state<Partial<CampaignTimeline>>({});
  let showAdd = $state(false);
  let newDraft = $state<Partial<CampaignTimeline>>({ name: '', color: '#d4af37', description: '' });

  function startEdit(t: CampaignTimeline) {
    editingId = t.id;
    draft = { ...t };
  }

  function cancelEdit() {
    editingId = null;
    draft = {};
  }

  function saveEdit() {
    if (!editingId || !draft.name?.trim()) return;
    campaign.updateTimeline({ ...(campaign.data.timelines.find((t) => t.id === editingId)!), ...draft } as CampaignTimeline);
    editingId = null;
  }

  function deleteTimeline(id: string, name: string) {
    if (confirm(`Delete timeline "${name}"? Events on this timeline will remain but lose their track.`)) {
      campaign.deleteTimeline(id);
    }
  }

  function addTimeline() {
    if (!newDraft.name?.trim()) return;
    campaign.addTimeline({
      id: generateId(),
      name: newDraft.name.trim(),
      color: newDraft.color ?? '#d4af37',
      description: newDraft.description ?? '',
      order: campaign.data.timelines.length,
    });
    newDraft = { name: '', color: '#d4af37', description: '' };
    showAdd = false;
  }

  function countEvents(id: string) {
    return campaign.data.events.filter((e) => e.timelineId === id).length;
  }
</script>

<div class="settings-section">
  <div class="section-header">
    <h3>Timeline Tracks</h3>
    <p class="section-desc">
      Each track is a horizontal row on the timeline. Use tracks to separate story arcs, character journeys, or factions.
    </p>
  </div>

  <div class="timelines-list">
    {#each campaign.data.timelines.slice().sort((a, b) => a.order - b.order) as tl}
      <div class="timeline-card">
        {#if editingId === tl.id}
          <div class="edit-form">
            <div class="field-row">
              <input bind:value={draft.name} placeholder="Track name" style="flex:1" />
              <input type="color" bind:value={draft.color} style="width:44px;height:36px;padding:2px;border-radius:4px;cursor:pointer" />
            </div>
            <textarea bind:value={draft.description} rows={2} placeholder="Description (optional)"></textarea>
            <div class="edit-actions">
              <button class="btn-ghost" onclick={cancelEdit}>Cancel</button>
              <button class="btn-primary" onclick={saveEdit} disabled={!draft.name?.trim()}>Save</button>
            </div>
          </div>
        {:else}
          <div class="tl-bar" style="border-left-color:{tl.color}">
            <div class="tl-info">
              <span class="tl-color-dot" style="background:{tl.color}"></span>
              <div>
                <div class="tl-name">{tl.name}</div>
                {#if tl.description}
                  <div class="tl-desc">{tl.description}</div>
                {/if}
                <div class="tl-count">{countEvents(tl.id)} event{countEvents(tl.id) !== 1 ? 's' : ''}</div>
              </div>
            </div>
            <div class="tl-actions">
              <button class="icon-btn" onclick={() => startEdit(tl)} title="Edit">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
              </button>
              <button
                class="icon-btn icon-btn-danger"
                onclick={() => deleteTimeline(tl.id, tl.name)}
                title="Delete"
                disabled={campaign.data.timelines.length <= 1}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
                  <path d="M10 11v6"></path><path d="M14 11v6"></path>
                  <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path>
                </svg>
              </button>
            </div>
          </div>
        {/if}
      </div>
    {/each}
  </div>

  {#if showAdd}
    <div class="add-form">
      <div class="field-row">
        <input bind:value={newDraft.name} placeholder="Track name" style="flex:1" />
        <input type="color" bind:value={newDraft.color} style="width:44px;height:36px;padding:2px;border-radius:4px;cursor:pointer" />
      </div>
      <textarea bind:value={newDraft.description} rows={2} placeholder="Description (optional)"></textarea>
      <div class="edit-actions">
        <button class="btn-ghost" onclick={() => { showAdd = false; }}>Cancel</button>
        <button class="btn-primary" onclick={addTimeline} disabled={!newDraft.name?.trim()}>
          Create Track
        </button>
      </div>
    </div>
  {:else}
    <button class="btn-add" onclick={() => { showAdd = true; }}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <line x1="5" y1="12" x2="19" y2="12"></line>
      </svg>
      Add Timeline Track
    </button>
  {/if}
</div>

<style>
  .settings-section {
    max-width: 600px;
  }

  .section-header {
    margin-bottom: 20px;
  }

  h3 {
    margin: 0 0 6px;
    font-size: 18px;
    color: var(--gold);
  }

  .section-desc {
    margin: 0;
    font-size: 14px;
    color: var(--text-muted);
    font-style: italic;
  }

  .timelines-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 16px;
  }

  .timeline-card {
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: 6px;
    overflow: hidden;
  }

  .tl-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 14px;
    border-left: 4px solid;
  }

  .tl-info {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    flex: 1;
    min-width: 0;
  }

  .tl-color-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    margin-top: 3px;
    flex-shrink: 0;
  }

  .tl-name {
    font-family: 'Cinzel', serif;
    font-size: 14px;
    color: var(--text);
  }

  .tl-desc {
    font-size: 12px;
    color: var(--text-muted);
    margin-top: 2px;
    font-style: italic;
  }

  .tl-count {
    font-size: 11px;
    color: var(--text-dim);
    margin-top: 4px;
  }

  .tl-actions {
    display: flex;
    gap: 4px;
    flex-shrink: 0;
  }

  .icon-btn {
    background: none;
    border: 1px solid var(--border);
    color: var(--text-muted);
    border-radius: 4px;
    padding: 5px 7px;
    display: flex;
    align-items: center;
  }
  .icon-btn:hover { border-color: var(--border-bright); color: var(--text); }

  .icon-btn-danger:hover { border-color: var(--battle); color: var(--battle); }
  .icon-btn:disabled { opacity: 0.3; cursor: not-allowed; }

  .field-row {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .edit-form, .add-form {
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .add-form {
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: 6px;
    margin-bottom: 0;
  }

  .edit-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }

  .btn-ghost {
    background: none;
    border: 1px solid var(--border);
    color: var(--text-muted);
    border-radius: 4px;
    padding: 5px 12px;
    font-size: 13px;
  }
  .btn-ghost:hover { color: var(--text); border-color: var(--border-bright); }

  .btn-primary {
    background: var(--gold-dim);
    border: none;
    color: #fff;
    border-radius: 4px;
    padding: 5px 14px;
    font-size: 13px;
    font-family: 'Cinzel', serif;
  }
  .btn-primary:not(:disabled):hover { background: var(--gold); color: #0d0d1a; }
  .btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }

  .btn-add {
    display: flex;
    align-items: center;
    gap: 6px;
    background: none;
    border: 1px dashed var(--border-bright);
    color: var(--text-muted);
    border-radius: 6px;
    padding: 10px 16px;
    font-size: 13px;
    width: 100%;
    justify-content: center;
    transition: border-color 0.15s, color 0.15s;
  }
  .btn-add:hover { border-color: var(--gold-dim); color: var(--gold-dim); }

  textarea { width: 100%; resize: vertical; }
</style>
