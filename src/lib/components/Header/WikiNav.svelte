<script lang="ts">
  import { goto, invalidateAll } from '$app/navigation';
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { isSection, type NavEntry, type NavItem, type NavSection } from '$lib/wiki-nav';

  interface Props {
    nav: NavEntry[];
    branch?: string | null;
    defaultBranch?: string;
    authenticated?: boolean;
  }

  type NavAction = 'hide' | 'delete';
  type StatusState = 'idle' | 'working' | 'success' | 'error';

  let { nav, branch = null, defaultBranch = 'main', authenticated = false }: Props = $props();

  let currentPath = $derived($page.url.pathname);
  let sidebarOpen = $state(false);
  let sectionOpen = $state<Record<string, boolean>>({});
  let folderOpen = $state<Record<string, boolean>>({});
  let activeMenuKey = $state<string | null>(null);
  let statusMessage = $state('');
  let statusState = $state<StatusState>('idle');
  let statusPrUrl = $state<string | null>(null);
  let actionBusy = $state(false);
  let confirmDelete = $state<{ open: boolean; item: NavItem | null }>({ open: false, item: null });

  const MOBILE_BREAKPOINT = 768;
  const sectionStorageKey = 'wiki-nav-sections-open-v1';
  const folderStorageKey = 'wiki-nav-folders-open-v1';

  function sanitizeForId(value: string): string {
    return value.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'item';
  }

  function branchHref(href: string): string {
    if (!branch || branch === defaultBranch) return href;
    const sep = href.includes('?') ? '&' : '?';
    return `${href}${sep}branch=${encodeURIComponent(branch)}`;
  }

  function linkTestId(href: string): string {
    const normalized = href === '/' ? 'home' : href.replace(/^\//, '').replace(/[^a-zA-Z0-9]+/g, '-');
    return `wiki-nav-link-${normalized}`;
  }

  function rowKey(item: NavItem): string {
    return item.sourcePath || item.href;
  }

  function sectionKey(section: NavSection): string {
    return section.sourcePath || `section:${section.section}`;
  }

  function folderKey(item: NavItem): string {
    return item.sourcePath || `folder:${item.href}`;
  }

  function actionMenuKey(item: NavItem): string {
    return sanitizeForId(`${item.kind || 'special'}-${item.sourcePath || item.href}`);
  }

  function closeSidebarOnMobile() {
    if (typeof window !== 'undefined' && window.innerWidth <= MOBILE_BREAKPOINT) {
      sidebarOpen = false;
    }
  }

  function announceOverlayOpen(source: string) {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(
      new CustomEvent('header-overlay-open', {
        detail: { source },
      }),
    );
  }

  function toggleSection(section: NavSection) {
    const key = sectionKey(section);
    sectionOpen = { ...sectionOpen, [key]: !sectionOpen[key] };
    persistOpenStates();
  }

  function toggleFolder(item: NavItem) {
    const key = folderKey(item);
    folderOpen = { ...folderOpen, [key]: !folderOpen[key] };
    persistOpenStates();
  }

  function persistOpenStates() {
    if (typeof window === 'undefined') return;
    localStorage.setItem(sectionStorageKey, JSON.stringify(sectionOpen));
    localStorage.setItem(folderStorageKey, JSON.stringify(folderOpen));
  }

  function initializeOpenStates() {
    const nextSectionOpen: Record<string, boolean> = {};
    const nextFolderOpen: Record<string, boolean> = {};
    for (const entry of nav) {
      if (!isSection(entry)) continue;
      const sec = entry as NavSection;
      nextSectionOpen[sectionKey(sec)] = true;
      for (const child of sec.children) {
        if (child.sub && child.sub.length > 0) {
          nextFolderOpen[folderKey(child)] = true;
        }
      }
    }

    if (typeof window !== 'undefined') {
      try {
        const savedSections = JSON.parse(localStorage.getItem(sectionStorageKey) || '{}') as Record<
          string,
          boolean
        >;
        const savedFolders = JSON.parse(localStorage.getItem(folderStorageKey) || '{}') as Record<
          string,
          boolean
        >;
        for (const key of Object.keys(nextSectionOpen)) {
          if (typeof savedSections[key] === 'boolean') nextSectionOpen[key] = savedSections[key];
        }
        for (const key of Object.keys(nextFolderOpen)) {
          if (typeof savedFolders[key] === 'boolean') nextFolderOpen[key] = savedFolders[key];
        }
      } catch {
        // Ignore local state parse failures.
      }
    }

    sectionOpen = nextSectionOpen;
    folderOpen = nextFolderOpen;
  }

  function canMutate(item: NavItem): boolean {
    return (
      authenticated &&
      !!item.sourcePath &&
      (item.kind === 'file' || item.kind === 'folder') &&
      !item.external
    );
  }

  function openActions(item: NavItem) {
    const key = actionMenuKey(item);
    const next = activeMenuKey === key ? null : key;
    activeMenuKey = next;
    if (next) announceOverlayOpen('wiki-nav-actions');
  }

  async function runAction(action: NavAction, item: NavItem) {
    if (!canMutate(item) || actionBusy) return;
    actionBusy = true;
    statusPrUrl = null;
    statusState = 'working';
    statusMessage = action === 'hide' ? 'Hiding navigation entry...' : 'Deleting entry...';

    const payload: Record<string, unknown> = {
      action,
      targetKind: item.kind,
      targetPath: item.sourcePath,
      ensurePr: true,
    };
    if (branch && branch.startsWith('content/')) {
      payload.branch = branch;
    }

    try {
      const res = await fetch('/api/wiki/nav', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
        prUrl?: string | null;
        branch?: string;
      };

      if (!res.ok || !data.ok) {
        statusState = 'error';
        statusMessage = data.message || 'Navigation action failed.';
        return;
      }

      statusState = 'success';
      statusMessage = data.message || 'Navigation updated.';
      statusPrUrl = data.prUrl || null;
      activeMenuKey = null;
      const mutationBranch = data.branch;
      if (
        mutationBranch &&
        (!branch || branch === defaultBranch) &&
        mutationBranch !== defaultBranch
      ) {
        const nextUrl = new URL($page.url);
        nextUrl.searchParams.set('branch', mutationBranch);
        await goto(nextUrl.toString(), { invalidateAll: true });
      } else {
        await invalidateAll();
      }
    } catch {
      statusState = 'error';
      statusMessage = 'Navigation action failed due to a network error.';
    } finally {
      actionBusy = false;
    }
  }

  function requestDelete(item: NavItem) {
    confirmDelete = { open: true, item };
    announceOverlayOpen('wiki-nav-delete-confirm');
  }

  function closeDeleteDialog() {
    confirmDelete = { open: false, item: null };
  }

  onMount(() => {
    initializeOpenStates();
    const onOverlayOpen = (event: Event) => {
      const source = (event as CustomEvent<{ source?: string }>).detail?.source;
      if (source && source !== 'wiki-nav-actions' && source !== 'wiki-nav-delete-confirm') {
        activeMenuKey = null;
      }
    };
    window.addEventListener('header-overlay-open', onOverlayOpen as EventListener);
    return () => window.removeEventListener('header-overlay-open', onOverlayOpen as EventListener);
  });
</script>

<button
  type="button"
  class="sidebar-toggle"
  aria-label="Toggle sidebar"
  aria-expanded={sidebarOpen}
  data-testid="wiki-sidebar-toggle"
  onclick={() => (sidebarOpen = !sidebarOpen)}
>
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
    <line x1="3" y1="12" x2="21" y2="12"></line>
    <line x1="3" y1="6" x2="21" y2="6"></line>
    <line x1="3" y1="18" x2="21" y2="18"></line>
  </svg>
</button>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<nav
  id="wiki-sidebar"
  class="wiki-sidebar"
  class:open={sidebarOpen}
  aria-label="Wiki navigation"
  data-testid="wiki-sidebar"
>
  <div class="sidebar-header">
    <a href="/">Frozen Sick</a>
    <span class="sidebar-sub">Campaign Wiki</span>
  </div>

  <div
    class="menu-status"
    data-testid="wiki-nav-status-message"
    data-status={statusState}
    role="status"
    aria-live="polite"
  >
    {#if statusMessage}
      <span>{statusMessage}</span>
      {#if statusPrUrl}
        <a href={statusPrUrl} target="_blank" rel="noopener noreferrer" data-testid="wiki-nav-status-pr-link">
          Open PR
        </a>
      {/if}
    {/if}
  </div>

  <ul class="nav-list">
    {#each nav as entry (isSection(entry) ? sectionKey(entry as NavSection) : (entry as NavItem).href)}
      {#if isSection(entry)}
        {@const section = entry as NavSection}
        <li class="nav-section">
          <button
            type="button"
            class="section-toggle"
            aria-expanded={sectionOpen[sectionKey(section)]}
            aria-label="Toggle {section.section} section"
            data-testid="wiki-nav-section-toggle-{sanitizeForId(section.section)}"
            onclick={() => toggleSection(section)}
          >
            <span class="section-title">{section.section}</span>
            <svg class="chevron" class:flipped={sectionOpen[sectionKey(section)]} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </button>

          {#if sectionOpen[sectionKey(section)]}
            <ul class="section-children">
              {#each section.children as child (rowKey(child))}
                <li class="nav-item">
                  <div class="nav-row">
                    <a
                      href={branchHref(child.href)}
                      class:active={currentPath === child.href}
                      class="nav-link"
                      data-testid={linkTestId(child.href)}
                      aria-label={child.title}
                      onclick={closeSidebarOnMobile}
                    >
                      {child.title}
                    </a>

                    <div class="nav-actions">
                      {#if child.sub && child.sub.length > 0}
                        <button
                          type="button"
                          class="row-icon-btn"
                          aria-label="Toggle {child.title} subitems"
                          aria-expanded={folderOpen[folderKey(child)]}
                          data-testid="wiki-nav-folder-toggle-{sanitizeForId(folderKey(child))}"
                          onclick={() => toggleFolder(child)}
                        >
                          <svg class="chevron" class:flipped={folderOpen[folderKey(child)]} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12">
                            <polyline points="6 9 12 15 18 9"></polyline>
                          </svg>
                        </button>
                      {/if}

                      {#if canMutate(child)}
                        <button
                          type="button"
                          class="row-icon-btn"
                          aria-haspopup="listbox"
                          aria-expanded={activeMenuKey === actionMenuKey(child)}
                          aria-label="Actions for {child.title}"
                          data-testid="wiki-nav-action-toggle-{actionMenuKey(child)}"
                          onclick={() => openActions(child)}
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13">
                            <circle cx="12" cy="5" r="1"></circle>
                            <circle cx="12" cy="12" r="1"></circle>
                            <circle cx="12" cy="19" r="1"></circle>
                          </svg>
                        </button>

                        {#if activeMenuKey === actionMenuKey(child)}
                          <div
                            class="row-menu"
                            role="listbox"
                            aria-label="Actions for {child.title}"
                            data-testid="wiki-nav-action-menu-{actionMenuKey(child)}"
                          >
                            <button
                              type="button"
                              role="option"
                              aria-selected="false"
                              class="row-menu-item"
                              aria-label="Hide {child.title}"
                              data-testid="wiki-nav-action-hide-{actionMenuKey(child)}"
                              onclick={() => runAction('hide', child)}
                              disabled={actionBusy}
                            >
                              Hide
                            </button>
                            <button
                              type="button"
                              role="option"
                              aria-selected="false"
                              class="row-menu-item row-menu-item-danger"
                              aria-label="Delete {child.title}"
                              data-testid="wiki-nav-action-delete-{actionMenuKey(child)}"
                              onclick={() => requestDelete(child)}
                              disabled={actionBusy}
                            >
                              Delete
                            </button>
                          </div>
                        {/if}
                      {/if}
                    </div>
                  </div>

                  {#if child.sub && child.sub.length > 0 && folderOpen[folderKey(child)]}
                    <ul class="sub-list">
                      {#each child.sub as subItem (rowKey(subItem))}
                        <li>
                          <div class="nav-row">
                            <a
                              href={branchHref(subItem.href)}
                              class:active={currentPath === subItem.href}
                              class="nav-link sub-link"
                              data-testid={linkTestId(subItem.href)}
                              aria-label={subItem.title}
                              onclick={closeSidebarOnMobile}
                            >
                              {subItem.title}
                            </a>
                            {#if canMutate(subItem)}
                              <div class="nav-actions">
                                <button
                                  type="button"
                                  class="row-icon-btn"
                                  aria-haspopup="listbox"
                                  aria-expanded={activeMenuKey === actionMenuKey(subItem)}
                                  aria-label="Actions for {subItem.title}"
                                  data-testid="wiki-nav-action-toggle-{actionMenuKey(subItem)}"
                                  onclick={() => openActions(subItem)}
                                >
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13">
                                    <circle cx="12" cy="5" r="1"></circle>
                                    <circle cx="12" cy="12" r="1"></circle>
                                    <circle cx="12" cy="19" r="1"></circle>
                                  </svg>
                                </button>
                                {#if activeMenuKey === actionMenuKey(subItem)}
                                  <div
                                    class="row-menu"
                                    role="listbox"
                                    aria-label="Actions for {subItem.title}"
                                    data-testid="wiki-nav-action-menu-{actionMenuKey(subItem)}"
                                  >
                                    <button
                                      type="button"
                                      role="option"
                                      aria-selected="false"
                                      class="row-menu-item"
                                      aria-label="Hide {subItem.title}"
                                      data-testid="wiki-nav-action-hide-{actionMenuKey(subItem)}"
                                      onclick={() => runAction('hide', subItem)}
                                      disabled={actionBusy}
                                    >
                                      Hide
                                    </button>
                                    <button
                                      type="button"
                                      role="option"
                                      aria-selected="false"
                                      class="row-menu-item row-menu-item-danger"
                                      aria-label="Delete {subItem.title}"
                                      data-testid="wiki-nav-action-delete-{actionMenuKey(subItem)}"
                                      onclick={() => requestDelete(subItem)}
                                      disabled={actionBusy}
                                    >
                                      Delete
                                    </button>
                                  </div>
                                {/if}
                              </div>
                            {/if}
                          </div>
                        </li>
                      {/each}
                    </ul>
                  {/if}
                </li>
              {/each}
            </ul>
          {/if}
        </li>
      {:else}
        {@const item = entry as NavItem}
        <li class="nav-item">
          <div class="nav-row">
            <a
              href={branchHref(item.href)}
              class:active={currentPath === item.href}
              class="nav-link"
              data-testid={linkTestId(item.href)}
              aria-label={item.title}
              onclick={closeSidebarOnMobile}
            >
              {item.title}
            </a>

            {#if canMutate(item)}
              <div class="nav-actions">
                <button
                  type="button"
                  class="row-icon-btn"
                  aria-haspopup="listbox"
                  aria-expanded={activeMenuKey === actionMenuKey(item)}
                  aria-label="Actions for {item.title}"
                  data-testid="wiki-nav-action-toggle-{actionMenuKey(item)}"
                  onclick={() => openActions(item)}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13">
                    <circle cx="12" cy="5" r="1"></circle>
                    <circle cx="12" cy="12" r="1"></circle>
                    <circle cx="12" cy="19" r="1"></circle>
                  </svg>
                </button>

                {#if activeMenuKey === actionMenuKey(item)}
                  <div
                    class="row-menu"
                    role="listbox"
                    aria-label="Actions for {item.title}"
                    data-testid="wiki-nav-action-menu-{actionMenuKey(item)}"
                  >
                    <button
                      type="button"
                      role="option"
                      aria-selected="false"
                      class="row-menu-item"
                      aria-label="Hide {item.title}"
                      data-testid="wiki-nav-action-hide-{actionMenuKey(item)}"
                      onclick={() => runAction('hide', item)}
                      disabled={actionBusy}
                    >
                      Hide
                    </button>
                    <button
                      type="button"
                      role="option"
                      aria-selected="false"
                      class="row-menu-item row-menu-item-danger"
                      aria-label="Delete {item.title}"
                      data-testid="wiki-nav-action-delete-{actionMenuKey(item)}"
                      onclick={() => requestDelete(item)}
                      disabled={actionBusy}
                    >
                      Delete
                    </button>
                  </div>
                {/if}
              </div>
            {/if}
          </div>
        </li>
      {/if}
    {/each}
  </ul>
</nav>

{#if sidebarOpen}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="sidebar-backdrop" onclick={() => (sidebarOpen = false)} data-testid="wiki-sidebar-backdrop"></div>
{/if}

{#if activeMenuKey}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="menu-backdrop" onclick={() => (activeMenuKey = null)} data-testid="wiki-nav-actions-backdrop"></div>
{/if}

{#if confirmDelete.open && confirmDelete.item}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div
    class="delete-overlay"
    onclick={(event: MouseEvent) => event.target === event.currentTarget && closeDeleteDialog()}
    role="presentation"
    data-testid="wiki-nav-delete-overlay"
  >
    <div
      class="delete-modal"
      role="dialog"
      aria-modal="true"
      aria-label="Confirm delete navigation target"
      data-testid="wiki-nav-delete-modal"
    >
      <h3>Delete {confirmDelete.item.kind === 'folder' ? 'folder' : 'item'}?</h3>
      <p>This will commit the deletion to a content branch and open or update its pull request.</p>
      <div class="delete-actions">
        <button
          type="button"
          class="modal-btn"
          onclick={closeDeleteDialog}
          data-testid="wiki-nav-delete-cancel"
        >
          Cancel
        </button>
        <button
          type="button"
          class="modal-btn modal-btn-danger"
          onclick={async () => {
            const item = confirmDelete.item;
            closeDeleteDialog();
            if (item) await runAction('delete', item);
          }}
          data-testid="wiki-nav-delete-confirm"
        >
          Delete
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .sidebar-toggle {
    display: none;
    position: fixed;
    top: 68px;
    left: 12px;
    z-index: 90;
    background: var(--surface);
    border: 1px solid var(--border);
    color: var(--text);
    padding: 8px;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .sidebar-toggle:hover {
    border-color: var(--border-bright);
    background: var(--surface-2);
  }

  .wiki-sidebar {
    width: 270px;
    min-width: 270px;
    background: var(--bg-sidebar);
    border-right: 1px solid var(--border);
    position: fixed;
    top: 56px;
    left: 0;
    bottom: 0;
    overflow-y: auto;
    z-index: 50;
    padding-bottom: 2rem;
  }

  .sidebar-header {
    padding: 1.5rem 1.25rem 1.25rem;
    border-bottom: 1px solid var(--border);
    margin-bottom: 0.5rem;
  }

  .sidebar-header a {
    font-size: 1.2rem;
    font-weight: 700;
    color: var(--accent-light);
    text-decoration: none;
    display: block;
  }

  .sidebar-header a:hover {
    color: var(--gold);
  }

  .sidebar-sub {
    font-size: 0.7rem;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .menu-status {
    margin: 0 0.8rem 0.6rem;
    min-height: 1.2rem;
    font-size: 0.72rem;
    color: var(--text-muted);
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .menu-status[data-status='working'] {
    color: var(--accent-light);
  }

  .menu-status[data-status='success'] {
    color: var(--gold);
  }

  .menu-status[data-status='error'] {
    color: #f2a6a6;
  }

  .menu-status a {
    color: var(--link);
  }

  .nav-list,
  .section-children,
  .sub-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .nav-section {
    margin-bottom: 0.35rem;
  }

  .section-toggle {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.62rem 1rem 0.2rem 1.25rem;
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    text-align: left;
  }

  .section-toggle:hover {
    color: var(--text);
  }

  .section-title {
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .chevron {
    transition: transform 0.16s;
  }

  .chevron.flipped {
    transform: rotate(180deg);
  }

  .nav-item {
    margin: 0;
    position: relative;
  }

  .nav-row {
    display: flex;
    align-items: center;
    position: relative;
  }

  .nav-link {
    display: block;
    width: 100%;
    min-width: 0;
    padding: 0.35rem 0.6rem 0.35rem 1.75rem;
    color: var(--text);
    text-decoration: none;
    transition: all 0.15s;
    border-left: 2px solid transparent;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .nav-link:hover {
    background: rgba(255, 255, 255, 0.04);
    color: var(--accent-light);
  }

  .nav-link.active {
    color: var(--gold);
    border-left-color: var(--gold);
    background: rgba(212, 175, 55, 0.08);
  }

  .sub-link {
    padding-left: 2.4rem;
    font-size: 0.92rem;
    color: var(--text-muted);
  }

  .nav-actions {
    display: flex;
    align-items: center;
    margin-right: 0.35rem;
    position: relative;
    z-index: 170;
  }

  .row-icon-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border: 1px solid transparent;
    border-radius: 4px;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
  }

  .row-icon-btn:hover {
    background: var(--surface-2, #1a1a2e);
    border-color: var(--border);
    color: var(--text);
  }

  .row-menu {
    position: absolute;
    top: calc(100% + 3px);
    right: 0;
    min-width: 120px;
    background: var(--surface, #16162a);
    border: 1px solid var(--border-bright);
    border-radius: 6px;
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.45);
    z-index: 220;
    padding: 0.25rem;
  }

  .row-menu-item {
    width: 100%;
    border: none;
    background: transparent;
    color: var(--text);
    text-align: left;
    padding: 0.35rem 0.55rem;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.78rem;
  }

  .row-menu-item:hover {
    background: var(--surface-2, #1a1a2e);
  }

  .row-menu-item-danger {
    color: #f2a6a6;
  }

  .menu-backdrop {
    position: fixed;
    top: 56px;
    right: 0;
    bottom: 0;
    left: 270px;
    z-index: 45;
  }

  .delete-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.45);
    z-index: 300;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
  }

  .delete-modal {
    width: min(90vw, 420px);
    background: var(--surface, #16162a);
    border: 1px solid var(--border-bright);
    border-radius: 8px;
    padding: 1rem 1rem 0.9rem;
  }

  .delete-modal h3 {
    margin: 0 0 0.5rem;
  }

  .delete-modal p {
    margin: 0;
    color: var(--text-muted);
    font-size: 0.9rem;
  }

  .delete-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    margin-top: 0.9rem;
  }

  .modal-btn {
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--surface-2, #1a1a2e);
    color: var(--text);
    padding: 0.35rem 0.7rem;
    cursor: pointer;
  }

  .modal-btn-danger {
    color: #f2a6a6;
    border-color: rgba(242, 166, 166, 0.4);
  }

  @media (max-width: 768px) {
    .sidebar-toggle {
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    .wiki-sidebar {
      transform: translateX(-100%);
      transition: transform 0.25s ease;
      z-index: 95;
      top: 56px;
      width: min(78vw, 320px);
      min-width: 0;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
    }

    .wiki-sidebar.open {
      transform: translateX(0);
    }

    .sidebar-backdrop {
      position: fixed;
      inset: 56px 0 0 0;
      background: rgba(0, 0, 0, 0.35);
      z-index: 90;
    }

    .menu-backdrop {
      left: 0;
      z-index: 90;
    }
  }
</style>
