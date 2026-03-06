<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';

  interface Props {
    branches: string[];
    currentBranch: string;
    defaultBranch: string;
    labels?: Record<string, string>;
    onSelect?: ((branch: string) => void) | null;
  }

  let { branches, currentBranch, defaultBranch, labels = {}, onSelect = null }: Props = $props();

  function displayName(branch: string): string {
    return labels[branch] || branch;
  }
  let open = $state(false);

  function selectBranch(branch: string) {
    open = false;
    if (onSelect) {
      onSelect(branch);
    } else {
      const url = new URL($page.url);
      if (branch === defaultBranch) {
        url.searchParams.delete('branch');
      } else {
        url.searchParams.set('branch', branch);
      }
      goto(url.toString(), { invalidateAll: true });
    }
  }
</script>

<div class="branch-selector">
  <button
    type="button"
    class="branch-btn"
    onclick={() => (open = !open)}
    aria-expanded={open}
    aria-haspopup="listbox"
    aria-label="Select branch"
    data-testid="branch-selector"
  >
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13">
      <line x1="6" y1="3" x2="6" y2="15"></line>
      <circle cx="18" cy="6" r="3"></circle>
      <circle cx="6" cy="18" r="3"></circle>
      <path d="M18 9a9 9 0 0 1-9 9"></path>
    </svg>
    <span class="branch-name">{displayName(currentBranch)}</span>
    <svg class="chevron" class:flipped={open} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12">
      <polyline points="6 9 12 15 18 9"></polyline>
    </svg>
  </button>

  {#if open}
    <div class="branch-dropdown" role="listbox" aria-label="Available branches">
      {#each branches as branch (branch)}
        <button
          type="button"
          class="branch-option"
          class:active={branch === currentBranch}
          onclick={() => selectBranch(branch)}
          role="option"
          aria-selected={branch === currentBranch}
          data-testid="branch-option-{branch}"
        >
          {displayName(branch)}
          {#if branch === defaultBranch}
            <span class="default-badge">live</span>
          {/if}
        </button>
      {/each}
    </div>
  {/if}
</div>

{#if open}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="branch-backdrop" onclick={() => (open = false)}></div>
{/if}

<style>
  .branch-selector {
    position: relative;
  }

  .branch-btn {
    display: flex;
    align-items: center;
    gap: 5px;
    background: var(--surface-2, #1a1a2e);
    border: 1px solid var(--border);
    color: var(--text-muted);
    border-radius: 4px;
    padding: 4px 8px;
    font-size: 12px;
    font-family: 'Cinzel', serif;
    letter-spacing: 0.03em;
    cursor: pointer;
    transition: all 0.15s;
  }

  .branch-btn:hover {
    border-color: var(--border-bright);
    color: var(--text);
  }

  .branch-name {
    max-width: 180px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .chevron {
    transition: transform 0.15s;
    flex-shrink: 0;
  }

  .chevron.flipped {
    transform: rotate(180deg);
  }

  .branch-dropdown {
    position: absolute;
    top: calc(100% + 4px);
    right: 0;
    min-width: 180px;
    max-height: 280px;
    overflow-y: auto;
    background: var(--surface, #16162a);
    border: 1px solid var(--border-bright);
    border-radius: 6px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
    z-index: 200;
    padding: 4px;
  }

  .branch-option {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    padding: 6px 10px;
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: 12px;
    font-family: 'Cinzel', serif;
    text-align: left;
    cursor: pointer;
    border-radius: 3px;
    transition: all 0.1s;
  }

  .branch-option:hover {
    background: var(--surface-2, #1a1a2e);
    color: var(--text);
  }

  .branch-option.active {
    color: var(--gold, #d4af37);
    background: var(--surface-2, #1a1a2e);
  }

  .default-badge {
    font-size: 9px;
    padding: 1px 5px;
    border-radius: 3px;
    background: var(--surface-3, #222);
    color: var(--text-dim);
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .branch-backdrop {
    position: fixed;
    inset: 0;
    z-index: 150;
  }
</style>
