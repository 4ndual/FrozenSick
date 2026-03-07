<script lang="ts">
  import { env } from '$env/dynamic/public';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import Header from '$lib/components/Header/Header.svelte';
  import WikiNav from '$lib/components/Header/WikiNav.svelte';
  import type { NavEntry } from '$lib/wiki-nav';

  interface MapOption {
    file: string;
    name: string;
    path: string;
  }

  interface PageData {
    branch: string;
    defaultBranch: string;
    branches: string[];
    branchLabels: Record<string, string>;
    nav: NavEntry[];
    maps: MapOption[];
    selectedFile: string;
  }

  let { data } = $props<{ data: PageData }>();

  const owner = env.PUBLIC_GITHUB_OWNER || '4ndual';
  const repo = env.PUBLIC_GITHUB_REPO || 'FrozenSick';

  let currentPath = $derived($page.url.pathname + $page.url.search);
  let maps = $derived.by<MapOption[]>(() => data.maps ?? []);
  let selectedFile = $state('');

  $effect(() => {
    selectedFile = data.selectedFile ?? '';
  });

  function encodePath(path: string): string {
    return path
      .split('/')
      .map((segment) => encodeURIComponent(segment))
      .join('/');
  }

  function buildRawMapUrl(repoPath: string): string {
    return `https://raw.githubusercontent.com/${owner}/${repo}/${encodePath(data.branch)}/${encodePath(repoPath)}`;
  }

  const selectedMap = $derived.by<MapOption | null>(
    () => maps.find((m: MapOption) => m.file === selectedFile) ?? null,
  );
  const rawMapUrl = $derived(selectedMap ? buildRawMapUrl(selectedMap.path) : '');
  const fmgUrl = $derived(
    rawMapUrl
      ? `https://azgaar.github.io/Fantasy-Map-Generator/?maplink=${encodeURIComponent(rawMapUrl)}`
      : '',
  );

  function setSelectedFile(file: string): void {
    selectedFile = file;
    const url = new URL($page.url);
    if (file) url.searchParams.set('file', file);
    else url.searchParams.delete('file');
    goto(url.toString(), { replaceState: true, keepFocus: true, noScroll: true });
  }

  function handleMapChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    setSelectedFile(target.value);
  }
</script>

<div class="wiki-layout">
  <Header
    mode="map"
    returnTo={currentPath}
    branch={data.branch}
    defaultBranch={data.defaultBranch}
    branches={data.branches}
    branchLabels={data.branchLabels}
  />
  <WikiNav nav={data.nav} branch={data.branch} defaultBranch={data.defaultBranch} />

  <main class="maps-main" data-testid="maps-main">
    <header class="maps-toolbar" data-testid="maps-toolbar">
      <div class="maps-control">
        <label for="map-select">Map file</label>
        <select
          id="map-select"
          data-testid="maps-map-select"
          aria-label="Select map file"
          value={selectedFile}
          onchange={handleMapChange}
          disabled={maps.length === 0}
        >
          {#each maps as map}
            <option value={map.file}>{map.name}</option>
          {/each}
        </select>
      </div>

      <div class="maps-meta" data-testid="maps-meta">
        <span data-testid="maps-source-repo">{owner}/{repo}@{data.branch}</span>
        {#if rawMapUrl}
          <a data-testid="maps-open-raw" href={rawMapUrl} target="_blank" rel="noopener noreferrer">Open raw .map</a>
        {/if}
        {#if fmgUrl}
          <a data-testid="maps-open-fmg" href={fmgUrl} target="_blank" rel="noopener noreferrer">Open in FMG</a>
        {/if}
      </div>
    </header>

    <section class="maps-body" data-testid="maps-body">
      {#if maps.length === 0}
        <p data-testid="maps-empty">No .map files found in content/World for this branch.</p>
      {:else if fmgUrl}
        <iframe
          title="Fantasy Map Generator"
          data-testid="maps-fmg-iframe"
          src={fmgUrl}
          class="maps-iframe"
          loading="eager"
          referrerpolicy="no-referrer"
        ></iframe>
      {/if}
    </section>
  </main>
</div>

<style>
  .wiki-layout {
    min-height: 100vh;
    background: var(--bg);
    color: var(--text);
  }

  .maps-main {
    margin-left: 270px;
    min-height: calc(100vh - 56px);
    padding-top: 56px;
    display: grid;
    grid-template-rows: auto 1fr;
  }

  .maps-toolbar {
    display: flex;
    justify-content: space-between;
    align-items: end;
    gap: 12px;
    padding: 10px 16px;
    border-bottom: 1px solid var(--border);
    background: var(--surface);
  }

  .maps-control {
    display: grid;
    gap: 4px;
    font-size: 12px;
  }

  .maps-control select {
    min-width: 320px;
  }

  .maps-meta {
    display: grid;
    justify-items: end;
    gap: 2px;
    font-size: 12px;
  }

  .maps-meta a {
    color: var(--link);
    text-decoration: none;
  }

  .maps-meta a:hover {
    color: var(--gold);
    text-decoration: underline;
  }

  .maps-body {
    min-height: 0;
    padding: 10px;
  }

  .maps-iframe {
    width: 100%;
    height: 100%;
    border: 1px solid var(--border);
    background: #000;
  }

  .maps-body p {
    margin: 0;
    padding: 12px;
    font-size: 14px;
    color: var(--text-muted);
  }

  @media (max-width: 768px) {
    .maps-main {
      margin-left: 0;
    }

    .maps-toolbar {
      align-items: start;
      flex-direction: column;
    }

    .maps-control select {
      min-width: 220px;
      width: min(100%, 360px);
    }

    .maps-meta {
      justify-items: start;
    }
  }
</style>
