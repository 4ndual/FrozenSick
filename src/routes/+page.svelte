<script lang="ts">
  import Header from '$lib/components/Header/Header.svelte';
  import WikiNav from '$lib/components/Header/WikiNav.svelte';
  import { isSection, type NavItem, type NavSection } from '$lib/wiki-nav';

  let { data } = $props();

  /** Card title mapping: section key (from repo) → display title on home */
  const SECTION_TITLES: Record<string, string> = {
    chapters: 'The Story So Far',
    characters: 'The Party',
    world: 'The World',
    plot: 'Campaign Tools',
    relations: 'Campaign Tools',
  };

  /** Nav entries that are sections (have children), for landing cards. */
  const landingSections = $derived(
    data.nav.filter((e): e is NavSection => isSection(e))
  );

  /** Single nav links (e.g. Timeline) to show in a tools card. */
  const standaloneLinks = $derived(
    data.nav.filter((e): e is NavItem => !isSection(e) && e.href !== '/')
  );

  function cardTitle(entry: NavSection): string {
    const key = entry.section.toLowerCase();
    return SECTION_TITLES[key] ?? entry.section;
  }

  function cardLinks(entry: NavSection): { href: string; title: string }[] {
    return entry.children.flatMap((child) => {
      const main = { href: child.href, title: child.title };
      const sub = (child.sub ?? []).map((s) => ({ href: s.href, title: s.title }));
      return [main, ...sub];
    });
  }

  /** Group sections by display title and merge links; add standalone links to "Campaign Tools". */
  const cards = $derived.by(() => {
    const byTitle = new Map<string, { href: string; title: string }[]>();
    for (const entry of landingSections) {
      const title = cardTitle(entry);
      const links = cardLinks(entry);
      if (links.length === 0) continue;
      const existing = byTitle.get(title) ?? [];
      byTitle.set(title, [...existing, ...links]);
    }
    if (standaloneLinks.length > 0) {
      const existing = byTitle.get('Campaign Tools') ?? [];
      byTitle.set('Campaign Tools', [
        ...existing,
        ...standaloneLinks.map((l) => ({ href: l.href, title: l.title })),
      ]);
    }
    return [...byTitle.entries()].map(([title, links]) => ({ title, links }));
  });
</script>

<div class="wiki-layout">
  <Header
    mode="wiki"
    branch={data.branch}
    defaultBranch={data.defaultBranch}
    branches={data.branches}
  />
  <WikiNav nav={data.nav} branch={data.branch} defaultBranch={data.defaultBranch} />

  <main class="wiki-main" data-testid="wiki-main">
    <div class="landing">
      <h1>Frozen Sick</h1>
      <p class="tagline">A D&D chronicle of bounty hunters, cursed artifacts, and a city on fire.</p>

      <div class="landing-grid">
        {#each cards as { title, links } (title)}
          <div class="card">
            <h2>{title}</h2>
            <ul>
              {#each links as link (link.href)}
                <li><a href={link.href}>{link.title}</a></li>
              {/each}
            </ul>
          </div>
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
    padding: 2.5rem 3rem 4rem;
    max-width: 920px;
    padding-top: calc(56px + 2.5rem);
  }

  .landing {
    padding-top: 0.5rem;
  }

  .tagline {
    font-size: 1.1rem;
    color: var(--text-muted);
    margin-bottom: 2rem;
  }

  .landing-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1.5rem;
  }

  .card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 1.25rem 1.5rem;
  }

  .card h2 {
    font-size: 1.15rem;
    margin-top: 0;
    margin-bottom: 0.75rem;
    border: none;
    padding: 0;
  }

  .card ul {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .card li {
    margin: 0.4rem 0;
  }

  .card a {
    color: var(--link);
    text-decoration: none;
  }

  .card a:hover {
    color: var(--accent-light);
  }

  @media (max-width: 768px) {
    .wiki-main {
      margin-left: 0;
      padding: 2rem 1.25rem;
      padding-top: calc(56px + 4rem);
    }
  }
</style>
