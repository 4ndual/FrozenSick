<script lang="ts">
  import ModeSwitcher from './ModeSwitcher.svelte';
  import { campaign } from '$lib/store/campaign.svelte';
  import { exportCampaign, importCampaign } from '$lib/utils/storage';
  import { browser } from '$app/environment';
  import { env } from '$env/dynamic/public';
  import { onMount } from 'svelte';

  interface Props {
    mode: 'wiki' | 'timeline';
    sourcePath?: string | null;
    returnTo?: string;
  }

  let { mode, sourcePath = null, returnTo = '/' }: Props = $props();

  // Wiki edit state
  const TOKEN_KEY = 'frozen-sick-gh-token';
  const owner = env.PUBLIC_GITHUB_OWNER as string;
  const repo = env.PUBLIC_GITHUB_REPO as string;
  const branch = (env.PUBLIC_GITHUB_BRANCH as string) || 'main';

  let token = $state<string | null>(null);
  let modalOpen = $state(false);
  let editContent = $state('');
  let editSha = $state('');
  let editPath = $state('');
  let message = $state('');
  let messageOk = $state(false);
  let messageErr = $state(false);

  function getStoredToken(): string | null {
    if (!browser) return null;
    return localStorage.getItem(TOKEN_KEY);
  }

  function setStoredToken(t: string) {
    if (!browser) return;
    localStorage.setItem(TOKEN_KEY, t);
    token = t;
  }

  function handleHashToken() {
    if (!browser) return false;
    const hash = window.location.hash;
    if (hash.indexOf('#token=') !== 0) return false;
    const t = hash.slice(7);
    if (t) {
      setStoredToken(t);
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
      return true;
    }
    return false;
  }

  onMount(() => {
    if (handleHashToken()) return;
    token = getStoredToken();
  });

  function openEditor() {
    if (!sourcePath || !token) return;
    // Strip content/ prefix for GitHub API - content is a local folder, not part of repo structure
    const githubPath = sourcePath.replace(/^content\//, '');
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(githubPath)}?ref=${encodeURIComponent(branch)}`;
    fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
      },
    })
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load file: ' + r.status);
        return r.json();
      })
      .then((data: { content?: string; sha?: string }) => {
        const content = data.content ? atob(data.content.replace(/\n/g, '')) : '';
        editContent = content;
        editSha = data.sha ?? '';
        // Store the GitHub path (without content/ prefix) for saving
        editPath = sourcePath!.replace(/^content\//, '');
        message = '';
        messageOk = false;
        messageErr = false;
        modalOpen = true;
      })
      .catch((err: Error) => {
        alert(err.message || 'Failed to load file');
      });
  }

  function closeModal() {
    modalOpen = false;
  }

  function saveEdit() {
    if (!token || !editPath || !editSha) return;
    message = 'Saving…';
    messageOk = false;
    messageErr = false;
    const putUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(editPath)}`;
    fetch(putUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'Edit: ' + editPath,
        content: btoa(unescape(encodeURIComponent(editContent))),
        sha: editSha,
        branch,
      }),
    })
      .then((r) => {
        if (r.status === 409) throw new Error('File was changed on GitHub. Reload and try again.');
        if (!r.ok) return r.json().then((d: { message?: string }) => { throw new Error(d.message || 'Save failed'); });
        return r.json();
      })
      .then(() => {
        message = 'Saved. Changes will appear after the next deploy.';
        messageOk = true;
        messageErr = false;
        setTimeout(closeModal, 2000);
      })
      .catch((err: Error) => {
        message = err.message || 'Save failed';
        messageErr = true;
      });
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
</script>

<header class="header">
  <div class="brand">
    <a href="/" class="logo" title="Go to home">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="22" height="22">
        <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
        <path d="M2 17l10 5 10-5"></path>
        <path d="M2 12l10 5 10-5"></path>
      </svg>
      <div class="brand-text">
        <span class="brand-name">Frozen Sick</span>
        <span class="brand-sub">{mode === 'wiki' ? 'Campaign Wiki' : 'Campaign Timeline'}</span>
      </div>
    </a>
  </div>

  <div class="center">
    {#if mode === 'timeline'}
      <!-- Timeline tabs -->
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
    {:else}
      <ModeSwitcher />
    {/if}
  </div>

  <div class="actions">
    {#if mode === 'timeline' && browser}
      <!-- Timeline specific buttons -->
      {#if campaign.isAuthenticated}
        <span class="sync-indicator sync-{campaign.syncStatus}" title="Sync status: {campaign.syncStatus}">
          {#if campaign.syncStatus === 'saving' || campaign.syncStatus === 'loading'}
            <svg class="spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12">
              <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
            </svg>
          {:else}
            <span class="sync-dot"></span>
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
    {:else if mode === 'wiki' && browser}
      <!-- Wiki specific buttons -->
      {#if token}
        <button type="button" class="action-btn action-btn-gold" onclick={openEditor}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
          Edit
        </button>
      {/if}
    {/if}

    <!-- Auth section - shows in both wiki and timeline modes -->
    {#if browser && !token}
      <a class="login-link" href="/api/auth/login?return_to={encodeURIComponent(returnTo)}" data-sveltekit-reload>
        <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
          <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path>
        </svg>
        Login to Edit
      </a>
    {:else if browser && token}
      <!-- User avatar/logout -->
      <button class="avatar-btn" onclick={() => { token = null; localStorage.removeItem(TOKEN_KEY); }} title="Logout">
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
  <div class="wiki-edit-overlay" onclick={(e: MouseEvent) => e.target === e.currentTarget && closeModal()} role="presentation">
    <div class="wiki-edit-modal">
      <div class="wiki-edit-modal-title">Edit: {editPath}</div>
      <textarea class="wiki-edit-textarea" bind:value={editContent} rows="20"></textarea>
      <div class="wiki-edit-actions">
        <button type="button" class="wiki-edit-cancel" onclick={closeModal}>Cancel</button>
        <button type="button" class="wiki-edit-save" onclick={saveEdit}>Save</button>
      </div>
      {#if message}
        <div class="wiki-edit-msg" class:wiki-edit-msg-ok={messageOk} class:wiki-edit-msg-err={messageErr}>{message}</div>
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
    position: relative;
    z-index: 100;
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
    flex-shrink: 0;
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

  .wiki-edit-modal-title {
    font-weight: 600;
    margin-bottom: 0.75rem;
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
</style>
