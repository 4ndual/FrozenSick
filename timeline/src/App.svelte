<script lang="ts">
  import { campaign } from './store/campaign.svelte.ts';
  import TimelineView from './components/TimelineView/TimelineView.svelte';
  import RelationshipGraph from './components/RelationshipGraph/RelationshipGraph.svelte';
  import EventEditor from './components/EventEditor/EventEditor.svelte';
  import EventDetail from './components/EventEditor/EventDetail.svelte';
  import Sidebar from './components/Sidebar/Sidebar.svelte';
  import CalendarConfig from './components/CalendarConfig/CalendarConfig.svelte';
  import TimelineManager from './components/TimelineManager/TimelineManager.svelte';
  import EventTypesAndTagsConfig from './components/EventTypesAndTagsConfig/EventTypesAndTagsConfig.svelte';
  import { exportCampaign, importCampaign } from './utils/storage.ts';

  async function handleImport() {
    try {
      await campaign.importData();
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
      <button class="action-btn action-btn-gold" onclick={() => campaign.exportData()} title="Export campaign JSON">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
        Export
      </button>
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
                  <p class="section-desc">All data is stored locally in your browser. Export regularly to back up your campaign.</p>
                </div>
                <div class="data-actions">
                  <button class="btn-secondary" onclick={handleImport}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                      <polyline points="17 8 12 3 7 8"></polyline>
                      <line x1="12" y1="3" x2="12" y2="15"></line>
                    </svg>
                    Import JSON
                  </button>
                  <button class="btn-primary" onclick={() => campaign.exportData()}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                      <polyline points="7 10 12 15 17 10"></polyline>
                      <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                    Export JSON
                  </button>
                </div>
                <p class="data-note">
                  Stored in localStorage key: <code>frozen-sick-timeline-v1</code><br/>
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
</style>
