<script lang="ts">
  import { renderMarkdown } from '$lib/wiki-markdown';
  import { linkifyPlacesInHtml, type PlaceMapMatch } from '$lib/place-map-links';
  import Header from '$lib/components/Header/Header.svelte';
  import WikiNav from '$lib/components/Header/WikiNav.svelte';
  import type { NavEntry } from '$lib/wiki-nav';
  import { page } from '$app/stores';
  import { browser } from '$app/environment';

  interface PageData {
    content: string;
    sourcePath: string;
    branch: string;
    defaultBranch: string;
    branches: string[];
    branchLabels: Record<string, string>;
    initialSyncStatus: 'viewing' | 'saved' | 'synced' | 'behind';
    nav: NavEntry[];
    placeMapMatches: PlaceMapMatch[];
    placeMapFile: string;
  }

  let { data } = $props<{ data: PageData }>();

  let html = $derived.by(() =>
    linkifyPlacesInHtml(renderMarkdown(data.content), {
      matches: data.placeMapMatches ?? [],
      branch: data.branch,
      defaultBranch: data.defaultBranch,
      mapFile: data.placeMapFile ?? null,
    }),
  );
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

<div class="wiki-layout">
  <Header
    mode="wiki"
    sourcePath={data.sourcePath}
    returnTo={currentPath}
    branch={data.branch}
    defaultBranch={data.defaultBranch}
    branches={data.branches}
    branchLabels={data.branchLabels}
    initialSyncStatus={data.initialSyncStatus}
  />
  <WikiNav nav={data.nav} branch={data.branch} defaultBranch={data.defaultBranch} />

  <main class="wiki-main" data-testid="wiki-main">
    <div class="wiki-content prose" bind:this={container} data-testid="wiki-content" aria-label="Wiki content">
      {@html html}
    </div>
  </main>
</div>

<style>
  .wiki-layout {
    min-height: 100vh;
    background: var(--bg);
    color: var(--text);
  }

  .wiki-main {
    margin-left: 270px;
    padding: 2.5rem 3rem 4rem;
    max-width: 920px;
    padding-top: calc(56px + 2.5rem);
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

  .wiki-content :global(.mermaid-wrapper) {
    background: var(--bg-card);
    padding: 1.5rem 1rem;
    border-radius: 6px;
    margin: 1.5rem 0;
    border: 1px solid var(--border);
    overflow-x: auto;
    text-align: center;
  }

  .wiki-content :global(.mermaid) {
    display: inline-block;
    background: transparent !important;
    border: none !important;
    padding: 0 !important;
    margin: 0 !important;
  }

  .wiki-content :global(.mermaid svg) {
    max-width: none !important;
    height: auto !important;
  }

  .wiki-content :global(pre) {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 1rem;
    overflow-x: auto;
    margin: 1rem 0;
  }

  .wiki-content :global(.wiki-table-wrapper) {
    overflow-x: auto;
    margin: 1rem 0;
  }

  .wiki-content :global(table) {
    display: table;
    width: 100%;
    border-collapse: collapse;
    font-size: 0.92rem;
  }

  .wiki-content :global(thead) {
    display: table-header-group;
  }

  .wiki-content :global(tbody) {
    display: table-row-group;
  }

  .wiki-content :global(tr) {
    display: table-row;
  }

  .wiki-content :global(th),
  .wiki-content :global(td) {
    display: table-cell;
    padding: 0.55rem 0.75rem;
    border: 1px solid var(--border);
    text-align: left;
  }

  .wiki-content :global(th) {
    background: var(--bg-card);
    font-weight: 600;
    color: #e4e4ec;
  }

  .wiki-content :global(tr:nth-child(even)) {
    background: rgba(22, 22, 42, 0.5);
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
    .wiki-main {
      margin-left: 0;
      padding: 2rem 1.25rem;
      padding-top: calc(56px + 4rem);
    }
  }
</style>
