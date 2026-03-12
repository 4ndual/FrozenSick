<script lang="ts">
  import { onMount } from 'svelte';
  import { campaign } from '$lib/store/campaign.svelte';
  import Header from '$lib/components/Header/Header.svelte';
  import TimelineView from '$lib/components/TimelineView/TimelineView.svelte';
  import RelationshipGraph from '$lib/components/RelationshipGraph/RelationshipGraph.svelte';
  import EventEditor from '$lib/components/EventEditor/EventEditor.svelte';
  import EventDetail from '$lib/components/EventEditor/EventDetail.svelte';
  import Sidebar from '$lib/components/Sidebar/Sidebar.svelte';
  import CalendarConfig from '$lib/components/CalendarConfig/CalendarConfig.svelte';
  import TimelineManager from '$lib/components/TimelineManager/TimelineManager.svelte';
  import EventTypesAndTagsConfig from '$lib/components/EventTypesAndTagsConfig/EventTypesAndTagsConfig.svelte';

  onMount(() => {
    campaign.initAuth();
  });
</script>

<div class="app" data-testid="timeline-app">
  <Header mode="timeline" />

  <!-- ── Body ──────────────────────────────────────────────────────────── -->
  <div class="body">
    <!-- Sidebar -->
    {#if campaign.sidebarOpen && campaign.activeTab !== 'settings'}
      <Sidebar />
    {/if}

    <main class="main" data-testid="timeline-main" aria-label="Timeline">
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
          <nav class="settings-nav" aria-label="Settings" data-testid="settings-nav">
            <span class="settings-nav-title">Settings</span>
            <a href="#timelines" class="settings-nav-item" data-testid="settings-nav-timelines">Timeline Tracks</a>
            <a href="#event-types" class="settings-nav-item" data-testid="settings-nav-event-types">Event Types & Tags</a>
            <a href="#calendar" class="settings-nav-item" data-testid="settings-nav-calendar">Calendar</a>
            <a href="#campaign" class="settings-nav-item" data-testid="settings-nav-campaign">Campaign Info</a>
            <a href="#data" class="settings-nav-item" data-testid="settings-nav-data">Data</a>
          </nav>
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
          </div>
        </div>
        </div>
      {/if}
    </main>
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

  @media (max-width: 980px) {
    .settings-layout {
      flex-direction: column;
      overflow-y: auto;
    }

    .settings-nav {
      width: 100%;
      min-width: 0;
      border-right: none;
      border-bottom: 1px solid var(--border);
      padding: 12px;
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .settings-nav-title {
      width: 100%;
      padding: 0;
    }

    .settings-nav-item {
      border: 1px solid var(--border);
      border-radius: 4px;
      padding: 6px 10px;
      background: var(--surface-2);
    }

    .settings-content {
      padding: 16px;
    }
  }
</style>
