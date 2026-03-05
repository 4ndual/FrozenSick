<script lang="ts">
  import Header from '$lib/components/Header/Header.svelte';
  import WikiNav from '$lib/components/Header/WikiNav.svelte';
</script>

<div class="wiki-layout">
  <Header mode="wiki" />
  <WikiNav />

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
