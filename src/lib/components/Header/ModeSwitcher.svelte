<script lang="ts">
  import { page } from '$app/stores';

  let currentPath = $derived($page.url.pathname);
  let mode = $derived(currentPath.startsWith('/timeline') ? 'timeline' : 'wiki');
</script>

<div class="mode-switcher">
  <a
    href="/"
    class="mode-btn"
    class:active={mode === 'wiki'}
    aria-current={mode === 'wiki' ? 'page' : undefined}
  >
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
    </svg>
    Wiki
  </a>
  <a
    href="/timeline/"
    class="mode-btn"
    class:active={mode === 'timeline'}
    aria-current={mode === 'timeline' ? 'page' : undefined}
  >
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
      <line x1="2" y1="12" x2="22" y2="12"></line>
      <circle cx="6" cy="12" r="2" fill="currentColor" stroke="none"></circle>
      <circle cx="12" cy="8" r="2" fill="currentColor" stroke="none"></circle>
      <circle cx="18" cy="12" r="2" fill="currentColor" stroke="none"></circle>
    </svg>
    Timeline
  </a>
</div>

<style>
  .mode-switcher {
    display: flex;
    align-items: center;
    gap: 2px;
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 3px;
  }

  .mode-btn {
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
    text-decoration: none;
    transition: all 0.15s;
    cursor: pointer;
  }

  .mode-btn:hover {
    color: var(--text);
    background: var(--surface-3);
  }

  .mode-btn.active {
    background: var(--surface-3);
    color: var(--gold);
    box-shadow: 0 0 0 1px var(--border-bright);
  }
</style>
