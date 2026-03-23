<script lang="ts">
  import { browser } from '$app/environment';
  import { onMount } from 'svelte';
  import type { OrganizationGroup } from '$lib/world-organizations';

  interface Props {
    groups: OrganizationGroup[];
  }

  let { groups }: Props = $props();

  type ImageState = Record<string, string>;

  const STORAGE_KEY = 'frozen-sick-world-org-images-v1';
  let imageState = $state<ImageState>({});
  let fileInputs = $state<Record<string, HTMLInputElement | null>>({});
  let filterQuery = $state('');

  const filteredGroups = $derived.by(() =>
    groups
      .map((group) => ({
        ...group,
        organizations: group.organizations.filter(matchesOrganizationFilter),
      }))
      .filter((group) => group.organizations.length > 0),
  );

  onMount(() => {
    if (!browser) return;
    try {
      imageState = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as ImageState;
    } catch {
      imageState = {};
    }
  });

  function persist(next: ImageState): void {
    imageState = next;
    if (!browser) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  function promptUpload(id: string): void {
    fileInputs[id]?.click();
  }

  function clearImage(id: string): void {
    const next = { ...imageState };
    delete next[id];
    persist(next);
    if (fileInputs[id]) fileInputs[id]!.value = '';
  }

  function handleFileChange(id: string, event: Event): void {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (!result) return;
      persist({ ...imageState, [id]: result });
    };
    reader.readAsDataURL(file);
  }

  function normalizeValue(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  function matchesOrganizationFilter(group: OrganizationGroup['organizations'][number]): boolean {
    const query = normalizeValue(filterQuery);
    if (!query) return true;

    const haystack = [
      group.name,
      group.type,
      group.base,
      group.summary,
      ...(group.aliases ?? []),
      ...group.members.flatMap((member) => [member.name, member.role, member.status]),
    ]
      .join(' ')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

    return haystack.includes(query);
  }
</script>

<section class="org-gallery" aria-label="Organization heraldry and structure">
  <div class="org-filter-bar">
    <label class="org-filter-shell">
      <span>Filter organizations by person or term</span>
      <input
        type="search"
        class="org-filter-input"
        placeholder="Search by person, organization, alias, or role"
        bind:value={filterQuery}
        aria-label="Filter organizations"
      />
    </label>
  </div>

  {#each filteredGroups as group (group.id)}
    <div class="org-group">
      <div class="org-group-head">
        <h2>{group.title}</h2>
        <p>{group.description}</p>
      </div>

      <div class="org-grid">
        {#each group.organizations as org (org.id)}
          <article class="org-row">
            <div class="org-media-column">
              <div class="org-media-frame">
                {#if imageState[org.id]}
                  <img src={imageState[org.id]} alt={`Heraldry for ${org.name}`} />
                {:else}
                  <div class="org-placeholder">
                    <span>Logo / banner</span>
                    <small>Add heraldry for this organization</small>
                  </div>
                {/if}
              </div>

              <div class="org-media-actions">
                <input
                  type="file"
                  accept="image/*"
                  bind:this={fileInputs[org.id]}
                  class="file-input"
                  oninput={(event) => handleFileChange(org.id, event)}
                />
                <button type="button" class="org-btn" onclick={() => promptUpload(org.id)}>
                  {imageState[org.id] ? 'Upload / Change' : 'Upload'}
                </button>
                <button
                  type="button"
                  class="org-btn org-btn-muted"
                  onclick={() => clearImage(org.id)}
                  disabled={!imageState[org.id]}
                >
                  Remove
                </button>
              </div>

              <p class="org-media-help">Use a logo, sigil, or banner in landscape format.</p>
            </div>

            <div class="org-content-column">
              <div class="org-copy">
                <span class="org-type">{org.type}</span>
                <h3>{org.name}</h3>
                <p class="org-summary">{org.summary}</p>
              </div>

              <div class="org-details-grid">
                <div class="org-information">
                  <div class="org-panel-head">Organization Information</div>
                  <div class="org-info-grid">
                    <div class="org-info-item">
                      <span class="org-info-label">Type</span>
                      <span class="org-info-value">{org.type}</span>
                    </div>
                    <div class="org-info-item">
                      <span class="org-info-label">Base</span>
                      <span class="org-info-value">{org.base}</span>
                    </div>
                    {#if org.aliases && org.aliases.length > 0}
                      <div class="org-info-item org-info-item-full">
                        <span class="org-info-label">Aliases</span>
                        <span class="org-info-value">{org.aliases.join(', ')}</span>
                      </div>
                    {/if}
                  </div>
                </div>

                <div class="org-members">
                  <div class="org-members-head">Known Members</div>
                  <ul>
                    {#each org.members as member (`${org.id}:${member.name}`)}
                      <li>
                        <span class="member-name">{member.name}</span>
                        <span class="member-role">{member.role}</span>
                        <span class="member-status">{member.status}</span>
                      </li>
                    {/each}
                  </ul>
                </div>
              </div>
            </div>
          </article>
        {/each}
      </div>
    </div>
  {/each}
</section>

<style>
  .org-gallery {
    display: grid;
    gap: 1.1rem;
  }

  .org-filter-bar {
    position: sticky;
    top: calc(56px + 1rem);
    z-index: 5;
  }

  .org-filter-shell {
    display: grid;
    gap: 0.45rem;
    padding: 0.8rem 0.95rem;
    border: 1px solid var(--border);
    border-radius: 14px;
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.02));
  }

  .org-filter-shell span {
    font-size: 0.74rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--accent-light);
  }

  .org-filter-input {
    width: 100%;
    min-height: 2.7rem;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.03);
    color: var(--text);
    padding: 0.6rem 0.8rem;
  }

  .org-filter-input::placeholder {
    color: var(--text-dim);
  }

  .org-group {
    display: grid;
    gap: 0.75rem;
  }

  .org-group-head {
    display: grid;
    gap: 0.35rem;
  }

  .org-group-head h2 {
    margin: 0;
    font-size: clamp(1.15rem, 2vw, 1.5rem);
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }

  .org-group-head p {
    margin: 0;
    color: var(--text-muted);
  }

  .org-grid {
    display: grid;
    gap: 0.85rem;
  }

  .org-row {
    display: grid;
    grid-template-columns: 220px minmax(0, 1fr);
    gap: 1rem;
    align-items: start;
    border: 1px solid var(--border);
    border-radius: 18px;
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.015));
    padding: 0.95rem 1rem;
  }

  .org-media-column {
    display: grid;
    gap: 0.7rem;
    align-items: start;
  }

  .org-type {
    display: inline-flex;
    margin-bottom: 0.35rem;
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--gold);
  }

  .org-copy {
    display: grid;
    gap: 0.55rem;
  }

  .org-copy h3 {
    margin: 0;
    font-size: clamp(1.25rem, 2vw, 1.55rem);
  }

  .org-summary {
    margin: 0;
    color: var(--text-muted);
  }

  .org-content-column {
    display: grid;
    gap: 0.85rem;
  }

  .org-media-frame {
    aspect-ratio: 16 / 10;
    border: 1px solid var(--border);
    border-radius: 14px;
    overflow: hidden;
    background:
      radial-gradient(circle at top, rgba(212, 175, 55, 0.12), transparent 55%),
      linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.02));
  }

  .org-media-frame img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .org-placeholder {
    height: 100%;
    display: grid;
    place-items: center;
    text-align: center;
    padding: 1rem;
    gap: 0.35rem;
    color: var(--text-muted);
  }

  .org-placeholder span {
    font-family: 'Cinzel', serif;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--accent-light);
  }

  .org-media-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem;
  }

  .org-media-help {
    margin: 0;
    font-size: 0.72rem;
    color: var(--text-dim);
    line-height: 1.35;
  }

  .file-input {
    display: none;
  }

  .org-btn {
    border: 1px solid rgba(212, 175, 55, 0.35);
    background: rgba(212, 175, 55, 0.08);
    color: var(--gold);
    border-radius: 10px;
    padding: 0.5rem 0.65rem;
    cursor: pointer;
    font-size: 0.82rem;
  }

  .org-btn:hover {
    border-color: rgba(212, 175, 55, 0.55);
    background: rgba(212, 175, 55, 0.12);
  }

  .org-btn-muted {
    border-color: var(--border);
    background: rgba(255, 255, 255, 0.03);
    color: var(--text-muted);
  }

  .org-btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .org-details-grid {
    display: grid;
    grid-template-columns: minmax(240px, 0.85fr) minmax(0, 1.35fr);
    gap: 0.85rem;
    align-items: start;
  }

  .org-information,
  .org-members {
    border: 1px solid color-mix(in srgb, var(--border) 90%, transparent);
    border-radius: 14px;
    padding: 0.8rem 0.9rem;
    background: rgba(255, 255, 255, 0.02);
  }

  .org-panel-head,
  .org-members-head {
    font-size: 0.74rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--accent-light);
    margin-bottom: 0.6rem;
  }

  .org-info-grid {
    display: grid;
    gap: 0.6rem;
  }

  .org-info-item {
    display: grid;
    gap: 0.15rem;
    padding: 0.55rem 0.6rem;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid color-mix(in srgb, var(--border) 88%, transparent);
  }

  .org-info-item-full {
    min-height: 100%;
  }

  .org-info-label {
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--gold);
  }

  .org-info-value {
    color: var(--text-muted);
    line-height: 1.45;
  }

  .org-members ul {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: 0.65rem;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .org-members li {
    display: grid;
    gap: 0.18rem;
    padding: 0.62rem 0.7rem;
    border-radius: 12px;
    border: 1px solid color-mix(in srgb, var(--border) 88%, transparent);
    background: rgba(255, 255, 255, 0.03);
  }

  .member-name {
    font-weight: 600;
  }

  .member-role,
  .member-status {
    font-size: 0.84rem;
    color: var(--text-muted);
  }

  @media (max-width: 768px) {
    .org-filter-bar {
      position: static;
    }

    .org-row {
      grid-template-columns: 1fr;
    }

    .org-details-grid {
      grid-template-columns: 1fr;
    }

    .org-media-actions {
      grid-template-columns: 1fr;
    }

    .org-members ul {
      grid-template-columns: 1fr;
    }
  }
</style>
