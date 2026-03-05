<script lang="ts">
  import { campaign } from '$lib/store/campaign.svelte';
  import { generateId } from '$lib/utils/storage';
  import type { CalendarConfig } from '$lib/types/schema';

  let draft = $state<CalendarConfig>($state.snapshot(campaign.data.calendar) as CalendarConfig);
  let saved = $state(false);

  function addMonth() {
    draft.months.push({ id: generateId(), name: 'New Month', days: 30 });
  }

  function removeMonth(i: number) {
    if (draft.months.length <= 1) return;
    draft.months.splice(i, 1);
  }

  function moveMonth(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= draft.months.length) return;
    [draft.months[i], draft.months[j]] = [draft.months[j], draft.months[i]];
  }

  function totalDaysPerYear() {
    return draft.months.reduce((s, m) => s + m.days, 0);
  }

  function save() {
    campaign.updateCalendar($state.snapshot(draft) as CalendarConfig);
    saved = true;
    setTimeout(() => { saved = false; }, 2000);
  }

  function reset() {
    if (confirm('Reset calendar to last saved state?')) {
      draft = $state.snapshot(campaign.data.calendar) as CalendarConfig;
    }
  }
</script>

<div class="settings-section">
  <div class="section-header">
    <h3>Custom Calendar</h3>
    <p class="section-desc">
      Define your campaign's calendar system. This affects how all event dates are displayed and arranged on the timeline.
    </p>
  </div>

  <div class="form-grid">
    <div class="field">
      <label for="cal-name">Calendar Name</label>
      <input id="cal-name" bind:value={draft.name} placeholder="Calendar of Harptos" />
    </div>
    <div class="field">
      <label for="cal-suffix">Year Suffix / Era</label>
      <input id="cal-suffix" bind:value={draft.yearSuffix} placeholder="DR" style="max-width:80px" />
    </div>
    <div class="field">
      <label for="cal-epoch">Starting Epoch Year</label>
      <input id="cal-epoch" type="number" bind:value={draft.epoch} style="max-width:100px" />
    </div>
    <div class="field">
      <label for="cal-weekname">Week Name</label>
      <input id="cal-weekname" bind:value={draft.weekName} placeholder="Tenday" style="max-width:120px" />
    </div>
    <div class="field">
      <label for="cal-weeklen">Days per Week</label>
      <input id="cal-weeklen" type="number" bind:value={draft.weekLength} min="1" max="30" style="max-width:80px" />
    </div>
  </div>

  <div class="months-section">
    <div class="months-header">
      <span class="months-title">Months ({draft.months.length} months · {totalDaysPerYear()} days/year)</span>
      <button class="btn-secondary" onclick={addMonth}>+ Add Month</button>
    </div>

    <div class="months-list">
      <div class="month-row month-row-header">
        <span style="width:28px">#</span>
        <span style="flex:1">Month Name</span>
        <span style="width:120px">Station / Color</span>
        <span style="width:80px">Days</span>
        <span style="width:80px">Order</span>
        <span style="width:32px"></span>
      </div>
      {#each draft.months as month, i}
        <div class="month-row">
          <span class="month-num">{i + 1}</span>
          <input class="month-name" bind:value={month.name} placeholder="Month name" />
          <div class="month-station">
            <span
              class="month-swatch"
              style="background: {month.color ?? 'var(--surface-3)'}; border: 1px solid var(--border);"
              title={month.station ?? month.name}
            ></span>
            <span class="month-station-text">{month.station ?? '—'}</span>
          </div>
          <input
            type="number"
            class="month-days"
            bind:value={month.days}
            min="1"
            max="99"
          />
          <div class="month-order">
            <button onclick={() => moveMonth(i, -1)} disabled={i === 0} title="Move up">▲</button>
            <button onclick={() => moveMonth(i, 1)} disabled={i === draft.months.length - 1} title="Move down">▼</button>
          </div>
          <button
            class="month-remove"
            onclick={() => removeMonth(i)}
            disabled={draft.months.length <= 1}
            title="Remove month"
          >✕</button>
        </div>
      {/each}
    </div>
  </div>

  <div class="save-row">
    <button class="btn-ghost" onclick={reset}>Reset</button>
    <button class="btn-primary" onclick={save}>
      {saved ? '✓ Saved!' : 'Save Calendar'}
    </button>
  </div>
</div>

<style>
  .settings-section {
    max-width: 680px;
  }

  .section-header {
    margin-bottom: 20px;
  }

  h3 {
    margin: 0 0 6px;
    font-size: 18px;
    color: var(--gold);
  }

  .section-desc {
    margin: 0;
    font-size: 14px;
    color: var(--text-muted);
    font-style: italic;
  }

  .form-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 14px;
    margin-bottom: 24px;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  label {
    font-size: 11px;
    font-family: 'Cinzel', serif;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
  }

  .months-section {
    margin-bottom: 20px;
  }

  .months-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
  }

  .months-title {
    font-family: 'Cinzel', serif;
    font-size: 14px;
    color: var(--text);
  }

  .months-list {
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: 6px;
    overflow: hidden;
  }

  .month-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 10px;
    border-bottom: 1px solid var(--border);
  }
  .month-row:last-child { border-bottom: none; }

  .month-row-header {
    background: var(--surface-3);
    font-size: 11px;
    font-family: 'Cinzel', serif;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--text-dim);
    padding: 6px 10px;
  }

  .month-num {
    width: 28px;
    font-size: 12px;
    color: var(--text-dim);
    text-align: center;
    flex-shrink: 0;
  }

  .month-name {
    flex: 1;
  }

  .month-station {
    width: 120px;
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }
  .month-swatch {
    width: 14px;
    height: 14px;
    border-radius: 3px;
    flex-shrink: 0;
  }
  .month-station-text {
    font-size: 11px;
    color: var(--text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .month-days {
    width: 80px;
    flex-shrink: 0;
  }

  .month-order {
    width: 80px;
    display: flex;
    gap: 4px;
    flex-shrink: 0;
  }

  .month-order button {
    flex: 1;
    background: var(--surface-3);
    border: 1px solid var(--border);
    color: var(--text-muted);
    border-radius: 3px;
    padding: 3px 0;
    font-size: 11px;
  }
  .month-order button:not(:disabled):hover { color: var(--text); border-color: var(--border-bright); }
  .month-order button:disabled { opacity: 0.3; cursor: not-allowed; }

  .month-remove {
    width: 32px;
    background: none;
    border: none;
    color: var(--text-dim);
    font-size: 14px;
    border-radius: 3px;
    padding: 3px;
    flex-shrink: 0;
  }
  .month-remove:not(:disabled):hover { color: var(--battle); }
  .month-remove:disabled { opacity: 0.2; cursor: not-allowed; }

  .save-row {
    display: flex;
    gap: 10px;
    justify-content: flex-end;
  }

  .btn-secondary {
    background: none;
    border: 1px solid var(--gold-dim);
    color: var(--gold-dim);
    border-radius: 4px;
    padding: 6px 12px;
    font-size: 13px;
    font-family: 'Cinzel', serif;
  }
  .btn-secondary:hover { background: var(--gold-glow); color: var(--gold); }

  .btn-ghost {
    background: none;
    border: 1px solid var(--border);
    color: var(--text-muted);
    border-radius: 4px;
    padding: 7px 14px;
    font-size: 13px;
  }
  .btn-ghost:hover { border-color: var(--border-bright); color: var(--text); }

  .btn-primary {
    background: var(--gold-dim);
    border: none;
    color: #fff;
    border-radius: 4px;
    padding: 7px 18px;
    font-size: 13px;
    font-family: 'Cinzel', serif;
    letter-spacing: 0.03em;
  }
  .btn-primary:hover { background: var(--gold); color: #0d0d1a; }
</style>
