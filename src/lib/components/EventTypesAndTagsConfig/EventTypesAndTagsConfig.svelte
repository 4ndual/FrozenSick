<script lang="ts">
  import { campaign } from '$lib/store/campaign.svelte';
  import type { CustomEventType } from '$lib/types/schema';

  const ICONS = [
    'swords', 'search', 'user', 'scroll-text', 'book-open', 'map-pin',
    'moon', 'shield', 'skull', 'flame', 'star', 'crown',
  ];

  let editingTypeId = $state<string | null>(null);
  let draft = $state<Partial<CustomEventType>>({});
  let showAddType = $state(false);
  let newType = $state<Partial<CustomEventType>>({ id: '', label: '', color: '#8a4a9a', icon: 'scroll-text' });
  let newTag = $state('');

  function startEdit(et: CustomEventType) {
    editingTypeId = et.id;
    draft = { ...et };
  }

  function cancelEdit() {
    editingTypeId = null;
    draft = {};
  }

  function saveEdit() {
    if (!editingTypeId || !draft.label?.trim()) return;
    const id = (draft.id ?? editingTypeId).trim().toLowerCase().replace(/\s+/g, '-') || editingTypeId;
    campaign.updateEventType(editingTypeId, { id, label: draft.label.trim(), color: draft.color ?? '#888', icon: draft.icon ?? 'scroll-text' });
    editingTypeId = null;
  }

  function deleteEventType(id: string, label: string) {
    const ok = campaign.deleteEventType(id);
    if (!ok) alert(`Cannot delete "${label}": at least one event uses this type. Change those events to another type first.`);
  }

  function addEventType() {
    const id = (newType.id?.trim().toLowerCase().replace(/\s+/g, '-') || newType.label?.trim().toLowerCase().replace(/\s+/g, '-') || '').slice(0, 32);
    if (!id || !newType.label?.trim()) return;
    if (campaign.eventTypes.some((e) => e.id === id)) {
      alert('An event type with this id already exists.');
      return;
    }
    campaign.addEventType({
      id,
      label: newType.label.trim(),
      color: newType.color ?? '#8a4a9a',
      icon: newType.icon ?? 'scroll-text',
    });
    newType = { id: '', label: '', color: '#8a4a9a', icon: 'scroll-text' };
    showAddType = false;
  }

  function addTag() {
    const t = newTag.trim();
    if (!t) return;
    campaign.addSuggestedTag(t);
    newTag = '';
  }

  function countEventsByType(id: string) {
    return campaign.data.events.filter((e) => e.type === id).length;
  }
</script>

<div class="settings-section">
  <div class="section-header">
    <h3>Event Types</h3>
    <p class="section-desc">
      Event types appear in the event editor and sidebar filters. You can add custom types or edit built-in ones.
    </p>
  </div>

  <div class="types-list">
    {#each campaign.eventTypes as et (et.id)}
      <div class="type-card">
        {#if editingTypeId === et.id}
          <div class="edit-form">
            <div class="field">
              <label for="edit-type-id">ID (used in data)</label>
              <input id="edit-type-id" bind:value={draft.id} placeholder="e.g. ritual" />
            </div>
            <div class="field">
              <label for="edit-type-label">Label</label>
              <input id="edit-type-label" bind:value={draft.label} placeholder="Display name" />
            </div>
            <div class="field-row">
              <div class="field">
                <label for="edit-type-color">Color</label>
                <input id="edit-type-color" type="color" bind:value={draft.color} style="width:44px;height:34px;padding:2px;border-radius:4px;cursor:pointer" />
              </div>
              <div class="field" style="flex:1">
                <label for="edit-type-icon">Icon</label>
                <select id="edit-type-icon" bind:value={draft.icon}>
                  {#each ICONS as ic}
                    <option value={ic}>{ic}</option>
                  {/each}
                </select>
              </div>
            </div>
            <div class="edit-actions">
              <button class="btn-ghost" onclick={cancelEdit}>Cancel</button>
              <button class="btn-primary" onclick={saveEdit} disabled={!draft.label?.trim()}>Save</button>
            </div>
          </div>
        {:else}
          <div class="type-bar" style="border-left-color:{et.color}">
            <div class="type-info">
              <span class="type-color-dot" style="background:{et.color}"></span>
              <div>
                <div class="type-name">{et.label}</div>
                <div class="type-meta">id: {et.id} · {countEventsByType(et.id)} events</div>
              </div>
            </div>
            <div class="type-actions">
              <button class="btn-icon" onclick={() => startEdit(et)} title="Edit" aria-label="Edit {et.label}" data-testid="eventtype-edit-{et.id}">Edit</button>
              <button class="btn-icon btn-danger" onclick={() => deleteEventType(et.id, et.label)} title="Delete" aria-label="Delete {et.label}" data-testid="eventtype-delete-{et.id}">Delete</button>
            </div>
          </div>
        {/if}
      </div>
    {/each}
  </div>

  {#if showAddType}
    <div class="add-form">
      <div class="field">
        <label for="new-type-id">ID (lowercase, no spaces)</label>
        <input id="new-type-id" bind:value={newType.id} placeholder="e.g. ritual" />
      </div>
      <div class="field">
        <label for="new-type-label">Label</label>
        <input id="new-type-label" bind:value={newType.label} placeholder="Display name" />
      </div>
      <div class="field-row">
        <div class="field">
          <label for="new-type-color">Color</label>
          <input id="new-type-color" type="color" bind:value={newType.color} style="width:44px;height:34px;padding:2px;border-radius:4px;cursor:pointer" />
        </div>
        <div class="field" style="flex:1">
          <label for="new-type-icon">Icon</label>
          <select id="new-type-icon" bind:value={newType.icon}>
            {#each ICONS as ic}
              <option value={ic}>{ic}</option>
            {/each}
          </select>
        </div>
      </div>
      <div class="edit-actions">
        <button class="btn-ghost" onclick={() => { showAddType = false; newType = { id: '', label: '', color: '#8a4a9a', icon: 'scroll-text' }; }}>Cancel</button>
        <button class="btn-primary" onclick={addEventType} disabled={!newType.label?.trim()}>Add type</button>
      </div>
    </div>
  {:else}
    <button class="btn-secondary" onclick={() => { showAddType = true; }}>+ Add event type</button>
  {/if}
</div>

<div class="section-divider"></div>

<div class="settings-section">
  <div class="section-header">
    <h3>Suggested Tags</h3>
    <p class="section-desc">
      Optional list of tags you can pick from when editing events. Events can still use any tag; this list is for quick access in settings.
    </p>
  </div>

  <div class="tags-list">
    {#each campaign.suggestedTags as tag}
      <span class="tag-pill">
        {tag}
        <button class="tag-remove" onclick={() => campaign.removeSuggestedTag(tag)} aria-label="Remove tag {tag}" data-testid="tag-remove-{tag}">×</button>
      </span>
    {/each}
  </div>

  <div class="add-tag-row">
    <input type="text" bind:value={newTag} placeholder="New tag name" onkeydown={(e) => e.key === 'Enter' && addTag()} />
    <button class="btn-primary" onclick={addTag} disabled={!newTag.trim()}>Add tag</button>
  </div>
</div>

<style>
  .types-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 14px;
  }

  .type-card {
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: 6px;
    overflow: hidden;
  }

  .type-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
    border-left: 4px solid var(--border);
  }

  .type-info {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .type-color-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .type-name {
    font-weight: 600;
    color: var(--text);
  }

  .type-meta {
    font-size: 11px;
    color: var(--text-dim);
  }

  .type-actions {
    display: flex;
    gap: 6px;
  }

  .btn-icon {
    background: none;
    border: 1px solid var(--border);
    color: var(--text-muted);
    border-radius: 4px;
    padding: 4px 10px;
    font-size: 12px;
  }
  .btn-icon:hover { border-color: var(--gold-dim); color: var(--gold); }
  .btn-icon.btn-danger:hover { border-color: var(--battle); color: var(--battle); }

  .edit-form, .add-form {
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .field-row {
    display: flex;
    gap: 12px;
  }
  .field-row .field { flex: 1; }

  .edit-actions {
    display: flex;
    gap: 8px;
    margin-top: 4px;
  }

  .tags-list {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 12px;
  }

  .tag-pill {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 4px 8px;
    font-size: 13px;
    color: var(--text-muted);
  }

  .tag-remove {
    background: none;
    border: none;
    color: var(--text-dim);
    font-size: 14px;
    line-height: 1;
    padding: 0 2px;
    cursor: pointer;
    border-radius: 2px;
  }
  .tag-remove:hover { color: var(--battle); }

  .add-tag-row {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .add-tag-row input { flex: 1; max-width: 200px; }
</style>
