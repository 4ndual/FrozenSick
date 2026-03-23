<script lang="ts">
  import { campaign } from '$lib/store/campaign.svelte';
  import { browser } from '$app/environment';

  async function handleImport() {
    try {
      await campaign.importData();
    } catch (e) {
      alert((e as Error).message);
    }
  }

  async function handlePush() {
    try {
      await campaign.pushToGitHub();
    } catch (e) {
      alert((e as Error).message);
    }
  }
</script>

<div class="timeline-nav">
  <div class="nav-left">
    <!-- Tab navigation -->
    <nav class="tab-nav">
      {#each ['timeline', 'graph', 'settings'] as tab}
        <button
          class="tab"
          class:active={campaign.activeTab === tab}
          onclick={() => campaign.setActiveTab(tab as 'timeline' | 'graph' | 'settings')}
        >
          {#if tab === 'timeline'}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
              <line x1="2" y1="12" x2="22" y2="12"></line>
              <circle cx="6" cy="12" r="2" fill="currentColor" stroke="none"></circle>
              <circle cx="12" cy="8" r="2" fill="currentColor" stroke="none"></circle>
              <circle cx="18" cy="12" r="2" fill="currentColor" stroke="none"></circle>
            </svg>
            Timeline
          {:else if tab === 'graph'}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
              <circle cx="18" cy="5" r="3"></circle>
              <circle cx="6" cy="12" r="3"></circle>
              <circle cx="18" cy="19" r="3"></circle>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
            </svg>
            Relations
          {:else}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.07 4.93l-1.41 1.41M5.34 18.66l-1.41 1.41M20 12h-2M6 12H4M17.66 18.66l-1.41-1.41M7.76 6.34L6.34 4.93M12 20v-2M12 6V4"></path>
            </svg>
            Settings
          {/if}
        </button>
      {/each}
    </nav>
  </div>

  {#if browser}
    <div class="nav-right">
      <!-- Sync status -->
      {#if campaign.isAuthenticated}
        <div class="sync-group">
          <span class="sync-indicator sync-{campaign.syncStatus}" title="Sync status: {campaign.syncStatus}">
            {#if campaign.syncStatus === 'saving' || campaign.syncStatus === 'loading'}
              <svg class="spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12">
                <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
              </svg>
            {:else}
              <span class="sync-dot"></span>
            {/if}
            {#if campaign.syncStatus === 'dirty'}Unsaved
            {:else if campaign.syncStatus === 'saving'}Saving…
            {:else if campaign.syncStatus === 'loading'}Pulling…
            {:else if campaign.syncStatus === 'synced'}Synced
            {:else if campaign.syncStatus === 'error'}Error
            {:else}—
            {/if}
          </span>

          <button
            class="action-btn action-btn-gold"
            onclick={handlePush}
            disabled={campaign.syncStatus === 'saving' || campaign.syncStatus === 'loading' || campaign.syncStatus === 'synced'}
            title="Save changes to GitHub"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
              <path d="M17 3H7a4 4 0 0 0-4 4v10a4 4 0 0 0 4 4h10a4 4 0 0 0 4-4V7a4 4 0 0 0-4-4z"></path>
              <path d="M8 3v4h8V3"></path>
              <circle cx="12" cy="14" r="2"></circle>
            </svg>
            Save
          </button>
        </div>
      {/if}

      <!-- Action buttons -->
      <button class="action-btn" onclick={() => campaign.toggleSidebar()} title="Toggle sidebar">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="9" y1="3" x2="9" y2="21"></line>
        </svg>
      </button>

      <button class="action-btn" onclick={handleImport} title="Import campaign JSON">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="17 8 12 3 7 8"></polyline>
          <line x1="12" y1="3" x2="12" y2="15"></line>
        </svg>
        Import
      </button>

      <button class="action-btn" onclick={() => campaign.exportData()} title="Export campaign JSON">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
        Export
      </button>
    </div>
  {/if}
</div>

<style>
  .timeline-nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 8px 16px;
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }

  .nav-left {
    display: flex;
    align-items: center;
  }

  .nav-right {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .tab-nav {
    display: flex;
    align-items: center;
    gap: 2px;
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 3px;
  }

  .tab {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 5px 14px;
    border: none;
    background: transparent;
    color: var(--text-muted);
    border-radius: 4px;
    font-size: 13px;
    font-family: 'Cinzel', serif;
    letter-spacing: 0.03em;
    cursor: pointer;
    transition: all 0.15s;
  }

  .tab:hover {
    color: var(--text);
    background: var(--surface-3);
  }

  .tab.active {
    background: var(--surface-3);
    color: var(--gold);
    box-shadow: 0 0 0 1px var(--border-bright);
  }

  .sync-group {
    display: flex;
    align-items: center;
    gap: 6px;
    border-right: 1px solid var(--border);
    padding-right: 8px;
    margin-right: 2px;
  }

  .sync-indicator {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 11px;
    font-family: 'Cinzel', serif;
    letter-spacing: 0.03em;
    color: var(--text-dim);
    text-transform: capitalize;
    white-space: nowrap;
  }

  .sync-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    display: inline-block;
  }

  .sync-idle .sync-dot { background: var(--text-dim); }
  .sync-synced .sync-dot { background: #4a9a4a; }
  .sync-dirty .sync-dot { background: #d4af37; }
  .sync-saving .sync-dot { background: #4a9a9a; }
  .sync-loading .sync-dot { background: #4a9a9a; }
  .sync-error .sync-dot { background: #cc2222; }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .spin {
    animation: spin 0.8s linear infinite;
  }

  .action-btn {
    display: flex;
    align-items: center;
    gap: 5px;
    background: none;
    border: 1px solid var(--border);
    color: var(--text-muted);
    border-radius: 4px;
    padding: 5px 10px;
    font-size: 12px;
    font-family: 'Cinzel', serif;
    letter-spacing: 0.03em;
    cursor: pointer;
    transition: all 0.15s;
  }

  .action-btn:hover {
    border-color: var(--border-bright);
    color: var(--text);
  }

  .action-btn-gold {
    border-color: var(--gold-dim);
    color: var(--gold-dim);
  }

  .action-btn-gold:hover {
    background: var(--gold-glow);
    color: var(--gold);
    border-color: var(--gold);
  }

  .action-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  @media (max-width: 768px) {
    .timeline-nav {
      flex-direction: column;
      gap: 8px;
      padding: 8px;
    }

    .nav-left,
    .nav-right {
      width: 100%;
      justify-content: center;
    }
  }
</style>
