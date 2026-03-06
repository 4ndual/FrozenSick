<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { env } from '$env/dynamic/public';
  import { campaign } from '$lib/store/campaign.svelte';
  import { formatDate } from '$lib/utils/calendar';

  let svg = $state<string | null>(null);
  let mapName = $state<string>('');
  let mapPath = $state<string | null>(null);
  let mapBranch = $state<string>('main');
  let loading = $state(true);
  let error = $state<string | null>(null);
  let errorStatus = $state<number | null>(null);

  const cal = $derived(campaign.data.calendar);
  const eventsWithLocation = $derived(
    campaign.data.events.filter((e) => e.location != null && String(e.location).trim() !== ''),
  );
  const eventsByLocation = $derived(
    (() => {
      const map = new Map<string, typeof eventsWithLocation>();
      for (const ev of eventsWithLocation) {
        const loc = String(ev.location).trim();
        if (!map.has(loc)) map.set(loc, []);
        map.get(loc)!.push(ev);
      }
      return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    })(),
  );

  let scale = $state(0.5);
  let translateX = $state(0);
  let translateY = $state(0);
  let panning = $state(false);
  let lastClientX = 0;
  let lastClientY = 0;

  function loadMap(file?: string) {
    loading = true;
    error = null;
    errorStatus = null;
    const params = new URLSearchParams();
    if (file) params.set('file', file);
    fetch(`/api/world/map?${params}`, { credentials: 'include' })
      .then((res) => {
        if (!res.ok) {
          errorStatus = res.status;
          if (res.status === 401) error = 'Sign in to view the campaign map.';
          else error = res.status === 404 ? 'No map files found.' : 'Failed to load map.';
          return null;
        }
        return res.json() as Promise<{ svg: string; name: string; path: string; branch: string }>;
      })
      .then((data) => {
        if (data) {
          svg = data.svg;
          mapName = data.name;
          mapPath = data.path;
          mapBranch = data.branch ?? 'main';
        }
      })
      .catch(() => {
        error = 'Failed to load map.';
      })
      .finally(() => {
        loading = false;
      });
  }

  function handleWheel(e: WheelEvent) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.05 : 0.05;
    scale = Math.max(0.2, Math.min(2, scale + delta));
  }

  function handleMouseDown(e: MouseEvent) {
    if ((e.target as HTMLElement).closest('.map-svg-wrap')) {
      panning = true;
      lastClientX = e.clientX;
      lastClientY = e.clientY;
    }
  }

  function handleMouseMove(e: MouseEvent) {
    if (!panning) return;
    translateX += e.clientX - lastClientX;
    translateY += e.clientY - lastClientY;
    lastClientX = e.clientX;
    lastClientY = e.clientY;
  }

  function handleMouseUp() {
    panning = false;
  }

  onMount(() => {
    loadMap();
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  });

  onDestroy(() => {
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
  });
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
  class="map-view"
  data-testid="map-view"
  role="application"
  aria-label="Campaign map — zoom with wheel, drag to pan"
  onwheel={handleWheel}
  onmousedown={handleMouseDown}
  style="cursor: {panning ? 'grabbing' : 'grab'}"
>
  {#if loading}
    <div class="map-placeholder" data-testid="map-loading">
      <p>Loading map…</p>
    </div>
  {:else if error}
    <div class="map-placeholder" data-testid="map-error" data-status={errorStatus ?? 'error'}>
      <p>{error}</p>
      {#if errorStatus === 401}
        <a href="/" class="map-auth-link">Go to Wiki</a>
      {/if}
    </div>
  {:else if svg}
    <div class="map-pan-zoom">
      <div
        class="map-svg-wrap"
        style="transform: translate({translateX}px, {translateY}px) scale({scale})"
      >
        {@html svg}
      </div>
      <div class="map-overlay" aria-hidden="true"></div>
    </div>
    <div class="map-title" data-testid="map-name">{mapName}</div>
    <a
      href="/world/places"
      class="map-wiki-link"
      data-testid="map-link-places"
      aria-label="View Places in wiki"
    >
      Places (wiki)
    </a>
    {#if mapPath && env.PUBLIC_GITHUB_OWNER && env.PUBLIC_GITHUB_REPO}
      {@const rawUrl = `https://raw.githubusercontent.com/${env.PUBLIC_GITHUB_OWNER}/${env.PUBLIC_GITHUB_REPO}/${mapBranch}/${encodeURIComponent(mapPath)}`}
      {@const fmgUrl = `https://azgaar.github.io/Fantasy-Map-Generator?maplink=${encodeURIComponent(rawUrl)}`}
      <a
        href={fmgUrl}
        target="_blank"
        rel="noopener noreferrer"
        class="map-fmg-link"
        data-testid="map-open-fmg"
        aria-label="Open map in Fantasy Map Generator"
      >
        Open in FMG
      </a>
    {/if}
    {#if eventsByLocation.length > 0}
      <div class="map-events-list" data-testid="map-events-by-location">
        <div class="map-events-title">Events by location</div>
        {#each eventsByLocation as [loc, evs]}
          <div class="map-events-group">
            <div class="map-events-loc">{loc}</div>
            {#each evs as ev}
              <button
                type="button"
                class="map-event-btn"
                class:selected={campaign.selectedEventId === ev.id}
                onclick={() => campaign.setSelectedEvent(ev.id)}
                data-testid="map-event-{ev.id}"
                aria-label="Select {ev.title} on map"
              >
                {ev.title}
                <span class="map-event-date">{formatDate(ev.date, cal)}</span>
              </button>
            {/each}
          </div>
        {/each}
      </div>
    {/if}
  {/if}
</div>

<style>
  .map-view {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
    position: relative;
    background: var(--bg);
  }

  .map-placeholder {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    color: var(--text-muted);
    padding: 24px;
  }

  .map-auth-link {
    color: var(--link);
    text-decoration: none;
  }
  .map-auth-link:hover {
    text-decoration: underline;
  }

  .map-pan-zoom {
    flex: 1;
    overflow: hidden;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .map-svg-wrap {
    transform-origin: center center;
    display: inline-block;
    min-width: 0;
    pointer-events: auto;
  }

  .map-svg-wrap :global(svg) {
    display: block;
    max-width: 100%;
    height: auto;
  }

  .map-overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  .map-title {
    position: absolute;
    bottom: 12px;
    left: 12px;
    font-size: 12px;
    color: var(--text-dim);
    font-family: 'Cinzel', serif;
  }

  .map-wiki-link {
    position: absolute;
    bottom: 12px;
    right: 12px;
    font-size: 12px;
    color: var(--link);
    font-family: 'Cinzel', serif;
    text-decoration: none;
  }

  .map-wiki-link:hover {
    color: var(--gold);
    text-decoration: underline;
  }

  .map-fmg-link {
    position: absolute;
    bottom: 12px;
    right: 140px;
    font-size: 12px;
    color: var(--link);
    font-family: 'Cinzel', serif;
    text-decoration: none;
  }

  .map-fmg-link:hover {
    color: var(--gold);
    text-decoration: underline;
  }

  .map-events-list {
    position: absolute;
    top: 12px;
    right: 12px;
    max-width: 220px;
    max-height: 50%;
    overflow-y: auto;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 10px;
    font-size: 12px;
  }

  .map-events-title {
    font-family: 'Cinzel', serif;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-dim);
    margin-bottom: 8px;
  }

  .map-events-group {
    margin-bottom: 10px;
  }

  .map-events-group:last-child {
    margin-bottom: 0;
  }

  .map-events-loc {
    font-weight: 600;
    color: var(--gold-dim);
    margin-bottom: 4px;
  }

  .map-event-btn {
    display: block;
    width: 100%;
    text-align: left;
    background: none;
    border: none;
    color: var(--text-muted);
    padding: 4px 6px;
    border-radius: 4px;
    cursor: pointer;
    font-family: inherit;
    font-size: 12px;
  }

  .map-event-btn:hover {
    background: var(--surface-2);
    color: var(--text);
  }

  .map-event-btn.selected {
    background: var(--gold-glow);
    color: var(--gold);
    border: 1px solid var(--gold-dim);
  }

  .map-event-date {
    display: block;
    font-size: 10px;
    color: var(--text-dim);
    margin-top: 2px;
  }
</style>
