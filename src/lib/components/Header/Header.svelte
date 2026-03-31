<script lang="ts">
  import ModeSwitcher from './ModeSwitcher.svelte';
  import BranchSelector from '$lib/components/BranchSelector.svelte';
  import DraftsPanel from '$lib/components/DraftsPanel.svelte';
  import ApprovalsPanel from '$lib/components/ApprovalsPanel.svelte';
  import { campaign } from '$lib/store/campaign.svelte';
  import { browser } from '$app/environment';
  import { onMount } from 'svelte';
  import { goto, invalidateAll } from '$app/navigation';
  import { slugify, slugifyPath } from '$lib/utils/slugify';
  import {
    timelineSyncToHeader,
    wikiSyncToHeader,
    type WikiSyncStatus,
  } from '$lib/utils/sync-view';

  interface Props {
    mode: 'wiki' | 'timeline' | 'map';
    sourcePath?: string | null;
    returnTo?: string;
    branch?: string | null;
    defaultBranch?: string;
    branches?: string[];
    branchLabels?: Record<string, string>;
    initialSyncStatus?: WikiSyncStatus;
  }

  let {
    mode,
    sourcePath = null,
    returnTo = '/',
    branch = null,
    defaultBranch = 'main',
    branches = [],
    branchLabels = {},
    initialSyncStatus = 'viewing',
  }: Props = $props();

  const TOKEN_KEY = 'frozen-sick-gh-token';

  let activeBranch = $derived(branch || defaultBranch);
  const CONTENT_BRANCH_PREFIX = 'content/';

  let serverAuthenticated = $state(false);
  let isAdmin = $state(false);
  let canApprove = $state(false);
  let allowDirectDefaultBranchEdits = $state(false);
  let modalOpen = $state(false);
  let editContent = $state('');
  let editSha = $state('');
  let editPath = $state('');
  let message = $state('');
  let messageOk = $state(false);
  let messageErr = $state(false);
  let createModalOpen = $state(false);
  let createType = $state<'md' | 'json'>('md');
  let createFolder = $state('content/Chapters');
  let createTitle = $state('');
  let createFilename = $state('');
  let createContent = $state('');
  let createMessage = $state('');
  let createMessageOk = $state(false);
  let createMessageErr = $state(false);
  let createPrUrl = $state<string | null>(null);
  let createDirty = $state(false);

  let wikiSyncStatus = $state<WikiSyncStatus>('viewing');
  let prUrl = $state<string | null>(null);
  let contentBranch = $state<string | null>(null);
  let pulling = $state(false);
  let attemptedTimelineAuthSync = $state(false);
  let timelineSyncView = $derived(timelineSyncToHeader(campaign.syncStatus, campaign.behindPublished));
  let wikiSyncView = $derived(wikiSyncToHeader(wikiSyncStatus));
  let attemptedTimelineBranchLoad = $state(false);
  let timelineBranches = $derived.by<string[]>(() => {
    if (campaign.availableBranches.length > 0) return campaign.availableBranches;
    return [campaign.currentBranch || campaign.defaultBranch];
  });

  $effect(() => {
    wikiSyncStatus = initialSyncStatus;
  });

  $effect(() => {
    if (mode !== 'wiki') return;
    contentBranch = activeBranch.startsWith(CONTENT_BRANCH_PREFIX) ? activeBranch : null;
  });

  function handleHashToken() {
    if (!browser) return false;
    const hash = window.location.hash;
    if (hash.indexOf('#token=') !== 0) return false;
    const t = hash.slice(7);
    if (t) {
      localStorage.setItem(TOKEN_KEY, t);
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
      return true;
    }
    return false;
  }

  async function refreshServerAuth() {
    if (!browser) return;
    try {
      const res = await fetch('/api/status');
      if (!res.ok) return;
      const data = (await res.json()) as {
        authenticated?: boolean;
        isAdmin?: boolean;
        canApprove?: boolean;
        allowDirectDefaultBranchEdits?: boolean;
      };
      serverAuthenticated = !!data.authenticated;
      isAdmin = !!data.isAdmin;
      canApprove = !!data.canApprove;
      allowDirectDefaultBranchEdits = !!data.allowDirectDefaultBranchEdits;
      campaign.setWorkflowCapabilities({
        isAdmin: !!data.isAdmin,
        allowDirectDefaultBranchEdits: !!data.allowDirectDefaultBranchEdits,
      });
    } catch {
      // Ignore transient network/auth status fetch failures.
    }
  }

  onMount(() => {
    handleHashToken();
    void refreshServerAuth();
    const onWorkflowSettingsUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ allowDirectDefaultBranchEdits?: boolean }>).detail;
      allowDirectDefaultBranchEdits = detail?.allowDirectDefaultBranchEdits === true;
      campaign.setWorkflowCapabilities({
        isAdmin,
        allowDirectDefaultBranchEdits,
      });
    };
    window.addEventListener('workflow-settings-updated', onWorkflowSettingsUpdated as EventListener);
    return () =>
      window.removeEventListener(
        'workflow-settings-updated',
        onWorkflowSettingsUpdated as EventListener,
      );
  });

  $effect(() => {
    if (mode !== 'timeline') return;
    if (!serverAuthenticated || campaign.isAuthenticated) {
      attemptedTimelineAuthSync = false;
      return;
    }
    if (campaign.authLoading) return;
    if (attemptedTimelineAuthSync) return;
    attemptedTimelineAuthSync = true;
    void campaign.initAuth();
  });

  $effect(() => {
    if (mode !== 'timeline') return;
    if (!campaign.isAuthenticated) {
      attemptedTimelineBranchLoad = false;
      return;
    }
    if (campaign.availableBranches.length > 0) return;
    if (attemptedTimelineBranchLoad) return;
    attemptedTimelineBranchLoad = true;
    void campaign.fetchBranches();
  });

  async function handleTimelineBranchSelect(nextBranch: string) {
    if (!campaign.isAuthenticated) {
      await campaign.initAuth();
      if (!campaign.isAuthenticated) {
        alert('Authentication is still initializing. Please wait a moment and try again.');
        return;
      }
    }
    await campaign.setBranch(nextBranch);
  }

  let isUiAuthenticated = $derived(serverAuthenticated || campaign.isAuthenticated);
  let canDirectPublish = $derived(isAdmin && allowDirectDefaultBranchEdits);

  function announceHeaderOverlayOpen(source: string) {
    if (!browser) return;
    window.dispatchEvent(
      new CustomEvent('header-overlay-open', {
        detail: { source },
      }),
    );
  }

  function defaultMarkdownFolder(): string {
    if (!sourcePath) return 'content/Chapters';
    const parts = sourcePath.split('/');
    parts.pop();
    return parts.join('/') || 'content';
  }

  function resetCreateState() {
    createType = 'md';
    createFolder = defaultMarkdownFolder();
    createTitle = '';
    createFilename = '';
    createContent = '# New Page\n\n';
    createMessage = '';
    createMessageOk = false;
    createMessageErr = false;
    createPrUrl = null;
    createDirty = false;
  }

  function openCreateModal() {
    resetCreateState();
    announceHeaderOverlayOpen('wiki-create-modal');
    createModalOpen = true;
  }

  function closeCreateModal() {
    createModalOpen = false;
  }

  function buildCreatePath(): string {
    if (createType === 'json') {
      const fileName = createFilename.trim() || slugify(createTitle);
      if (!fileName) throw new Error('Provide a chapter JSON file name or title.');
      return `content/Chapters/${fileName}.json`;
    }

    const folder = createFolder.trim().replace(/\/+$/g, '') || 'content';
    const titleSlug = slugify(createTitle);
    if (!titleSlug) throw new Error('Provide a title for the new markdown page.');
    return `${folder}/${titleSlug}.md`;
  }

  async function handleWikiBranchSelect(nextBranch: string) {
    if (createModalOpen && createDirty) {
      const confirmed = confirm('Discard the current create form and switch branch?');
      if (!confirmed) return;
      closeCreateModal();
    }

    const url = new URL(window.location.href);
    if (nextBranch === defaultBranch) {
      url.searchParams.delete('branch');
    } else {
      url.searchParams.set('branch', nextBranch);
    }
    await goto(url.toString(), { invalidateAll: true });
  }

  async function openEditor() {
    if (!sourcePath) return;

    try {
      const shouldUseDirectPublish = canDirectPublish && activeBranch === defaultBranch;
      let editBranch = activeBranch;
      if (!shouldUseDirectPublish) {
        const res = await fetch('/api/drafts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'create', sourcePath }),
        });
        const data = await res.json();
        if (!res.ok && !data.alreadyExists) throw new Error(data.error || 'Failed to create editing branch');
        editBranch = data.branch;
      }
      contentBranch = editBranch;

      if (activeBranch !== editBranch) {
        const nextUrl = new URL(window.location.href);
        if (editBranch === defaultBranch) {
          nextUrl.searchParams.delete('branch');
        } else {
          nextUrl.searchParams.set('branch', editBranch);
        }
        await goto(nextUrl.toString(), { invalidateAll: true });
      }

      const params = new URLSearchParams({ path: sourcePath, branch: editBranch });
      const fileRes = await fetch(`/api/wiki?${params}`);
      if (!fileRes.ok) throw new Error('Failed to load file: ' + fileRes.status);
      const fileData: { content?: string; sha?: string } = await fileRes.json();

      const localDraft = loadDraftFromLocal(sourcePath);
      editContent = localDraft ?? fileData.content ?? '';
      editSha = fileData.sha ?? '';
      editPath = sourcePath!;
      message = localDraft ? 'Restored unsaved draft from your browser.' : '';
      messageOk = !!localDraft;
      messageErr = false;
      prUrl = null;
      wikiSyncStatus = 'draft';
      announceHeaderOverlayOpen('wiki-edit-modal');
      modalOpen = true;
    } catch (err) {
      alert((err as Error).message || 'Failed to open editor');
    }
  }

  const DRAFT_STORAGE_PREFIX = 'frozen-sick-wiki-draft:';

  function saveDraftToLocal() {
    if (!browser || !editPath) return;
    localStorage.setItem(
      `${DRAFT_STORAGE_PREFIX}${editPath}`,
      JSON.stringify({ content: editContent, timestamp: Date.now() }),
    );
  }

  function loadDraftFromLocal(path: string): string | null {
    if (!browser) return null;
    try {
      const raw = localStorage.getItem(`${DRAFT_STORAGE_PREFIX}${path}`);
      if (!raw) return null;
      const draft = JSON.parse(raw) as { content: string; timestamp: number };
      const ageMs = Date.now() - draft.timestamp;
      if (ageMs > 24 * 60 * 60 * 1000) {
        localStorage.removeItem(`${DRAFT_STORAGE_PREFIX}${path}`);
        return null;
      }
      return draft.content;
    } catch {
      return null;
    }
  }

  function clearDraftFromLocal(path: string) {
    if (!browser) return;
    localStorage.removeItem(`${DRAFT_STORAGE_PREFIX}${path}`);
  }

  function closeModal() {
    modalOpen = false;
    clearDraftFromLocal(editPath);
    if (wikiSyncStatus === 'draft') {
      wikiSyncStatus = contentBranch ? 'saved' : 'viewing';
    }
  }

  function handleEditorInput() {
    saveDraftToLocal();
  }

  async function saveEdit() {
    if (!editPath || !editSha || !contentBranch) return;
    message = 'Saving…';
    messageOk = false;
    messageErr = false;

    saveDraftToLocal();

    try {
      const res = await fetch('/api/wiki/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: editPath,
          content: editContent,
          sha: editSha,
          branch: contentBranch,
          message: `Edit: ${editPath.split('/').pop()}`,
        }),
      });
      const data = await res.json();
      if (res.status === 409) {
        message = 'Someone else edited this page. Your draft is preserved locally. Reload the page to get the latest version, then re-open the editor — your changes will be restored.';
        messageErr = true;
        return;
      }
      if (!res.ok) throw new Error(data.error || 'Save failed');
      if (data.sha) editSha = data.sha;

      let prData: { prUrl?: string } = {};
      if (contentBranch.startsWith(CONTENT_BRANCH_PREFIX)) {
        const prRes = await fetch('/api/drafts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'ensure-pr', branch: contentBranch }),
        });
        prData = await prRes.json();
      }

      wikiSyncStatus = contentBranch === defaultBranch ? 'synced' : 'saved';
      message = contentBranch === defaultBranch ? 'Saved directly to Published.' : 'Saved. Pending review.';
      prUrl = prData.prUrl || null;
      messageOk = true;
      messageErr = false;
      clearDraftFromLocal(editPath);
      invalidateAll();
    } catch (err) {
      message = (err as Error).message || 'Save failed';
      messageErr = true;
    }
  }

  async function pullLatest() {
    if (!contentBranch) return;
    pulling = true;
    message = 'Updating from published…';
    messageOk = false;
    messageErr = false;
    try {
      const res = await fetch('/api/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'pull', branch: contentBranch }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update');
      if (data.updated) {
        message = 'Updated with latest published changes.';
        messageOk = true;
        wikiSyncStatus = 'synced';
        invalidateAll();
      } else {
        message = data.reason || 'Could not update.';
        messageErr = true;
      }
    } catch (err) {
      message = (err as Error).message || 'Failed to update';
      messageErr = true;
    } finally {
      pulling = false;
    }
  }

  async function createEntry() {
    createMessage = 'Creating…';
    createMessageOk = false;
    createMessageErr = false;
    createPrUrl = null;

    try {
      const entryPath = buildCreatePath();
      const content =
        createType === 'json'
          ? (createContent.trim() || '{\n  "segments": []\n}\n')
          : (createContent || '# New Page\n\n');

      if (!content.trim()) {
        throw new Error('Content cannot be empty.');
      }

      let entryBranch = defaultBranch;
      if (!(canDirectPublish && activeBranch === defaultBranch)) {
        const createDraftRes = await fetch('/api/drafts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'create', sourcePath: entryPath }),
        });
        const draftData = await createDraftRes.json();
        if (!createDraftRes.ok && !draftData.alreadyExists) {
          throw new Error(draftData.error || 'Failed to create draft branch');
        }
        entryBranch = draftData.branch as string;
      }
      contentBranch = entryBranch;

      const createRes = await fetch('/api/wiki/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: entryPath,
          content,
          branch: entryBranch,
          format: createType,
          message: `Create: ${entryPath.split('/').pop()}`,
        }),
      });
      const createData = await createRes.json();
      if (!createRes.ok) throw new Error(createData.error || 'Failed to create entry');

      let prData: { prUrl?: string } = {};
      if (entryBranch.startsWith(CONTENT_BRANCH_PREFIX)) {
        const prRes = await fetch('/api/drafts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'ensure-pr', branch: entryBranch }),
        });
        prData = await prRes.json();
      }

      createMessage = entryBranch === defaultBranch ? 'Created directly on Published.' : 'Created. Pending review.';
      createMessageOk = true;
      createMessageErr = false;
      createPrUrl = prData.prUrl || null;
      wikiSyncStatus = entryBranch === defaultBranch ? 'synced' : 'saved';
      createDirty = false;
      await invalidateAll();

      if (createType === 'md') {
        const relativePath = entryPath.replace(/^content\//, '');
        const nextSlug = '/' + slugifyPath(relativePath);
        const url = new URL(window.location.origin + nextSlug);
        url.searchParams.set('branch', entryBranch);
        await goto(url.toString(), { invalidateAll: true });
      }
    } catch (err) {
      createMessage = (err as Error).message || 'Create failed';
      createMessageErr = true;
    }
  }

  // Timeline actions
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

  async function handleTimelineUpdate() {
    try {
      await campaign.updateFromPublished();
    } catch (e) {
      alert((e as Error).message);
    }
  }

  async function handleLogout() {
    if (browser) {
      localStorage.removeItem(TOKEN_KEY);
    }
    campaign.logout();
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Logout should still clear client state even if request fails.
    }
    serverAuthenticated = false;
    await invalidateAll();
  }
</script>

<header class="header" class:timeline-mode={mode === 'timeline'} data-testid="app-header">
  <div class="brand">
    <a href="/" class="logo" title="Go to home">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="22" height="22">
        <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
        <path d="M2 17l10 5 10-5"></path>
        <path d="M2 12l10 5 10-5"></path>
      </svg>
      <div class="brand-text">
        <span class="brand-name">Frozen Sick</span>
        <span class="brand-sub">
          {mode === 'wiki' ? 'Campaign Wiki' : mode === 'timeline' ? 'Campaign Timeline' : 'Campaign Map'}
        </span>
      </div>
    </a>
  </div>

  <div class="center">
    {#if mode === 'timeline'}
      <!-- Timeline tabs -->
      <div class="tab-nav" role="tablist" aria-label="Timeline views">
        {#each ['timeline', 'graph', 'settings'] as tab}
          <button
            class="tab"
            class:active={campaign.activeTab === tab}
            onclick={() => campaign.setActiveTab(tab as 'timeline' | 'graph' | 'settings')}
            data-testid="tab-{tab}"
            role="tab"
            aria-selected={campaign.activeTab === tab}
            aria-label={tab === 'timeline' ? 'Timeline' : tab === 'graph' ? 'Relations' : 'Settings'}
          >
            {#if tab === 'timeline'}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                <line x1="2" y1="12" x2="22" y2="12"></line>
                <circle cx="6" cy="12" r="2" fill="currentColor" stroke="none"></circle>
                <circle cx="12" cy="8" r="2" fill="currentColor" stroke="none"></circle>
                <circle cx="18" cy="12" r="2" fill="currentColor" stroke="none"></circle>
              </svg>
              <span class="btn-label">Timeline</span>
            {:else if tab === 'graph'}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                <circle cx="18" cy="5" r="3"></circle>
                <circle cx="6" cy="12" r="3"></circle>
                <circle cx="18" cy="19" r="3"></circle>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
              </svg>
              <span class="btn-label">Relations</span>
            {:else}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.07 4.93l-1.41 1.41M5.34 18.66l-1.41 1.41M20 12h-2M6 12H4M17.66 18.66l-1.41-1.41M7.76 6.34L6.34 4.93M12 20v-2M12 6V4"></path>
              </svg>
              <span class="btn-label">Settings</span>
            {/if}
          </button>
        {/each}
      </div>
    {:else}
      <ModeSwitcher />
    {/if}
  </div>

  <div class="actions">
    {#if mode === 'timeline' && browser}
      <!-- Timeline specific buttons -->
      {#if isUiAuthenticated}
        <span
          class="sync-indicator sync-{timelineSyncView.state}"
          title="Status: {timelineSyncView.label}"
          data-testid="timeline-sync-status"
          data-status={timelineSyncView.state}
        >
          {#if timelineSyncView.busy}
            <svg class="spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12">
              <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
            </svg>
          {:else}
            <span class="sync-dot"></span>
          {/if}
        </span>

        <BranchSelector
          branches={timelineBranches}
          currentBranch={campaign.currentBranch}
          defaultBranch={campaign.defaultBranch}
          labels={campaign.branchLabels}
          onSelect={handleTimelineBranchSelect}
        />

        {#if campaign.isAuthenticated && campaign.behindPublished}
          <button
            class="action-btn action-btn-warning"
            onclick={handleTimelineUpdate}
            disabled={timelineSyncView.busy}
            title="Update from published"
            data-testid="timeline-update"
            aria-label="Update from published"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
              <polyline points="1 4 1 10 7 10"></polyline>
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
            </svg>
            <span class="btn-label">Update</span>
          </button>
        {/if}

        <button
          class="action-btn action-btn-gold"
          onclick={handlePush}
          disabled={!campaign.isAuthenticated || timelineSyncView.busy || campaign.syncStatus === 'synced'}
          title="Save changes to GitHub"
          data-testid="timeline-save"
          aria-label="Save timeline changes"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
            <path d="M17 3H7a4 4 0 0 0-4 4v10a4 4 0 0 0 4 4h10a4 4 0 0 0 4-4V7a4 4 0 0 0-4-4z"></path>
            <path d="M8 3v4h8V3"></path>
            <circle cx="12" cy="14" r="2"></circle>
          </svg>
          <span class="btn-label">Save</span>
        </button>
      {/if}

      <button class="action-btn" onclick={() => campaign.toggleSidebar()} title="Toggle sidebar" data-testid="toggle-sidebar" aria-label="Toggle sidebar">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="9" y1="3" x2="9" y2="21"></line>
        </svg>
      </button>

      <button class="action-btn" onclick={handleImport} title="Import campaign JSON" data-testid="timeline-import" aria-label="Import campaign JSON">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="17 8 12 3 7 8"></polyline>
          <line x1="12" y1="3" x2="12" y2="15"></line>
        </svg>
        <span class="btn-label">Import</span>
      </button>

      <button class="action-btn" onclick={() => campaign.exportData()} title="Export campaign JSON" data-testid="timeline-export" aria-label="Export campaign JSON">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
        <span class="btn-label">Export</span>
      </button>
    {:else if mode === 'wiki' && browser}
      <!-- Wiki sync status -->
      {#if serverAuthenticated && sourcePath && wikiSyncStatus !== 'viewing'}
        <span class="sync-indicator sync-{wikiSyncView.state}" title="Status: {wikiSyncView.label}" data-testid="wiki-sync-status" data-status={wikiSyncView.state}>
          <span class="sync-dot"></span>
        </span>
      {/if}

      <!-- Branch selector (filtered: default + content/ only) -->
      {#if branches.length > 0}
        <BranchSelector
          {branches}
          currentBranch={activeBranch}
          {defaultBranch}
          labels={branchLabels}
          onSelect={handleWikiBranchSelect}
        />
      {/if}

      {#if serverAuthenticated && wikiSyncStatus === 'behind'}
        <button type="button" class="action-btn action-btn-warning" onclick={pullLatest} disabled={pulling} title="Update from published" data-testid="wiki-pull-latest" aria-label="Update from published">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
            <polyline points="1 4 1 10 7 10"></polyline>
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
          </svg>
          <span class="btn-label">{pulling ? 'Updating…' : 'Update'}</span>
        </button>
      {/if}

      {#if serverAuthenticated && sourcePath}
        <button type="button" class="action-btn action-btn-gold" onclick={openEditor} data-testid="wiki-edit" aria-label="Edit page">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
          <span class="btn-label">Edit</span>
        </button>
      {/if}

      {#if serverAuthenticated}
        <button type="button" class="action-btn" onclick={openCreateModal} data-testid="wiki-create" aria-label="Create entry">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          <span class="btn-label">Create</span>
        </button>
      {/if}

      {#if serverAuthenticated}
        <DraftsPanel {branchLabels} />
      {/if}

      <ApprovalsPanel visible={canApprove} />
    {:else if mode === 'map'}
      {#if branches.length > 0}
        <BranchSelector
          {branches}
          currentBranch={activeBranch}
          {defaultBranch}
          labels={branchLabels}
        />
      {/if}
    {/if}

    <!-- Auth section - shows in both wiki and timeline modes -->
    {#if browser && !isUiAuthenticated}
      <a class="login-link" href="/api/auth/login?return_to={encodeURIComponent(returnTo)}" data-sveltekit-reload data-testid="auth-login">
        <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
          <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path>
        </svg>
        <span class="btn-label">Login to Edit</span>
      </a>
    {:else if browser && isUiAuthenticated}
      <!-- User avatar/logout -->
      <button class="avatar-btn" onclick={handleLogout} title="Logout" data-testid="auth-logout" aria-label="Logout">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
          <polyline points="16 17 21 12 16 7"></polyline>
          <line x1="21" y1="12" x2="9" y2="12"></line>
        </svg>
      </button>
    {/if}
  </div>
</header>

<!-- Wiki Edit Modal -->
{#if modalOpen}
  <div class="wiki-edit-overlay" onclick={(e: MouseEvent) => e.target === e.currentTarget && closeModal()} role="presentation" data-testid="wiki-edit-overlay">
    <div class="wiki-edit-modal" role="dialog" aria-modal="true" aria-label="Edit {editPath.split('/').pop()}" data-testid="wiki-edit-modal">
      <div class="wiki-edit-modal-header">
        <div class="wiki-edit-modal-title">Edit: {editPath.split('/').pop()}</div>
        {#if wikiSyncStatus === 'draft'}
          <span class="wiki-edit-draft-badge">Unsaved</span>
        {:else if wikiSyncStatus === 'saved'}
          <span class="wiki-edit-saved-badge">Saved</span>
        {/if}
      </div>
      <textarea class="wiki-edit-textarea" bind:value={editContent} oninput={handleEditorInput} rows="20" data-testid="wiki-edit-textarea" aria-label="Page content"></textarea>
      <div class="wiki-edit-actions">
        <button type="button" class="wiki-edit-cancel" onclick={closeModal} data-testid="wiki-cancel">Cancel</button>
        <button type="button" class="wiki-edit-save" onclick={saveEdit} data-testid="wiki-save">Save</button>
      </div>
      {#if message}
        <div
          class="wiki-edit-msg"
          class:wiki-edit-msg-ok={messageOk}
          class:wiki-edit-msg-err={messageErr}
          data-testid="wiki-status-message"
          data-status={messageOk ? 'success' : messageErr ? 'error' : 'idle'}
          role="status"
          aria-live="polite"
        >
          {message}
          {#if prUrl}
            — <a href={prUrl} target="_blank" rel="noopener noreferrer">View PR</a>
          {/if}
        </div>
      {/if}
    </div>
  </div>
{/if}

{#if createModalOpen}
  <div class="wiki-edit-overlay" onclick={(e: MouseEvent) => e.target === e.currentTarget && closeCreateModal()} role="presentation" data-testid="wiki-create-overlay">
    <div class="wiki-edit-modal" role="dialog" aria-modal="true" aria-label="Create new entry" data-testid="wiki-create-modal">
      <div class="wiki-edit-modal-header">
        <div class="wiki-edit-modal-title">Create New Entry</div>
      </div>
      <div class="wiki-create-grid">
        <label for="create-type">Entry type</label>
        <select
          id="create-type"
          bind:value={createType}
          onchange={() => {
            createDirty = true;
            if (createType === 'json') {
              createFolder = 'content/Chapters';
              createContent = '{\n  "segments": []\n}\n';
            } else {
              createContent = '# New Page\n\n';
            }
          }}
          data-testid="wiki-create-type"
        >
          <option value="md">Markdown Page</option>
          <option value="json">Chapter JSON</option>
        </select>

        {#if createType === 'md'}
          <label for="create-folder">Folder path</label>
          <input
            id="create-folder"
            bind:value={createFolder}
            oninput={() => (createDirty = true)}
            placeholder="content/Chapters/Chapter 6 - Example"
            data-testid="wiki-create-folder"
          />

          <label for="create-title">Title</label>
          <input
            id="create-title"
            bind:value={createTitle}
            oninput={() => (createDirty = true)}
            placeholder="My New Session"
            data-testid="wiki-create-title"
          />
        {:else}
          <label for="create-filename">File name</label>
          <input
            id="create-filename"
            bind:value={createFilename}
            oninput={() => (createDirty = true)}
            placeholder="chapter-6-session"
            data-testid="wiki-create-filename"
          />

          <label for="create-title">Optional title seed</label>
          <input
            id="create-title"
            bind:value={createTitle}
            oninput={() => (createDirty = true)}
            placeholder="Used if file name is empty"
            data-testid="wiki-create-title"
          />
        {/if}

        <label for="create-content">Initial content</label>
        <textarea
          id="create-content"
          class="wiki-edit-textarea"
          bind:value={createContent}
          oninput={() => (createDirty = true)}
          rows="12"
          data-testid="wiki-create-content"
        ></textarea>
      </div>

      <div class="wiki-edit-actions">
        <button type="button" class="wiki-edit-cancel" onclick={closeCreateModal} data-testid="wiki-create-cancel">Cancel</button>
        <button type="button" class="wiki-edit-save" onclick={createEntry} data-testid="wiki-create-save">Create</button>
      </div>
      {#if createMessage}
        <div
          class="wiki-edit-msg"
          class:wiki-edit-msg-ok={createMessageOk}
          class:wiki-edit-msg-err={createMessageErr}
          data-testid="wiki-create-status-message"
          data-status={createMessageOk ? 'success' : createMessageErr ? 'error' : 'idle'}
          role="status"
          aria-live="polite"
        >
          {createMessage}
          {#if createPrUrl}
            — <a href={createPrUrl} target="_blank" rel="noopener noreferrer">View PR</a>
          {/if}
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 0 16px;
    height: 56px;
    background: var(--surface);
    border-bottom: 1px solid var(--border-bright);
    flex-shrink: 0;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.4);
    position: sticky;
    top: 0;
    z-index: 500;
  }

  .brand {
    flex-shrink: 0;
  }

  .logo {
    display: flex;
    align-items: center;
    gap: 10px;
    color: var(--text);
    text-decoration: none;
    transition: color 0.15s;
  }

  .logo:hover {
    color: var(--gold);
  }

  .logo svg {
    color: var(--gold);
    flex-shrink: 0;
  }

  .brand-text {
    display: flex;
    flex-direction: column;
    line-height: 1.2;
  }

  .brand-name {
    font-family: 'Cinzel', serif;
    font-size: 16px;
    font-weight: 600;
    letter-spacing: 0.02em;
  }

  .brand-sub {
    font-size: 11px;
    color: var(--text-dim);
    font-family: 'Crimson Text', serif;
    font-style: italic;
  }

  .center {
    flex: 1;
    display: flex;
    justify-content: center;
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

  .actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 1;
    flex-wrap: nowrap;
    justify-content: flex-end;
    min-width: 0;
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
  }

  .sync-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    display: inline-block;
  }

  .sync-idle .sync-dot { background: var(--text-dim); }
  .sync-viewing .sync-dot { background: var(--text-dim); }
  .sync-draft .sync-dot { background: #d4af37; }
  .sync-saved .sync-dot { background: #4a9a9a; }
  .sync-synced .sync-dot { background: #4a9a4a; }
  .sync-behind .sync-dot { background: #cc8844; }
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

  .login-link {
    display: flex;
    align-items: center;
    gap: 5px;
    background: none;
    border: 1px solid var(--border-bright);
    color: var(--text-muted);
    border-radius: 4px;
    padding: 5px 10px;
    font-size: 12px;
    font-family: 'Cinzel', serif;
    letter-spacing: 0.03em;
    text-decoration: none;
    cursor: pointer;
    transition: all 0.15s;
  }

  .login-link:hover {
    border-color: var(--gold-dim);
    color: var(--text);
  }

  .avatar-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: 2px solid var(--border);
    border-radius: 50%;
    padding: 0;
    width: 32px;
    height: 32px;
    cursor: pointer;
    transition: border-color 0.15s;
    line-height: 0;
    color: var(--text-muted);
  }

  .avatar-btn:hover {
    border-color: var(--gold-dim);
    color: var(--text);
  }

  .avatar {
    border-radius: 50%;
    display: block;
  }

  .action-btn-warning {
    border-color: #cc8844;
    color: #cc8844;
  }

  .action-btn-warning:hover {
    background: rgba(204, 136, 68, 0.15);
    color: #e8a050;
    border-color: #e8a050;
  }

  /* Wiki Edit Modal */
  .wiki-edit-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
  }

  .wiki-edit-modal {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 1.25rem;
    max-width: 720px;
    width: 100%;
    max-height: 90vh;
    overflow: auto;
  }

  .wiki-edit-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.75rem;
    gap: 8px;
  }

  .wiki-edit-modal-title {
    font-weight: 600;
    color: var(--text);
  }


  .wiki-edit-textarea {
    display: block;
    width: 100%;
    min-height: 320px;
    padding: 0.5rem;
    margin-bottom: 1rem;
    background: var(--surface-2);
    border: 1px solid var(--border);
    color: var(--text);
    font-family: inherit;
    font-size: 0.9rem;
    resize: vertical;
  }

  .wiki-create-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.45rem;
    margin-bottom: 0.75rem;
  }

  .wiki-create-grid label {
    font-size: 0.82rem;
    color: var(--text-muted);
  }

  .wiki-create-grid input,
  .wiki-create-grid select {
    display: block;
    width: 100%;
    padding: 0.45rem 0.55rem;
    background: var(--surface-2);
    border: 1px solid var(--border);
    color: var(--text);
    border-radius: 4px;
    font-size: 0.88rem;
  }

  .wiki-edit-actions {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .wiki-edit-cancel,
  .wiki-edit-save {
    padding: 0.4rem 0.75rem;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.9rem;
  }

  .wiki-edit-cancel {
    background: var(--surface-2);
    border: 1px solid var(--border);
    color: var(--text);
  }

  .wiki-edit-save {
    background: var(--accent);
    border: 1px solid var(--accent);
    color: #fff;
  }

  .wiki-edit-draft-badge {
    font-size: 10px;
    padding: 2px 8px;
    border-radius: 3px;
    background: rgba(212, 175, 55, 0.2);
    color: #d4af37;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-family: 'Cinzel', serif;
  }

  .wiki-edit-saved-badge {
    font-size: 10px;
    padding: 2px 8px;
    border-radius: 3px;
    background: rgba(74, 154, 154, 0.2);
    color: #4a9a9a;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-family: 'Cinzel', serif;
  }

  .wiki-edit-msg {
    font-size: 0.85rem;
    color: var(--text-muted);
  }

  .wiki-edit-msg-ok {
    color: var(--discovery);
  }

  .wiki-edit-msg-err {
    color: var(--battle);
  }

  .wiki-edit-msg a {
    color: var(--link, #6ab0f3);
    text-decoration: underline;
  }

  @media (max-width: 760px) {
    .header {
      display: flex;
      flex-wrap: wrap;
      height: auto;
      padding: 6px 8px;
      gap: 6px;
      align-items: center;
    }

    .brand-text {
      display: none;
    }

    .brand {
      order: 1;
    }

    .actions {
      order: 2;
      margin-left: auto;
      gap: 4px;
      position: relative;
      z-index: 2;
    }

    .action-btn {
      padding: 5px 6px;
      font-size: 11px;
    }

    .btn-label {
      display: none;
    }

    .tab {
      padding: 4px 8px;
      font-size: 11px;
    }

    .center {
      order: 3;
      flex: 1 0 100%;
      justify-content: flex-start;
      min-width: 0;
      overflow-x: auto;
      width: 100%;
      padding-bottom: 2px;
      position: relative;
      z-index: 3;
    }

    .login-link {
      font-size: 11px;
      padding: 4px 8px;
    }

  }
</style>
