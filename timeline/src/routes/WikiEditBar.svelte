<script lang="ts">
  import { onMount } from 'svelte';
  import { env } from '$env/dynamic/public';

  const TOKEN_KEY = 'frozen-sick-gh-token';

  let { sourcePath = null, returnTo = '/' }: { sourcePath: string | null; returnTo?: string } = $props();

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

  function getToken(): string | null {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(TOKEN_KEY);
  }

  function setToken(t: string) {
    localStorage.setItem(TOKEN_KEY, t);
    token = t;
  }

  function handleHashToken() {
    const hash = window.location.hash;
    if (hash.indexOf('#token=') !== 0) return false;
    const t = hash.slice(7);
    if (t) {
      setToken(t);
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
      return true;
    }
    return false;
  }

  onMount(() => {
    if (handleHashToken()) return;
    token = getToken();
  });

  function openEditor() {
    if (!sourcePath || !token) return;
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(sourcePath)}?ref=${encodeURIComponent(branch)}`;
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
        editPath = sourcePath!;
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
</script>

<div class="wiki-edit-bar">
  {#if sourcePath}
    {#if token}
      <button type="button" class="wiki-edit-btn" onclick={openEditor}>Edit</button>
    {:else}
      <a class="wiki-edit-login" href="/api/auth/login?return_to={encodeURIComponent(returnTo)}">Login with GitHub to edit</a>
    {/if}
  {/if}
</div>

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
  .wiki-edit-bar {
    margin-top: 0.5rem;
    min-height: 1.5rem;
  }
  .wiki-edit-login {
    font-size: 0.75rem;
    color: var(--link);
    text-decoration: none;
  }
  .wiki-edit-login:hover {
    text-decoration: underline;
  }
  .wiki-edit-btn {
    font-size: 0.75rem;
    padding: 0.2rem 0.5rem;
    background: var(--surface-2);
    border: 1px solid var(--border);
    color: var(--text);
    border-radius: 4px;
    cursor: pointer;
  }
  .wiki-edit-btn:hover {
    background: var(--surface-3);
  }
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
