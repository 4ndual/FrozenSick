<script lang="ts">
  import Header from '$lib/components/Header/Header.svelte';
  import WikiNav from '$lib/components/Header/WikiNav.svelte';
  import { isSection, type NavItem, type NavSection } from '$lib/wiki-nav';

  let { data } = $props();

  type HomeItem = {
    title: string;
    href: string;
    sub?: HomeItem[];
  };

  type HomeCard = {
    title: string;
    items: HomeItem[];
  };

  const STORY_CARD_TITLE = 'The Story So Far';
  const STORY_PAGE_SIZE = 5;

  /** Card title mapping: section key (from repo) -> display title on home */
  const SECTION_TITLES: Record<string, string> = {
    chapters: STORY_CARD_TITLE,
    characters: 'The Party',
    world: 'The World',
    plot: 'Campaign Tools',
    relations: 'Campaign Tools',
  };

  const expandedItems = $state<Record<string, boolean>>({});
  let storyPage = $state(0);

  /** Nav entries that are sections (have children), for landing cards. */
  const landingSections = $derived(data.nav.filter((e): e is NavSection => isSection(e)));

  /** Single nav links (e.g. Timeline) to show in a tools card. */
  const standaloneLinks = $derived(
    data.nav.filter((e): e is NavItem => !isSection(e) && e.href !== '/'),
  );

  function cardTitle(entry: NavSection): string {
    const key = entry.section.toLowerCase();
    return SECTION_TITLES[key] ?? entry.section;
  }

  function toHomeItem(item: NavItem): HomeItem {
    return {
      title: item.title,
      href: item.href,
      sub: item.sub?.map((subItem) => ({
        title: subItem.title,
        href: subItem.href,
      })),
    };
  }

  /** Group sections by display title and merge items; add standalone links to "Campaign Tools". */
  const cards = $derived.by(() => {
    const byTitle = new Map<string, HomeItem[]>();

    for (const entry of landingSections) {
      const title = cardTitle(entry);
      const items = entry.children.map(toHomeItem);
      if (items.length === 0) continue;
      const existing = byTitle.get(title) ?? [];
      byTitle.set(title, [...existing, ...items]);
    }

    if (standaloneLinks.length > 0) {
      const existing = byTitle.get('Campaign Tools') ?? [];
      byTitle.set('Campaign Tools', [
        ...existing,
        ...standaloneLinks.map((link) => ({ title: link.title, href: link.href })),
      ]);
    }

    return [...byTitle.entries()].map(([title, items]) => ({ title, items }));
  });

  const storyCard = $derived(cards.find((card) => card.title === STORY_CARD_TITLE) ?? null);
  const storyPageCount = $derived(
    Math.max(1, Math.ceil((storyCard?.items.length ?? 0) / STORY_PAGE_SIZE)),
  );

  $effect(() => {
    if (storyPage > storyPageCount - 1) {
      storyPage = Math.max(0, storyPageCount - 1);
    }
  });

  $effect(() => {
    const firstStoryItem = storyCard?.items[0];
    if (!firstStoryItem || !firstStoryItem.sub?.length) return;
    const key = itemKey(STORY_CARD_TITLE, firstStoryItem);
    if (expandedItems[key] === undefined) {
      expandedItems[key] = true;
    }
  });

  function itemKey(cardTitle: string, item: HomeItem): string {
    return `${cardTitle}:${item.href}:${item.title}`;
  }

  function isExpanded(cardTitle: string, item: HomeItem): boolean {
    return Boolean(expandedItems[itemKey(cardTitle, item)]);
  }

  function toggleItem(cardTitle: string, item: HomeItem) {
    const key = itemKey(cardTitle, item);
    expandedItems[key] = !expandedItems[key];
  }

  function goToStoryPage(nextPage: number) {
    storyPage = Math.min(Math.max(nextPage, 0), storyPageCount - 1);
  }

  function itemsForCard(card: HomeCard): HomeItem[] {
    if (card.title !== STORY_CARD_TITLE) return card.items;
    const start = storyPage * STORY_PAGE_SIZE;
    return card.items.slice(start, start + STORY_PAGE_SIZE);
  }

  function pageLabel(): string {
    if (!storyCard || storyCard.items.length === 0) return 'Page 1 of 1';
    return `Page ${storyPage + 1} of ${storyPageCount}`;
  }
</script>

<div class="wiki-layout">
  <Header
    mode="wiki"
    branch={data.branch}
    defaultBranch={data.defaultBranch}
    branches={data.branches}
    branchLabels={data.branchLabels}
  />
  <WikiNav
    nav={data.nav}
    branch={data.branch}
    defaultBranch={data.defaultBranch}
    authenticated={Boolean(data.authenticated)}
  />

  <main class="wiki-main" data-testid="wiki-main">
    <div class="landing">
      <section class="hero">
        <p class="eyebrow">Campaign Wiki</p>
        <h1>Frozen Sick</h1>
        <p class="tagline">
          A D&amp;D chronicle of bounty hunters, cursed artifacts, and a city on fire.
        </p>
      </section>

      <div class="landing-grid">
        {#each cards as card (card.title)}
          <section class="card" aria-labelledby={'card-title-' + card.title}>
            <div class="card-header">
              <div>
                <h2 id={'card-title-' + card.title}>{card.title}</h2>
                {#if card.title === STORY_CARD_TITLE}
                  <p class="card-meta">{storyCard?.items.length ?? 0} chapter groups</p>
                {/if}
              </div>

              {#if card.title === STORY_CARD_TITLE}
                <div class="pagination">
                  <button
                    type="button"
                    class="page-button"
                    onclick={() => goToStoryPage(storyPage - 1)}
                    disabled={storyPage === 0}
                    aria-label="Previous chapter page"
                  >
                    <span aria-hidden="true">←</span>
                  </button>
                  <span class="page-status">{pageLabel()}</span>
                  <button
                    type="button"
                    class="page-button"
                    onclick={() => goToStoryPage(storyPage + 1)}
                    disabled={storyPage >= storyPageCount - 1}
                    aria-label="Next chapter page"
                  >
                    <span aria-hidden="true">→</span>
                  </button>
                </div>
              {/if}
            </div>

            <ul class="card-list">
              {#each itemsForCard(card) as item (itemKey(card.title, item))}
                <li class="card-item">
                  {#if item.sub && item.sub.length > 0}
                    <div class="parent-row">
                      <button
                        type="button"
                        class="toggle"
                        aria-expanded={isExpanded(card.title, item)}
                        aria-label={'Toggle ' + item.title}
                        onclick={() => toggleItem(card.title, item)}
                      >
                        <svg
                          class="chevron"
                          class:flipped={isExpanded(card.title, item)}
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                          width="12"
                          height="12"
                        >
                          <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                      </button>

                      <a href={item.href} class="primary-link">{item.title}</a>
                    </div>

                    {#if isExpanded(card.title, item)}
                      <ul class="sub-list">
                        {#each item.sub as subItem (subItem.href)}
                          <li>
                            <a href={subItem.href} class="sub-link">{subItem.title}</a>
                          </li>
                        {/each}
                      </ul>
                    {/if}
                  {:else}
                    <a href={item.href} class="primary-link leaf-link">{item.title}</a>
                  {/if}
                </li>
              {/each}
            </ul>
          </section>
        {/each}
      </div>
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
    padding: calc(56px + 1.4rem) clamp(1.5rem, 3vw, 3rem) 4rem;
  }

  .landing {
    max-width: 1180px;
    margin: 0 auto;
  }

  .hero {
    margin-bottom: 2rem;
    padding: 0.35rem 0 0.75rem;
  }

  .eyebrow {
    margin: 0 0 0.55rem;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--accent-light);
  }

  .hero h1 {
    margin: 0;
    font-size: clamp(2.3rem, 4vw, 3.35rem);
    line-height: 0.98;
  }

  .tagline {
    max-width: 44rem;
    margin: 0.85rem 0 0;
    font-size: clamp(1rem, 1.4vw, 1.2rem);
    line-height: 1.6;
    color: var(--text-muted);
  }

  .landing-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1.5rem;
    align-items: start;
  }

  .card {
    min-height: 100%;
    background: linear-gradient(180deg, color-mix(in srgb, var(--bg-card) 90%, transparent), var(--bg-card));
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 1.3rem 1.4rem 1.4rem;
    box-shadow: 0 18px 40px rgba(0, 0, 0, 0.12);
  }

  .card-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .card h2 {
    margin: 0;
    border: none;
    padding: 0;
    font-size: 1.2rem;
    line-height: 1.2;
  }

  .card-meta {
    margin: 0.3rem 0 0;
    font-size: 0.78rem;
    color: var(--text-muted);
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .card-list,
  .sub-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .card-list {
    display: grid;
    gap: 0.4rem;
  }

  .card-item {
    padding: 0.1rem 0;
  }

  .parent-row {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: start;
    gap: 0.45rem;
  }

  .toggle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.55rem;
    height: 1.55rem;
    margin-top: 0.05rem;
    border: 1px solid transparent;
    border-radius: 999px;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    transition:
      transform 0.16s ease,
      color 0.16s ease,
      border-color 0.16s ease,
      background 0.16s ease;
  }

  .toggle:hover {
    color: var(--text);
    border-color: var(--border);
    background: color-mix(in srgb, var(--bg-card) 75%, white 6%);
  }

  .chevron {
    transition: transform 0.16s ease;
  }

  .chevron.flipped {
    transform: rotate(180deg);
  }

  .primary-link,
  .sub-link {
    color: var(--link);
    text-decoration: none;
    transition: color 0.16s ease;
  }

  .primary-link:hover,
  .sub-link:hover {
    color: var(--accent-light);
  }

  .primary-link {
    display: inline-block;
    padding: 0.2rem 0;
    line-height: 1.45;
  }

  .leaf-link {
    padding-left: 2rem;
  }

  .sub-list {
    margin-top: 0.35rem;
    margin-left: 2rem;
    padding-left: 1rem;
    border-left: 1px solid color-mix(in srgb, var(--border) 84%, transparent);
    display: grid;
    gap: 0.2rem;
  }

  .sub-link {
    display: inline-block;
    padding: 0.18rem 0;
    font-size: 0.98rem;
    color: var(--text-muted);
  }

  .pagination {
    display: flex;
    align-items: center;
    gap: 0.65rem;
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .page-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2.3rem;
    height: 2.3rem;
    border: 1px solid var(--border);
    border-radius: 999px;
    background: color-mix(in srgb, var(--bg-card) 86%, white 5%);
    color: var(--text);
    font: inherit;
    padding: 0;
    cursor: pointer;
    transition:
      transform 0.16s ease,
      border-color 0.16s ease,
      color 0.16s ease,
      background 0.16s ease;
  }

  .page-button:hover:not(:disabled) {
    border-color: var(--accent-light);
    color: var(--accent-light);
    background: color-mix(in srgb, var(--bg-card) 72%, white 10%);
    transform: translateY(-1px);
  }

  .page-button:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .page-status {
    font-size: 0.78rem;
    color: var(--text);
    white-space: nowrap;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    padding: 0.15rem 0.55rem;
    border-radius: 999px;
    background: color-mix(in srgb, var(--bg-card) 72%, transparent);
    border: 1px solid color-mix(in srgb, var(--border) 88%, transparent);
  }

  @media (max-width: 1080px) {
    .landing-grid {
      grid-template-columns: minmax(0, 1fr);
    }
  }

  @media (max-width: 768px) {
    .wiki-main {
      margin-left: 0;
      padding: calc(56px + 1.1rem) 1rem 2.5rem;
    }

    .hero {
      margin-bottom: 1.5rem;
      padding-top: 0;
    }

    .card {
      padding: 1.1rem 1rem 1.15rem;
      border-radius: 12px;
    }

    .card-header {
      flex-direction: column;
      align-items: stretch;
    }

    .pagination {
      justify-content: flex-start;
    }
  }
</style>
