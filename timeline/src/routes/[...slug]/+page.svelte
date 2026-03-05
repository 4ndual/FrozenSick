<script lang="ts">
  import { renderMarkdown } from '$lib/wiki-markdown';
  import { WIKI_NAV, isSection, type NavItem, type NavSection } from '$lib/wiki-nav';
  import WikiEditBar from '../WikiEditBar.svelte';
  import { page } from '$app/stores';
  import { browser } from '$app/environment';

  let { data } = $props();

  let html = $derived(renderMarkdown(data.content));
  let container = $state<HTMLDivElement | undefined>(undefined);

  let currentPath = $derived($page.url.pathname);

  // Run mermaid on content update
  $effect(() => {
    if (browser && html && typeof (window as unknown as { mermaid?: { run: (opts?: { nodes?: NodeList }) => void } }).mermaid?.run === 'function') {
      const m = (window as unknown as { mermaid?: { run: (opts?: { nodes?: NodeList }) => void } }).mermaid;
      setTimeout(() => {
        if (container) m?.run({ nodes: container.querySelectorAll('.mermaid') });
      }, 50);
    }
  });
</script>

<div class="wiki-view">
  <nav id="wiki-sidebar" class="wiki-sidebar" aria-label="Wiki navigation">
    <div class="sidebar-header">
      <a href="/">Frozen Sick</a>
      <span class="sidebar-sub">Campaign Wiki</span>
      <WikiEditBar sourcePath={data.sourcePath} returnTo={currentPath} />
    </div>
    <ul>
      {#each WIKI_NAV as entry (isSection(entry) ? (entry as NavSection).section : (entry as NavItem).href)}
        {#if isSection(entry)}
          <li>
            <span class="section-title">{(entry as NavSection).section}</span>
            <ul>
              {#each (entry as NavSection).children as child (child.href)}
                <li>
                  <a href={child.href} class:active={currentPath === child.href}>{child.title}</a>
                  {#if child.sub}
                    <ul>
                      {#each child.sub as s (s.href)}
                        <li><a href={s.href} class:active={currentPath === s.href}>{s.title}</a></li>
                      {/each}
                    </ul>
                  {/if}
                </li>
              {/each}
            </ul>
          </li>
        {:else}
          <li>
            <a href={entry.href} class:active={currentPath === entry.href}>{entry.title}</a>
          </li>
        {/if}
      {/each}
    </ul>
  </nav>
  <main class="wiki-main">
    <div class="wiki-content prose" bind:this={container}>
      {@html html}
    </div>
  </main>
</div>

<style>
  .wiki-view {
    display: flex;
    min-height: 100vh;
    height: 100dvh;
    overflow-y: auto;
    overflow-x: hidden;
    background: var(--bg);
    color: var(--text);
  }
  .wiki-sidebar {
    width: 270px;
    min-width: 270px;
    background: var(--bg-sidebar);
    border-right: 1px solid var(--border);
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    overflow-y: auto;
    z-index: 10;
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
  .sidebar-sub {
    font-size: 0.7rem;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .wiki-sidebar ul {
    list-style: none;
    padding: 0;
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
  .wiki-sidebar a {
    display: block;
    padding: 0.3rem 1.25rem 0.3rem 1.75rem;
    color: var(--text);
    text-decoration: none;
    font-size: 0.85rem;
    border-left: 3px solid transparent;
  }
  .wiki-sidebar ul ul a {
    padding-left: 2.5rem;
    font-size: 0.8rem;
    color: var(--text-muted);
  }
  .wiki-sidebar a:hover {
    background: var(--bg-card);
    color: var(--accent-light);
  }
  .wiki-sidebar a.active {
    background: var(--bg-card);
    color: var(--accent-light);
    border-left-color: var(--accent);
  }

  .wiki-main {
    margin-left: 270px;
    padding: 2.5rem 3rem 4rem;
    max-width: 920px;
    width: 100%;
  }

  .wiki-content :global(h1),
  .wiki-content :global(h2),
  .wiki-content :global(h3),
  .wiki-content :global(h4),
  .wiki-content :global(h5) {
    color: #eee;
    margin: 1.75rem 0 0.6rem;
  }
  .wiki-content :global(h1) {
    font-size: 1.9rem;
    border-bottom: 2px solid var(--accent);
    padding-bottom: 0.4rem;
    margin-top: 0;
  }
  .wiki-content :global(h2) {
    font-size: 1.4rem;
    border-bottom: 1px solid var(--border);
    padding-bottom: 0.3rem;
  }
  .wiki-content :global(p) {
    margin: 0.6rem 0;
  }
  .wiki-content :global(a) {
    color: var(--link);
  }
  .wiki-content :global(a:hover) {
    color: var(--accent-light);
  }
  .wiki-content :global(blockquote) {
    border-left: 4px solid var(--accent);
    padding-left: 1rem;
    margin: 1rem 0;
    color: var(--text-muted);
  }
  .wiki-content :global(pre) {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 1rem;
    overflow-x: auto;
    margin: 1rem 0;
  }
  .wiki-content :global(code) {
    font-family: ui-monospace, monospace;
    font-size: 0.9em;
  }
  .wiki-content :global(ul),
  .wiki-content :global(ol) {
    margin: 0.6rem 0;
    padding-left: 1.5rem;
  }

  @media (max-width: 768px) {
    .wiki-sidebar {
      transform: translateX(-100%);
    }
    .wiki-main {
      margin-left: 0;
      padding: 2rem 1.25rem;
    }
  }
</style>
