<script lang="ts">
  import { WIKI_NAV, isSection, type NavItem, type NavSection } from '$lib/wiki-nav';
  import WikiEditBar from './WikiEditBar.svelte';
</script>

<div class="wiki-view">
  <nav id="wiki-sidebar" class="wiki-sidebar" aria-label="Wiki navigation">
    <div class="sidebar-header">
      <a href="/">Frozen Sick</a>
      <span class="sidebar-sub">Campaign Wiki</span>
      <WikiEditBar sourcePath={null} returnTo="/" />
    </div>
    <ul>
      {#each WIKI_NAV as entry (isSection(entry) ? (entry as NavSection).section : (entry as NavItem).href)}
        {#if isSection(entry)}
          <li>
            <span class="section-title">{(entry as NavSection).section}</span>
            <ul>
              {#each (entry as NavSection).children as child (child.href)}
                <li>
                  <a href={child.href} class:active={child.href === '/'}>{child.title}</a>
                  {#if child.sub}
                    <ul>
                      {#each child.sub as s (s.href)}
                        <li><a href={s.href}>{s.title}</a></li>
                      {/each}
                    </ul>
                  {/if}
                </li>
              {/each}
            </ul>
          </li>
        {:else}
          <li>
            <a href={entry.href} class:active={entry.href === '/'}>{entry.title}</a>
          </li>
        {/if}
      {/each}
    </ul>
  </nav>
  <main class="wiki-main">
    <div class="landing">
      <h1>Frozen Sick</h1>
      <p class="tagline">A D&D chronicle of bounty hunters, cursed artifacts, and a city on fire.</p>

      <div class="landing-grid">
        <div class="card">
          <h2>The Story So Far</h2>
          <p>Five chapters of chaos, from a humble tavern job gone wrong to a full-scale revolution.</p>
          <ul>
            <li><a href="/chapters/chapter-1-the-tavern/summary">Chapter 1 — The Tavern</a></li>
            <li><a href="/chapters/chapter-2-the-plateau/summary">Chapter 2 — The Plateau</a></li>
            <li><a href="/chapters/chapter-3-the-flying-turtle/summary">Chapter 3 — The Flying Turtle</a></li>
            <li><a href="/chapters/chapter-4-the-battle-of-brasboredon/summary">Chapter 4 — The Battle of Brasboredon</a></li>
            <li><a href="/chapters/chapter-5-the-escape-from-brasboredon/summary">Chapter 5 — The Escape from Brasboredon</a></li>
          </ul>
        </div>

        <div class="card">
          <h2>The Party</h2>
          <ul>
            <li><a href="/characters/tidus/story"><strong>Tidus</strong></a> — Rogue / Waiter. Val medallion bearer, prince-killer, bomb defuser.</li>
            <li><a href="/characters/nixira/story"><strong>Nixira</strong></a> — Bard / Cook. Fire ballista operator, rap battle champion, dwarf-cursed.</li>
            <li><a href="/characters/zacarias/story"><strong>Zacarías</strong></a> — Warlock / Guard. Dreamer, one-handed revolutionary.</li>
          </ul>
        </div>

        <div class="card">
          <h2>The World</h2>
          <ul>
            <li><a href="/world/lore">Lore</a> — Prophecies, artifacts, and ancient powers</li>
            <li><a href="/world/organizations">Organizations</a> — Factions pulling the strings</li>
            <li><a href="/world/places">Places</a> — From La Última Gota to Brasboredon</li>
          </ul>
        </div>

        <div class="card">
          <h2>Campaign Tools</h2>
          <ul>
            <li><a href="/plot/tracker">Plot Tracker</a> — Active quests, loose ends, mysteries</li>
            <li><a href="/relations">Relations</a> — Character & faction diagrams</li>
            <li><a href="/characters/npcs">NPCs</a> — Every face the party has met</li>
            <li><a href="/timeline/">⟳ Timeline</a> — Interactive campaign timeline & event graph</li>
          </ul>
        </div>
      </div>
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
    .wiki-sidebar {
      transform: translateX(-100%);
    }
    .wiki-main {
      margin-left: 0;
      padding: 2rem 1.25rem;
    }
  }
</style>
