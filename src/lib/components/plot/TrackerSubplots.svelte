<script lang="ts">
  import {
    trackerCharacterFilters,
    trackerSubplots,
    type TrackerCharacterFilter,
  } from '$lib/plot-tracker-subplots';

  let selected = $state<TrackerCharacterFilter>('General');

  const filteredSubplots = $derived(
    trackerSubplots.filter((subplot) => subplot.character === selected),
  );
</script>

<section class="tracker-subplots" data-testid="tracker-subplots">
  <div class="filter-bar" role="tablist" aria-label="Filter subplots by character">
    {#each trackerCharacterFilters as filter (filter)}
      <button
        type="button"
        class="filter-pill"
        class:active={selected === filter}
        role="tab"
        aria-selected={selected === filter}
        onclick={() => (selected = filter)}
      >
        {filter}
      </button>
    {/each}
  </div>

  <div class="subplot-grid">
    {#each filteredSubplots as subplot (`${subplot.character}:${subplot.title}`)}
      <article class="subplot-card">
        <p class="subplot-kicker">{subplot.character}</p>
        <h2>{subplot.title}</h2>
        <p>{subplot.summary}</p>
        <p class="subplot-status"><strong>Status:</strong> {subplot.status}</p>
        {#if subplot.questions?.length}
          <ul>
            {#each subplot.questions as question (question)}
              <li>{question}</li>
            {/each}
          </ul>
        {/if}
      </article>
    {/each}
  </div>
</section>

<style>
  .tracker-subplots {
    display: grid;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .filter-bar {
    display: flex;
    gap: 0.65rem;
    flex-wrap: wrap;
    padding: 0.85rem 1rem;
    border: 1px solid var(--border);
    border-radius: 14px;
    background: linear-gradient(
      180deg,
      color-mix(in srgb, var(--bg-card) 90%, transparent),
      var(--bg-card)
    );
  }

  .filter-pill {
    border: 1px solid var(--border);
    background: color-mix(in srgb, var(--bg-card) 82%, transparent);
    color: var(--text-muted);
    border-radius: 999px;
    padding: 0.45rem 0.8rem;
    cursor: pointer;
    transition:
      border-color 0.16s ease,
      color 0.16s ease,
      background 0.16s ease,
      transform 0.16s ease;
  }

  .filter-pill:hover {
    color: var(--text);
    border-color: var(--accent-light);
    transform: translateY(-1px);
  }

  .filter-pill.active {
    color: var(--gold);
    border-color: rgba(212, 175, 55, 0.45);
    background: rgba(212, 175, 55, 0.1);
  }

  .subplot-grid {
    display: grid;
    gap: 1rem;
  }

  .subplot-card {
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 1rem 1.1rem;
    background: linear-gradient(
      180deg,
      color-mix(in srgb, var(--bg-card) 88%, transparent),
      var(--bg-card)
    );
    box-shadow: 0 12px 26px rgba(0, 0, 0, 0.14);
  }

  .subplot-kicker {
    margin: 0 0 0.45rem;
    font-size: 0.74rem;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--accent-light);
  }

  .subplot-card h2 {
    margin-top: 0;
  }

  .subplot-status {
    margin-bottom: 0.7rem;
  }

  .subplot-card ul {
    margin: 0;
    padding-left: 1.2rem;
  }

  @media (max-width: 768px) {
    .filter-bar {
      gap: 0.5rem;
      padding: 0.8rem;
    }

    .filter-pill {
      width: fit-content;
    }
  }
</style>
