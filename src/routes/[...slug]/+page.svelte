<script lang="ts">
  import { renderMarkdown } from '$lib/wiki-markdown';
  import { linkifyPlacesInHtml, type PlaceMapMatch } from '$lib/place-map-links';
  import Header from '$lib/components/Header/Header.svelte';
  import WikiNav from '$lib/components/Header/WikiNav.svelte';
  import type { NavEntry } from '$lib/wiki-nav';
  import { runMermaidIn } from '$lib/mermaid-client';
  import { page } from '$app/stores';
  import { browser } from '$app/environment';
  import type { WikiBreadcrumb, WikiEntryMeta } from '$lib/wiki-entry';
  import WorldOrganizations from '$lib/components/world/WorldOrganizations.svelte';
  import TrackerSubplots from '$lib/components/plot/TrackerSubplots.svelte';
  import { worldOrganizationGroups } from '$lib/world-organizations';

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
    entryMeta: WikiEntryMeta;
    breadcrumbs: WikiBreadcrumb[];
    authenticated?: boolean;
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
  let focusQuery = $derived($page.url.searchParams.get('focus') ?? '');
  let mermaidModalOpen = $state(false);
  let mermaidModalMarkup = $state('');
  let mermaidZoom = $state(1);
  let mermaidOffsetX = $state(0);
  let mermaidOffsetY = $state(0);
  let isDragging = $state(false);
  let dragStartX = $state(0);
  let dragStartY = $state(0);
  let modalStage = $state<HTMLDivElement | undefined>(undefined);
  let shouldFitModalGraph = $state(false);
  const MIN_ZOOM = 0.4;
  const MAX_ZOOM = 6;
  const REFERENCE_SELECTOR = 'h1, h2, h3, h4, h5, h6, p, li, blockquote, td, th, summary, pre';

  $effect(() => {
    if (!browser || !html || !container) return;

    const target = container;
    const timer = window.setTimeout(() => {
      void runMermaidIn(target).catch((error) => {
        console.error('Failed to render Mermaid diagrams', error);
      });
    }, 50);

    return () => {
      window.clearTimeout(timer);
    };
  });

  $effect(() => {
    if (!browser || !container) return;

    const target = container;
    const timer = window.setTimeout(() => {
      highlightReferenceTarget(target, focusQuery, $page.url.hash.replace(/^#/, ''));
    }, 120);

    return () => {
      window.clearTimeout(timer);
    };
  });

  $effect(() => {
    if (!container) return;
    const target = container;
    const onClick = (event: Event) => {
      openMermaidModalFromTarget(event.target);
    };
    target.addEventListener('click', onClick);
    return () => {
      target.removeEventListener('click', onClick);
    };
  });

  $effect(() => {
    if (!browser) return;
    document.body.style.overflow = mermaidModalOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  });

  function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }

  function normalizeText(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  function clearReferenceHighlights(target: ParentNode): void {
    target.querySelectorAll('.reference-hit').forEach((node) => node.classList.remove('reference-hit'));
  }

  function highlightReferenceTarget(target: ParentNode, focus: string, anchor: string): void {
    clearReferenceHighlights(target);

    const normalizedFocus = normalizeText(focus);
    const tokens = normalizedFocus.split(/\s+/).filter(Boolean);
    let nodes = Array.from(target.querySelectorAll<HTMLElement>(REFERENCE_SELECTOR));

    if (anchor) {
      const anchorNode = target.querySelector<HTMLElement>(`#${CSS.escape(anchor)}`);
      if (anchorNode) {
        const anchorIndex = nodes.indexOf(anchorNode);
        if (anchorIndex >= 0) {
          nodes = nodes.slice(anchorIndex);
        }
      }
    }

    if (!normalizedFocus || tokens.length === 0) {
      return;
    }

    const match =
      nodes.find((node) => normalizeText(node.textContent || '').includes(normalizedFocus)) ??
      nodes.find((node) => {
        const text = normalizeText(node.textContent || '');
        return tokens.every((token) => text.includes(token));
      });

    if (!match) return;

    match.classList.add('reference-hit');
    match.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function resetMermaidView(): void {
    mermaidZoom = 1;
    mermaidOffsetX = 0;
    mermaidOffsetY = 0;
  }

  function fitModalGraph(): void {
    if (!modalStage) return;
    const svg = modalStage.querySelector('.mermaid-stage-content svg');
    if (!(svg instanceof SVGSVGElement)) return;

    const viewBox = svg.viewBox.baseVal;
    if (!viewBox || viewBox.width <= 0 || viewBox.height <= 0) return;

    const stageW = modalStage.clientWidth;
    const stageH = modalStage.clientHeight;
    if (!stageW || !stageH) return;

    // Fit to viewport first, then enforce a readable default zoom level.
    const fitZoom = Math.min((stageW * 0.96) / viewBox.width, (stageH * 0.96) / viewBox.height);
    mermaidZoom = clamp(Math.max(fitZoom, 1.35), MIN_ZOOM, MAX_ZOOM);
    mermaidOffsetX = 0;
    mermaidOffsetY = 0;
  }

  function closeMermaidModal(): void {
    mermaidModalOpen = false;
    mermaidModalMarkup = '';
    isDragging = false;
  }

  function openMermaidModalFromTarget(target: EventTarget | null): void {
    if (!(target instanceof Element) || !container) return;
    const mermaidNode = target.closest('.mermaid');
    if (!(mermaidNode instanceof HTMLElement) || !container.contains(mermaidNode)) return;
    const svg = mermaidNode.querySelector('svg');
    if (!(svg instanceof SVGElement)) return;

    mermaidModalMarkup = svg.outerHTML;
    resetMermaidView();
    mermaidModalOpen = true;
    shouldFitModalGraph = true;
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && mermaidModalOpen) {
      closeMermaidModal();
    }
  }

  function applyZoom(delta: number): void {
    mermaidZoom = clamp(mermaidZoom + delta, MIN_ZOOM, MAX_ZOOM);
  }

  function handleModalWheel(event: WheelEvent): void {
    event.preventDefault();
    applyZoom(event.deltaY < 0 ? 0.12 : -0.12);
  }

  function handlePointerDown(event: PointerEvent): void {
    if (event.button !== 0) return;
    isDragging = true;
    dragStartX = event.clientX - mermaidOffsetX;
    dragStartY = event.clientY - mermaidOffsetY;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: PointerEvent): void {
    if (!isDragging) return;
    mermaidOffsetX = event.clientX - dragStartX;
    mermaidOffsetY = event.clientY - dragStartY;
  }

  function handlePointerUp(event: PointerEvent): void {
    if (!isDragging) return;
    isDragging = false;
    (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
  }

  $effect(() => {
    if (!mermaidModalOpen || !shouldFitModalGraph) return;
    const id = window.requestAnimationFrame(() => {
      fitModalGraph();
      shouldFitModalGraph = false;
    });
    return () => {
      window.cancelAnimationFrame(id);
    };
  });

</script>

<svelte:window onkeydown={handleKeydown} />

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
  <WikiNav
    nav={data.nav}
    branch={data.branch}
    defaultBranch={data.defaultBranch}
    authenticated={Boolean(data.authenticated)}
  />

  <main class="wiki-main" data-testid="wiki-main">
    <div class="wiki-shell">
      <div class="wiki-meta-card">
        <nav class="breadcrumbs" aria-label="Breadcrumb">
          {#each data.breadcrumbs as crumb, index (crumb.href + crumb.label)}
            {#if crumb.href}
              <a href={crumb.href}>{crumb.label}</a>
            {:else}
              <span>{crumb.label}</span>
            {/if}
            {#if index < data.breadcrumbs.length - 1}
              <span aria-hidden="true">/</span>
            {/if}
          {/each}
        </nav>
        <div class="entry-meta">
          <span class="entry-badge entry-badge-{data.entryMeta.kind}">{data.entryMeta.badge}</span>
          <span class="entry-description">{data.entryMeta.description}</span>
        </div>
      </div>

      {#if data.sourcePath === 'content/World/Organizations.md'}
        <WorldOrganizations groups={worldOrganizationGroups} />
      {/if}

      {#if data.sourcePath === 'content/Plot/Tracker/Subplots (Character-Specific).md'}
        <TrackerSubplots />
      {/if}

      <div class="wiki-content prose" bind:this={container} data-testid="wiki-content" aria-label="Wiki content">
      {@html html}
      </div>
    </div>
  </main>
</div>

{#if mermaidModalOpen}
  <div
    class="mermaid-modal"
    role="dialog"
    aria-modal="true"
    aria-label="Expanded graph viewer"
    data-testid="wiki-graph-modal"
    tabindex="-1"
  >
    <button
      type="button"
      class="mermaid-backdrop"
      onclick={closeMermaidModal}
      aria-label="Close expanded graph viewer"
      data-testid="wiki-graph-backdrop"
    ></button>

    <div class="mermaid-toolbar">
      <button type="button" onclick={() => applyZoom(0.2)} aria-label="Zoom in graph" data-testid="wiki-graph-zoom-in">
        +
      </button>
      <button type="button" onclick={() => applyZoom(-0.2)} aria-label="Zoom out graph" data-testid="wiki-graph-zoom-out">
        -
      </button>
      <button type="button" onclick={resetMermaidView} aria-label="Reset graph zoom" data-testid="wiki-graph-reset">
        Reset
      </button>
      <button type="button" onclick={closeMermaidModal} aria-label="Close graph viewer" data-testid="wiki-graph-close">
        Close
      </button>
    </div>

    <div
      class="mermaid-stage"
      bind:this={modalStage}
      role="application"
      aria-label="Graph pan and zoom viewport"
      onwheel={handleModalWheel}
      onpointerdown={handlePointerDown}
      onpointermove={handlePointerMove}
      onpointerup={handlePointerUp}
      onpointercancel={handlePointerUp}
    >
      <div
        class="mermaid-stage-content"
        style={`transform: translate(${mermaidOffsetX}px, ${mermaidOffsetY}px) scale(${mermaidZoom});`}
      >
        {@html mermaidModalMarkup}
      </div>
    </div>
  </div>
{/if}

<style>
  .wiki-layout {
    min-height: 100vh;
    background: var(--bg);
    color: var(--text);
  }

  .wiki-main {
    margin-left: 270px;
    padding: 2.5rem 3rem 4rem;
    width: calc(100vw - 270px - 6rem);
    max-width: 1400px;
    padding-top: calc(56px + 2.5rem);
  }

  .wiki-shell {
    display: grid;
    gap: 1rem;
  }

  .wiki-meta-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
    padding: 0.9rem 1.1rem;
    border: 1px solid var(--border);
    border-radius: 14px;
    background: linear-gradient(180deg, color-mix(in srgb, var(--bg-card) 88%, transparent), var(--bg-card));
  }

  .breadcrumbs {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    flex-wrap: wrap;
    font-size: 0.8rem;
    color: var(--text-muted);
  }

  .breadcrumbs a {
    color: inherit;
    text-decoration: none;
  }

  .breadcrumbs a:hover {
    color: var(--accent-light);
  }

  .entry-meta {
    display: flex;
    align-items: center;
    gap: 0.7rem;
    flex-wrap: wrap;
  }

  .entry-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 1.8rem;
    padding: 0.2rem 0.7rem;
    border-radius: 999px;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    border: 1px solid var(--border);
  }

  .entry-badge-canon {
    color: var(--gold);
    border-color: rgba(212, 175, 55, 0.35);
    background: rgba(212, 175, 55, 0.08);
  }

  .entry-badge-notes {
    color: #e7c97d;
    border-color: rgba(231, 201, 125, 0.28);
    background: rgba(231, 201, 125, 0.08);
  }

  .entry-badge-transcript {
    color: #98bfdc;
    border-color: rgba(152, 191, 220, 0.28);
    background: rgba(152, 191, 220, 0.08);
  }

  .entry-badge-reference {
    color: #c7cce5;
    border-color: rgba(199, 204, 229, 0.22);
    background: rgba(199, 204, 229, 0.08);
  }

  .entry-description {
    color: var(--text-muted);
    font-size: 0.84rem;
  }

  .wiki-content :global(h1),
  .wiki-content :global(h2),
  .wiki-content :global(h3),
  .wiki-content :global(h4),
  .wiki-content :global(h5) {
    font-family: 'Cinzel', serif;
    letter-spacing: 0.05em;
    line-height: 1.15;
    text-transform: uppercase;
    color: #eee;
    margin: 1.75rem 0 0.6rem;
    scroll-margin-top: 92px;
  }

  .wiki-content :global(h1) {
    font-size: clamp(2rem, 3vw, 2.55rem);
    font-weight: 700;
    border-bottom: 2px solid var(--accent);
    padding-bottom: 0.5rem;
    margin-top: 0;
  }

  .wiki-content :global(h2) {
    font-size: clamp(1.35rem, 2vw, 1.7rem);
    font-weight: 600;
    border-bottom: 1px solid var(--border);
    padding-bottom: 0.3rem;
  }

  .wiki-content :global(p) {
    margin: 0.6rem 0;
    overflow-wrap: anywhere;
  }

  .wiki-content :global(a) {
    color: var(--link);
  }

  .wiki-content :global(a:hover) {
    color: var(--accent-light);
  }

  .wiki-content :global(blockquote) {
    border-left: 4px solid var(--accent);
    padding: 0.85rem 1rem;
    margin: 1rem 0;
    color: var(--text-muted);
    background: rgba(255, 255, 255, 0.025);
    border-radius: 0 10px 10px 0;
  }

  .wiki-content :global(.mermaid-wrapper) {
    background: var(--bg-card);
    padding: 1.5rem 1rem;
    border-radius: 6px;
    margin: 1.5rem 0;
    border: 1px solid var(--border);
    overflow-x: visible;
    text-align: center;
  }

  .wiki-content :global(.mermaid) {
    display: block;
    width: 100%;
    background: transparent !important;
    border: none !important;
    padding: 0 !important;
    margin: 0 !important;
    cursor: zoom-in;
  }

  .wiki-content :global(.mermaid svg) {
    display: block;
    width: 100% !important;
    max-width: 100% !important;
    height: auto !important;
    margin: 0 auto;
  }

  .wiki-content :global(pre) {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 1rem;
    overflow-x: auto;
    margin: 1rem 0;
  }

  .wiki-content :global(.wiki-table-wrapper) {
    overflow-x: auto;
    margin: 1rem 0;
    border: 1px solid var(--border);
    border-radius: 12px;
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
    vertical-align: top;
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
    word-break: break-word;
  }

  .wiki-content :global(.reference-hit) {
    outline: 2px solid rgba(212, 175, 55, 0.85);
    box-shadow: 0 0 0 6px rgba(212, 175, 55, 0.12);
    border-radius: 10px;
    background: rgba(212, 175, 55, 0.08);
    transition: box-shadow 0.2s ease, background 0.2s ease;
  }

  .wiki-content :global(ul),
  .wiki-content :global(ol) {
    margin: 0.6rem 0;
    padding-left: 1.5rem;
  }

  .mermaid-modal {
    position: fixed;
    inset: 0;
    z-index: 1200;
    background: rgba(2, 3, 8, 0.92);
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1rem;
  }

  .mermaid-backdrop {
    position: absolute;
    inset: 0;
    border: 0;
    background: transparent;
    cursor: zoom-out;
  }

  .mermaid-toolbar {
    position: relative;
    z-index: 1;
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
  }

  .mermaid-toolbar button {
    background: var(--bg-card);
    color: var(--text);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 0.45rem 0.75rem;
    cursor: pointer;
  }

  .mermaid-toolbar button:hover {
    border-color: var(--accent);
  }

  .mermaid-stage {
    position: relative;
    z-index: 1;
    flex: 1;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: #060912;
    overflow: hidden;
    display: grid;
    place-items: center;
    touch-action: none;
    cursor: grab;
  }

  .mermaid-stage:active {
    cursor: grabbing;
  }

  .mermaid-stage-content {
    transform-origin: center center;
    max-width: 100%;
    max-height: 100%;
  }

  .mermaid-stage-content :global(svg) {
    max-width: none !important;
    height: auto !important;
    shape-rendering: geometricPrecision;
    text-rendering: geometricPrecision;
  }

  @media (max-width: 768px) {
    .wiki-main {
      margin-left: 0;
      padding: 2rem 1.25rem;
      padding-top: calc(56px + 4rem);
      width: auto;
      max-width: none;
    }

    .wiki-meta-card {
      padding: 0.85rem 0.9rem;
      border-radius: 12px;
    }

    .wiki-content :global(h1) {
      font-size: clamp(1.55rem, 7vw, 2rem);
    }

    .wiki-content :global(h2) {
      font-size: clamp(1.1rem, 5vw, 1.4rem);
    }

    .wiki-content :global(table) {
      min-width: 680px;
      font-size: 0.86rem;
    }

    .wiki-content :global(blockquote) {
      padding: 0.75rem 0.85rem;
    }

    .mermaid-modal {
      padding: 0.75rem;
    }
  }
</style>
