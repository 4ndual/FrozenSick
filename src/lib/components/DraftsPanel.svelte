<script lang="ts">
  import { invalidateAll } from '$app/navigation';

  interface Draft {
    branch: string;
    label: string;
  }

  let open = $state(false);
  let drafts = $state<Draft[]>([]);
  let loading = $state(false);
  let discarding = $state<string | null>(null);

  async function loadDrafts() {
    loading = true;
    try {
      const res = await fetch('/api/drafts');
      if (res.ok) {
        const data = await res.json();
        drafts = data.drafts;
      }
    } finally {
      loading = false;
    }
  }

  function toggle() {
    open = !open;
    if (open) loadDrafts();
  }

  async function discardDraft(branch: string) {
    discarding = branch;
    try {
      const res = await fetch('/api/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'discard', branch }),
      });
      if (res.ok) {
        drafts = drafts.filter((d) => d.branch !== branch);
        invalidateAll();
      }
    } finally {
      discarding = null;
    }
  }

  async function publishDraft(branch: string) {
    discarding = branch;
    try {
      const res = await fetch('/api/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'publish', branch }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.published) {
          drafts = drafts.filter((d) => d.branch !== branch);
          invalidateAll();
        }
      }
    } finally {
      discarding = null;
    }
  }
</script>

<div class="drafts-wrapper">
  <button class="drafts-toggle" onclick={toggle} title="Your drafts" data-testid="drafts-toggle" aria-expanded={open} aria-haspopup="true" aria-label="Your drafts">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
      <polyline points="14 2 14 8 20 8"></polyline>
      <line x1="16" y1="13" x2="8" y2="13"></line>
      <line x1="16" y1="17" x2="8" y2="17"></line>
    </svg>
    Drafts
    {#if drafts.length > 0}
      <span class="drafts-badge">{drafts.length}</span>
    {/if}
  </button>

  {#if open}
    <div class="drafts-dropdown" data-testid="drafts-dropdown">
      <div class="drafts-header">Your Drafts</div>
      {#if loading}
        <div class="drafts-loading">Loading…</div>
      {:else if drafts.length === 0}
        <div class="drafts-empty">No unpublished drafts</div>
      {:else}
        {#each drafts as draft (draft.branch)}
          <div class="drafts-item" data-testid="draft-item-{draft.branch}">
            <span class="drafts-label">{draft.label}</span>
            <div class="drafts-actions">
              <button
                class="drafts-action drafts-publish"
                onclick={() => publishDraft(draft.branch)}
                disabled={discarding === draft.branch}
                title="Publish"
                data-testid="draft-publish-{draft.branch}"
              >
                Publish
              </button>
              <button
                class="drafts-action drafts-discard"
                onclick={() => discardDraft(draft.branch)}
                disabled={discarding === draft.branch}
                title="Discard"
                data-testid="draft-discard-{draft.branch}"
              >
                Discard
              </button>
            </div>
          </div>
        {/each}
      {/if}
    </div>
  {/if}
</div>

<style>
  .drafts-wrapper {
    position: relative;
  }

  .drafts-toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: var(--surface);
    color: var(--text-muted);
    font-size: 0.8rem;
    cursor: pointer;
    transition: border-color 0.15s, color 0.15s;
  }

  .drafts-toggle:hover {
    border-color: var(--gold, #d4af37);
    color: var(--text);
  }

  .drafts-badge {
    background: var(--gold-dim, #8b7d2a);
    color: var(--gold, #d4af37);
    border-radius: 9px;
    padding: 0 5px;
    font-size: 0.7rem;
    min-width: 16px;
    text-align: center;
  }

  .drafts-dropdown {
    position: absolute;
    top: 100%;
    right: 0;
    margin-top: 6px;
    background: var(--surface);
    border: 1px solid var(--border-bright);
    border-radius: 6px;
    min-width: 260px;
    max-height: 300px;
    overflow-y: auto;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
    z-index: 200;
  }

  .drafts-header {
    padding: 8px 12px;
    font-weight: 600;
    font-size: 0.8rem;
    color: var(--text);
    border-bottom: 1px solid var(--border);
  }

  .drafts-loading,
  .drafts-empty {
    padding: 12px;
    color: var(--text-muted);
    font-size: 0.8rem;
    text-align: center;
  }

  .drafts-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--border);
  }

  .drafts-item:last-child {
    border-bottom: none;
  }

  .drafts-label {
    font-size: 0.8rem;
    color: var(--text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .drafts-actions {
    display: flex;
    gap: 4px;
    flex-shrink: 0;
  }

  .drafts-action {
    padding: 2px 8px;
    border-radius: 3px;
    font-size: 0.7rem;
    cursor: pointer;
    border: 1px solid transparent;
  }

  .drafts-publish {
    background: var(--gold-dim, #8b7d2a);
    border-color: var(--gold, #d4af37);
    color: #fff;
  }

  .drafts-publish:hover:not(:disabled) {
    background: var(--gold, #d4af37);
  }

  .drafts-discard {
    background: transparent;
    border-color: var(--border);
    color: var(--text-muted);
  }

  .drafts-discard:hover:not(:disabled) {
    border-color: #cc4444;
    color: #cc4444;
  }

  .drafts-action:disabled {
    opacity: 0.5;
    cursor: default;
  }
</style>
