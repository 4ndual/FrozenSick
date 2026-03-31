<script lang="ts">
  import { onMount, tick } from 'svelte';

  export interface EntityDropdownOption {
    value: string;
    label: string;
  }

  interface Props {
    label: string;
    options: EntityDropdownOption[];
    selectedValues: string[];
    onChange: (nextValues: string[]) => void;
    testIdBase: string;
    placeholder?: string;
    searchPlaceholder?: string;
    multi?: boolean;
    allowCreate?: boolean;
    disabled?: boolean;
    compact?: boolean;
  }

  let {
    label,
    options,
    selectedValues,
    onChange,
    testIdBase,
    placeholder = 'Select…',
    searchPlaceholder = 'Type to search…',
    multi = false,
    allowCreate = false,
    disabled = false,
    compact = false,
  }: Props = $props();

  let open = $state(false);
  let query = $state('');
  let activeIndex = $state(0);
  let searchInputEl = $state<HTMLInputElement | null>(null);
  let rootEl = $state<HTMLDivElement | null>(null);

  const dropdownId = $derived(`${testIdBase}-dropdown`);
  const sourceId = $derived(`${testIdBase}-instance`);

  function normalize(value: string): string {
    return value.trim().toLowerCase();
  }

  function slugify(value: string): string {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  const selectedSet = $derived(new Set(selectedValues));

  const visibleOptions = $derived.by<EntityDropdownOption[]>(() => {
    const q = normalize(query);
    if (!q) return options;
    return options.filter((opt) => normalize(opt.label).includes(q));
  });

  const canCreate = $derived.by<boolean>(() => {
    if (!allowCreate) return false;
    const trimmed = query.trim();
    if (!trimmed) return false;
    const q = normalize(trimmed);
    return !options.some((opt) => normalize(opt.label) === q || normalize(opt.value) === q);
  });

  const createOption = $derived.by<EntityDropdownOption | null>(() =>
    canCreate ? { value: query.trim(), label: query.trim() } : null,
  );

  const keyboardOptions = $derived.by<EntityDropdownOption[]>(() => {
    const list = [...visibleOptions];
    if (createOption) list.push(createOption);
    return list;
  });

  const summaryLabel = $derived.by<string>(() => {
    if (!selectedValues.length) return placeholder;
    const selectedOptions = selectedValues.map((value) => {
      const match = options.find((opt) => opt.value === value);
      return match?.label ?? value;
    });
    if (!multi) return selectedOptions[0] ?? placeholder;
    if (selectedOptions.length <= 2) return selectedOptions.join(', ');
    return `${selectedOptions[0]}, ${selectedOptions[1]} +${selectedOptions.length - 2}`;
  });

  function announceOpenState(nextOpen: boolean) {
    if (!nextOpen || typeof window === 'undefined') return;
    window.dispatchEvent(
      new CustomEvent('entity-dropdown-open', {
        detail: { source: sourceId },
      }),
    );
  }

  async function toggleOpen() {
    if (disabled) return;
    open = !open;
    announceOpenState(open);
    if (open) {
      query = '';
      activeIndex = 0;
      await tick();
      searchInputEl?.focus();
    }
  }

  function close() {
    open = false;
    query = '';
    activeIndex = 0;
  }

  function selectOption(option: EntityDropdownOption) {
    if (!option.value.trim()) return;
    if (multi) {
      if (selectedSet.has(option.value)) {
        onChange(selectedValues.filter((val) => val !== option.value));
      } else {
        onChange([...selectedValues, option.value]);
      }
      query = '';
      activeIndex = 0;
      return;
    }
    onChange([option.value]);
    close();
  }

  function clearSelection() {
    onChange([]);
  }

  function moveActive(delta: number) {
    const list = keyboardOptions;
    if (!list.length) return;
    const next = activeIndex + delta;
    if (next < 0) {
      activeIndex = list.length - 1;
      return;
    }
    if (next >= list.length) {
      activeIndex = 0;
      return;
    }
    activeIndex = next;
  }

  function onSearchKeydown(event: KeyboardEvent) {
    if (!open) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveActive(1);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveActive(-1);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const item = keyboardOptions[activeIndex];
      if (item) selectOption(item);
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    }
  }

  onMount(() => {
    const onOverlayOpen = (event: Event) => {
      const source = (event as CustomEvent<{ source?: string }>).detail?.source;
      if (source && source !== sourceId) {
        close();
      }
    };

    const onDocumentPointerDown = (event: Event) => {
      if (!open) return;
      const target = event.target as Node | null;
      if (!target) return;
      if (rootEl?.contains(target)) return;
      close();
    };

    window.addEventListener('entity-dropdown-open', onOverlayOpen as EventListener);
    document.addEventListener('pointerdown', onDocumentPointerDown);
    return () => {
      window.removeEventListener('entity-dropdown-open', onOverlayOpen as EventListener);
      document.removeEventListener('pointerdown', onDocumentPointerDown);
    };
  });
</script>

<div class="entity-dropdown" bind:this={rootEl}>
  <button
    type="button"
    class="selector"
    class:compact
    onclick={toggleOpen}
    disabled={disabled}
    aria-expanded={open}
    aria-haspopup="listbox"
    aria-controls={dropdownId}
    aria-label={label}
    data-testid="{testIdBase}-selector"
  >
    <span class="selector-label">{summaryLabel}</span>
    <span class="selector-chevron" aria-hidden="true">▾</span>
  </button>

  {#if open}
    <div
      id={dropdownId}
      class="menu"
      role="listbox"
      aria-label={label}
      data-testid="{testIdBase}-dropdown"
    >
      <div class="menu-controls">
        <input
          bind:this={searchInputEl}
          class="menu-search"
          type="text"
          bind:value={query}
          placeholder={searchPlaceholder}
          onkeydown={onSearchKeydown}
          data-testid="{testIdBase}-search"
        />
        {#if selectedValues.length > 0}
          <button
            type="button"
            class="clear-btn"
            onclick={clearSelection}
            aria-label="Clear selected values"
            data-testid="{testIdBase}-clear"
          >
            Clear
          </button>
        {/if}
      </div>

      <div class="menu-options">
        {#if keyboardOptions.length === 0}
          <div class="empty" data-testid="{testIdBase}-empty">No options</div>
        {:else}
          {#each keyboardOptions as option, idx (`${option.value}-${idx}`)}
            {@const selected = selectedSet.has(option.value)}
            <button
              type="button"
              class="option"
              class:active={idx === activeIndex}
              class:selected
              role="option"
              aria-selected={selected}
              onclick={() => selectOption(option)}
              data-testid="{testIdBase}-option-{slugify(option.value)}"
            >
              <span>{option.label}</span>
              {#if selected}
                <span class="check" aria-hidden="true">✓</span>
              {/if}
              {#if createOption && option.value === createOption.value}
                <span class="create-pill" aria-hidden="true">new</span>
              {/if}
            </button>
          {/each}
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .entity-dropdown {
    position: relative;
  }

  .selector {
    width: 100%;
    min-height: 36px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    text-align: left;
  }

  .selector.compact {
    min-height: 30px;
    font-size: 12px;
  }

  .selector-label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .selector-chevron {
    flex-shrink: 0;
    opacity: 0.7;
  }

  .menu {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    right: 0;
    z-index: 240;
    background: var(--surface);
    border: 1px solid var(--border-bright);
    border-radius: 6px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
    padding: 6px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .menu-controls {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .menu-search {
    flex: 1;
    min-height: 30px;
  }

  .clear-btn {
    min-height: 30px;
    padding: 4px 8px;
    border-radius: 4px;
    background: none;
    border: 1px solid var(--border);
    color: var(--text-muted);
    font-size: 12px;
  }

  .clear-btn:hover {
    border-color: var(--border-bright);
    color: var(--text);
  }

  .menu-options {
    max-height: 220px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .empty {
    padding: 8px;
    font-size: 12px;
    color: var(--text-dim);
    font-style: italic;
  }

  .option {
    width: 100%;
    border: 1px solid transparent;
    border-radius: 4px;
    padding: 6px 8px;
    background: var(--surface-2);
    color: var(--text-muted);
    display: flex;
    align-items: center;
    gap: 6px;
    text-align: left;
  }

  .option:hover,
  .option.active {
    border-color: var(--border-bright);
    color: var(--text);
  }

  .option.selected {
    border-color: var(--gold-dim);
    color: var(--gold-dim);
  }

  .check {
    margin-left: auto;
    font-size: 11px;
  }

  .create-pill {
    margin-left: auto;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--text-dim);
  }

</style>
