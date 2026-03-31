<script lang="ts">
  import { onMount } from 'svelte';
  import { campaign } from '$lib/store/campaign.svelte';
  import TimelineView from '$lib/components/TimelineView/TimelineView.svelte';
  import RelationshipGraph from '$lib/components/RelationshipGraph/RelationshipGraph.svelte';
  import EventEditor from '$lib/components/EventEditor/EventEditor.svelte';
  import EventDetail from '$lib/components/EventEditor/EventDetail.svelte';
  import Sidebar from '$lib/components/Sidebar/Sidebar.svelte';
  import CalendarConfig from '$lib/components/CalendarConfig/CalendarConfig.svelte';
  import TimelineManager from '$lib/components/TimelineManager/TimelineManager.svelte';
  import EventTypesAndTagsConfig from '$lib/components/EventTypesAndTagsConfig/EventTypesAndTagsConfig.svelte';
  import { exportCampaign, importCampaign } from '$lib/utils/storage';

  onMount(() => {
    campaign.initAuth();
  });

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

<div class="app">
  <!-- ── Header ─────────────────────────────────────────────────────────── -->
  <header class="header">
    <a href="/" class="back-link" title="Back to wiki">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
        <path d="M19 12H5"></path>
        <path d="M12 19l-7-7 7-7"></path>
      </svg>
      Wiki
    </a>

    <div class="campaign-name">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="18" height="18" style="color:var(--gold)">
        <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
        <path d="M2 17l10 5 10-5"></path>
        <path d="M2 12l10 5 10-5"></path>
      </svg>
      {campaign.data.meta.campaignName}
      <span class="campaign-sub">Campaign Timeline</span>
    </div>

    <!-- Tab nav -->
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

    <div class="header-actions">
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

      <!-- GitHub Auth -->
      {#if campaign.authLoading}
        <span class="gh-loading">
          <svg class="spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
          </svg>
        </span>
      {:else if campaign.isAuthenticated && campaign.ghUser}
        <button class="gh-avatar-btn" onclick={() => campaign.logout()} title="Logged in as {campaign.ghUser.login} — click to logout">
          <img src={campaign.ghUser.avatar_url} alt={campaign.ghUser.login} class="gh-avatar" width="28" height="28" />
        </button>
      {:else}
        <button class="action-btn gh-login-btn" onclick={() => campaign.login()} title="Sign in with GitHub to sync data">
          <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path>
          </svg>
          Login
        </button>
      {/if}
    </div>
  </header>

  <!-- ── Body ──────────────────────────────────────────────────────────── -->
  <div class="body">
    <!-- Sidebar -->
    {#if campaign.sidebarOpen && campaign.activeTab !== 'settings'}
      <Sidebar />
    {/if}

    <div class="main">
      {#if campaign.activeTab === 'timeline'}
        <div class="view">
          <TimelineView />
          <EventDetail />
        </div>
      {:else if campaign.activeTab === 'graph'}
        <div class="view">
          <RelationshipGraph />
          <EventDetail />
        </div>
      {:else}
        <div class="view view-scroll">
          <div class="settings-layout">
          <div class="settings-nav">
            <span class="settings-nav-title">Settings</span>
            <a href="#timelines" class="settings-nav-item">Timeline Tracks</a>
            <a href="#event-types" class="settings-nav-item">Event Types & Tags</a>
            <a href="#calendar" class="settings-nav-item">Calendar</a>
            <a href="#campaign" class="settings-nav-item">Campaign Info</a>
            <a href="#data" class="settings-nav-item">Data</a>
          </div>
          <div class="settings-content">
            <section id="timelines">
              <TimelineManager />
            </section>
            <div class="section-divider"></div>
            <section id="event-types">
              <EventTypesAndTagsConfig />
            </section>
            <div class="section-divider"></div>
            <section id="calendar">
              <CalendarConfig />
            </section>
            <div class="section-divider"></div>
            <section id="campaign">
              <div class="settings-section">
                <div class="section-header">
                  <h3>Campaign Info</h3>
                </div>
                <div class="field">
                  <label for="campaign-name-input">Campaign Name</label>
                  <input
                    id="campaign-name-input"
                    value={campaign.data.meta.campaignName}
                    oninput={(e) => campaign.updateMeta((e.target as HTMLInputElement).value)}
                    style="max-width:300px"
                  />
                </div>
              </div>
            </section>
            <div class="section-divider"></div>
            <section id="data">
              <div class="settings-section">
                <div class="section-header">
                  <h3>Data Management</h3>
                  <p class="section-desc">Data is stored locally and synced to GitHub when signed in.</p>
                </div>

                <!-- GitHub sync panel -->
                <div class="gh-sync-panel">
                  <div class="gh-sync-header">
                    <svg viewBox="0 0 16 16" fill="currentColor" width="16" height="16" style="color:var(--text-muted)">
                      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path>
                    </svg>
                    <span>GitHub Sync</span>
                    <span class="sync-indicator sync-{campaign.syncStatus}" style="margin-left:auto">
                      <span class="sync-dot"></span>
                      {campaign.syncStatus}
                    </span>
                  </div>

                  {#if campaign.isAuthenticated && campaign.ghUser}
                    <p class="data-note" style="margin:0 0 10px">
                      Signed in as <strong>{campaign.ghUser.login}</strong>
                    </p>
                    {#if campaign.syncError}
                      <p class="sync-error">{campaign.syncError}</p>
                    {/if}
                    <div class="data-actions">
                      <button
                        class="btn-primary"
                        onclick={handlePush}
                        disabled={campaign.syncStatus === 'saving' || campaign.syncStatus === 'loading' || campaign.syncStatus === 'synced'}
                      >Save to GitHub</button>
                      <button class="btn-secondary" onclick={() => campaign.logout()}>Logout</button>
                    </div>
                  {:else}
                    <p class="data-note" style="margin:0 0 10px">
                      Sign in to sync your campaign data across devices and share with your group.
                    </p>
                    <button class="btn-primary" onclick={() => campaign.login()}>
                      <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
                        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path>
                      </svg>
                      Sign in with GitHub
                    </button>
                  {/if}
                </div>

                <div style="margin-top:20px"></div>
                <div class="data-actions">
                  <button class="btn-secondary" onclick={handleImport}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                      <polyline points="17 8 12 3 7 8"></polyline>
                      <line x1="12" y1="3" x2="12" y2="15"></line>
                    </svg>
                    Import JSON
                  </button>
                  <button class="btn-secondary" onclick={() => campaign.exportData()}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                      <polyline points="7 10 12 15 17 10"></polyline>
                      <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                    Export JSON
                  </button>
                </div>
                <p class="data-note">
                  Local storage key: <code>frozen-sick-timeline-v1</code><br/>
                  Total events: {campaign.data.events.length} · Timelines: {campaign.data.timelines.length}
                </p>
              </div>
            </section>
          </div>
        </div>
        </div>
      {/if}
    </div>
  </div>

  <!-- ── Overlays ───────────────────────────────────────────────────────── -->
  <EventEditor />
</div>

<style>
  .app {
    display: flex;
    flex-direction: column;
    height: 100dvh;
    overflow: hidden;
    background: var(--bg);
  }

  /* Header */
  .header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 0 14px;
    height: 52px;
    background: var(--surface);
    border-bottom: 1px solid var(--border-bright);
    flex-shrink: 0;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.4);
    position: relative;
    z-index: 10;
  }

  .back-link {
    display: flex;
    align-items: center;
    gap: 5px;
    color: var(--text-muted);
    text-decoration: none;
    font-size: 12px;
    font-family: 'Cinzel', serif;
    padding: 4px 8px;
    border-radius: 4px;
    border: 1px solid var(--border);
    transition: all 0.15s;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .back-link:hover { color: var(--text); border-color: var(--border-bright); }

  .campaign-name {
    display: flex;
    align-items: center;
    gap: 7px;
    font-family: 'Cinzel', serif;
    font-size: 15px;
    font-weight: 600;
    color: var(--text);
    white-space: nowrap;
    flex-shrink: 0;
  }

  .campaign-sub {
    font-size: 11px;
    color: var(--text-dim);
    font-weight: 400;
    letter-spacing: 0.04em;
  }

  .tab-nav {
    display: flex;
    align-items: center;
    gap: 2px;
    margin: 0 auto;
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
    transition: all 0.15s;
  }
  .tab:hover { color: var(--text); background: var(--surface-3); }
  .tab.active {
    background: var(--surface-3);
    color: var(--gold);
    box-shadow: 0 0 0 1px var(--border-bright);
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
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
    transition: all 0.15s;
  }
  .action-btn:hover { border-color: var(--border-bright); color: var(--text); }

  .action-btn-gold {
    border-color: var(--gold-dim);
    color: var(--gold-dim);
  }
  .action-btn-gold:hover { background: var(--gold-glow); color: var(--gold); border-color: var(--gold); }

  /* Body */
  .body {
    display: flex;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  .main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .view {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-height: 0;
  }

  .view-scroll {
    overflow-y: auto;
  }

  /* Settings layout */
  .settings-layout {
    display: flex;
    height: 100%;
    overflow: hidden;
  }

  .settings-nav {
    width: 180px;
    min-width: 180px;
    background: var(--surface);
    border-right: 1px solid var(--border);
    padding: 20px 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .settings-nav-title {
    font-family: 'Cinzel', serif;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-dim);
    padding: 0 16px 10px;
  }

  .settings-nav-item {
    display: block;
    padding: 7px 16px;
    font-size: 13px;
    color: var(--text-muted);
    text-decoration: none;
    font-family: 'Crimson Text', serif;
    transition: all 0.15s;
  }
  .settings-nav-item:hover { color: var(--text); background: var(--surface-2); }

  .settings-content {
    flex: 1;
    overflow-y: auto;
    padding: 28px 32px;
  }

  .section-divider {
    border: none;
    border-top: 1px solid var(--border);
    margin: 32px 0;
  }

  .settings-section {
    max-width: 680px;
  }

  .section-header {
    margin-bottom: 20px;
  }

  .section-header h3 {
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

  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 14px;
  }

  label {
    font-size: 11px;
    font-family: 'Cinzel', serif;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
  }

  .data-actions {
    display: flex;
    gap: 10px;
    margin-bottom: 14px;
  }

  .data-note {
    font-size: 12px;
    color: var(--text-dim);
    line-height: 1.8;
  }

  code {
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: 3px;
    padding: 1px 5px;
    font-size: 11px;
    color: var(--text-muted);
  }

  .btn-secondary {
    display: flex;
    align-items: center;
    gap: 6px;
    background: none;
    border: 1px solid var(--border-bright);
    color: var(--text-muted);
    border-radius: 4px;
    padding: 7px 14px;
    font-size: 13px;
    font-family: 'Cinzel', serif;
  }
  .btn-secondary:hover { color: var(--text); border-color: var(--gold-dim); }

  .btn-primary {
    display: flex;
    align-items: center;
    gap: 6px;
    background: var(--gold-dim);
    border: none;
    color: #fff;
    border-radius: 4px;
    padding: 7px 18px;
    font-size: 13px;
    font-family: 'Cinzel', serif;
    letter-spacing: 0.03em;
  }
  .btn-primary:hover { background: var(--gold); color: #0d0d1a; }
  .btn-primary:disabled, .btn-secondary:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  /* GitHub sync */
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
    flex-shrink: 0;
  }

  .sync-idle .sync-dot { background: var(--text-dim); }
  .sync-synced .sync-dot { background: #4a9a4a; }
  .sync-dirty .sync-dot { background: #d4af37; }
  .sync-saving .sync-dot { background: #4a9a9a; }
  .sync-loading .sync-dot { background: #4a9a9a; }
  .sync-error .sync-dot { background: #cc2222; }

  .sync-error {
    font-size: 12px;
    color: #cc4444;
    margin: 0 0 10px;
    padding: 6px 10px;
    background: rgba(204, 34, 34, 0.1);
    border: 1px solid rgba(204, 34, 34, 0.25);
    border-radius: 4px;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  .spin { animation: spin 0.8s linear infinite; }

  /* GitHub auth */
  .gh-avatar-btn {
    background: none;
    border: 2px solid var(--border);
    border-radius: 50%;
    padding: 0;
    cursor: pointer;
    transition: border-color 0.15s;
    line-height: 0;
  }
  .gh-avatar-btn:hover { border-color: var(--gold-dim); }

  .gh-avatar {
    border-radius: 50%;
    display: block;
  }

  .gh-login-btn {
    border-color: var(--border-bright);
  }

  .gh-loading {
    display: flex;
    align-items: center;
    color: var(--text-dim);
  }

  .gh-sync-panel {
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 14px 16px;
    margin-bottom: 14px;
  }

  .gh-sync-header {
    display: flex;
    align-items: center;
    gap: 8px;
    font-family: 'Cinzel', serif;
    font-size: 13px;
    color: var(--text-muted);
    margin-bottom: 10px;
  }
</style>
