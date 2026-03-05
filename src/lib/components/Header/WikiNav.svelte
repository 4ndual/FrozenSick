<script lang="ts">
  import { isSection, type NavEntry, type NavItem, type NavSection } from '$lib/wiki-nav';
  import { page } from '$app/stores';

  interface Props {
    nav: NavEntry[];
    branch?: string | null;
    defaultBranch?: string;
  }

  let { nav, branch = null, defaultBranch = 'main' }: Props = $props();

  let currentPath = $derived($page.url.pathname);
  let sidebarOpen = $state(false);

  function branchHref(href: string): string {
    if (!branch || branch === defaultBranch) return href;
    const sep = href.includes('?') ? '&' : '?';
    return `${href}${sep}branch=${encodeURIComponent(branch)}`;
  }
</script>

<button
  type="button"
  class="sidebar-toggle"
  aria-label="Toggle sidebar"
  aria-expanded={sidebarOpen}
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
>
  <div class="sidebar-header">
    <a href="/">Frozen Sick</a>
    <span class="sidebar-sub">Campaign Wiki</span>
  </div>
  <ul class="nav-list">
    {#each nav as entry (isSection(entry) ? (entry as NavSection).section : (entry as NavItem).href)}
      {#if isSection(entry)}
        <li class="nav-section">
          <span class="section-title">{(entry as NavSection).section}</span>
          <ul class="section-children">
            {#each (entry as NavSection).children as child (child.href)}
              <li class="nav-item">
                <a href={branchHref(child.href)} class:active={currentPath === child.href} class="nav-link">
                  {child.title}
                </a>
                {#if child.sub}
                  <ul class="sub-list">
                    {#each child.sub as s (s.href)}
                      <li>
                        <a href={branchHref(s.href)} class:active={currentPath === s.href} class="nav-link sub-link">
                          {s.title}
                        </a>
                      </li>
                    {/each}
                  </ul>
                {/if}
              </li>
            {/each}
          </ul>
        </li>
      {:else}
        <li class="nav-item">
          <a href={branchHref((entry as NavItem).href)} class:active={currentPath === (entry as NavItem).href} class="nav-link">
            {(entry as NavItem).title}
          </a>
        </li>
      {/if}
    {/each}
  </ul>
</nav>

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
    margin-bottom: 0.75rem;
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

  .nav-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .nav-section {
    margin-bottom: 0.5rem;
  }

  .section-title {
    display: block;
    padding: 0.75rem 1.25rem 0.25rem;
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
  }

  .section-children {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .nav-item {
    margin: 0;
  }

  .nav-link {
    display: block;
    padding: 0.35rem 1.25rem 0.35rem 1.75rem;
    color: var(--text);
    text-decoration: none;
    font-size: 0.85rem;
    border-left: 3px solid transparent;
    transition: all 0.15s;
  }

  .nav-link:hover {
    background: var(--bg-card);
    color: var(--accent-light);
  }

  .nav-link.active {
    background: var(--bg-card);
    color: var(--accent-light);
    border-left-color: var(--accent);
  }

  .sub-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .sub-link {
    padding-left: 2.5rem;
    font-size: 0.8rem;
    color: var(--text-muted);
  }

  .sub-link:hover {
    color: var(--text);
  }

  @media (max-width: 768px) {
    .sidebar-toggle {
      display: block;
    }

    .wiki-sidebar {
      transform: translateX(-100%);
      transition: transform 0.2s ease;
      top: 56px;
    }

    .wiki-sidebar.open {
      transform: translateX(0);
    }
  }
</style>
