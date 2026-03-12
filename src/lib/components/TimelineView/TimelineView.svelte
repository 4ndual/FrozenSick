<script lang="ts">
  import { onMount, onDestroy, untrack } from 'svelte';
  import { Timeline } from 'vis-timeline/standalone';
  import { DataSet } from 'vis-data';
  import 'vis-timeline/styles/vis-timeline-graph2d.min.css';
  import { campaign } from '$lib/store/campaign.svelte';
  import { daysPerYear, formatDate, dateToDay, timestampToDate, isValidDate } from '$lib/utils/calendar';
  import type { CampaignEvent, CalendarConfig, FantasyDate, TimelineRangePreset } from '$lib/types/schema';

  const DAY_MS = 86400 * 1000;
  const RANGE_PRESETS: Array<{ id: TimelineRangePreset; label: string }> = [
    { id: 'day', label: 'Dia' },
    { id: 'decana', label: 'Decana' },
    { id: 'month', label: 'Mes' },
    { id: 'year', label: 'Año' },
    { id: '5y', label: '5 Años' },
    { id: '20y', label: '20 Años' },
    { id: '100y', label: '100 Años' },
    { id: '500y', label: '500 Años' },
  ];

  // ── Date mapping ──────────────────────────────────────────────────────────
  function toJSDate(date: FantasyDate, cal: CalendarConfig): Date {
    if (cal.months.length === 12) return new Date(date.year, date.month - 1, date.day);
    const dayNum = dateToDay(date, cal);
    const yearLen = daysPerYear(cal);
    const yearFrac = ((dayNum % yearLen) + yearLen) % yearLen / yearLen;
    const yr = cal.epoch + Math.floor(dayNum / yearLen);
    const jsMonth = Math.floor(yearFrac * 12);
    const jsDay = Math.max(1, Math.floor((yearFrac * 12 - jsMonth) * 30));
    return new Date(yr, jsMonth, jsDay);
  }

  // vis-timeline standalone passes moment objects to format callbacks
  function dy(d: any): number { return typeof d.year === 'function' ? d.year() : d.getFullYear(); }
  function dm(d: any): number { return typeof d.month === 'function' ? d.month() : d.getMonth(); }
  function dd(d: any): number { return typeof d.date === 'function' ? d.date() : d.getDate(); }

  // Type emoji icons — safe text, no SVG needed
  const TYPE_EMOJI: Record<string, string> = {
    'swords': '⚔', 'search': '🔍', 'user': '👤',
    'scroll-text': '📜', 'book-open': '📖', 'map-pin': '📍', 'moon': '🌙',
    'shield': '🛡', 'skull': '💀', 'flame': '🔥', 'star': '⭐', 'crown': '👑',
  };

  function typeIcon(typeId: string): string {
    const et = campaign.eventTypes.find((e) => e.id === typeId);
    return et?.icon ?? 'scroll-text';
  }

  function typeColor(typeId: string): string {
    const et = campaign.eventTypes.find((e) => e.id === typeId);
    return et?.color ?? '#888';
  }

  function escAttr(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }

  function buildItemContent(ev: CampaignEvent): string {
    const icon = ev.icon ?? typeIcon(ev.type);
    const emoji = TYPE_EMOJI[icon] ?? '•';
    const inner = `<span class="tl-icon-em">${emoji}</span><span class="tl-title">${escAttr(ev.title)}</span>${ev.secret ? '<span class="tl-secret"> 🔒</span>' : ''}`;
    return `<div role="listitem" aria-label="${escAttr(ev.title)}" data-testid="timeline-event-${escAttr(ev.id)}">${inner}</div>`;
  }

  function buildTooltipText(ev: any): string {
    const cal = $state.snapshot(campaign.data.calendar);
    const dateStr = formatDate(ev.date, cal);
    const desc = ev.description ? ' — ' + ev.description.slice(0, 100) + (ev.description.length > 100 ? '…' : '') : '';
    return `${ev.title} · ${dateStr}${desc}`;
  }

  function buildItems() {
    const cal = $state.snapshot(campaign.data.calendar);
    const events = $state.snapshot(campaign.filteredEvents);
    return events.map((ev: any) => {
      const color = ev.color ?? typeColor(ev.type);
      return {
        id: ev.id,
        group: ev.timelineId,
        content: buildItemContent(ev),
        className: `type-${ev.type}`,
        style: { borderLeftColor: color },
        start: toJSDate(ev.date, cal),
        ...(ev.endDate ? { end: toJSDate(ev.endDate, cal), type: 'range' } : { type: 'point' }),
        title: buildTooltipText(ev),
        editable: false,
        selectable: true,
      };
    });
  }

  function buildGroups() {
    const timelines = $state.snapshot(campaign.data.timelines);
    return timelines
      .slice().sort((a: any, b: any) => a.order - b.order)
      .map((t: any) => ({ id: t.id, content: t.name, title: t.description ?? '' }));
  }

  function buildFormatOpts() {
    return {
      minorLabels: (date: any, scale: string) => {
        const cal = campaign.data.calendar;
        if (scale === 'day' || scale === 'weekday') return String(dd(date));
        if (scale === 'month') return cal.months[dm(date)]?.name.slice(0, 3) ?? String(dm(date) + 1);
        if (scale === 'year') return `${dy(date)} ${cal.yearSuffix}`;
        return '';
      },
      majorLabels: (date: any, scale: string) => {
        const cal = campaign.data.calendar;
        if (scale === 'day' || scale === 'weekday') return `${cal.months[dm(date)]?.name ?? ''}, ${dy(date)} ${cal.yearSuffix}`;
        return `${dy(date)} ${cal.yearSuffix}`;
      },
    };
  }

  let container: HTMLDivElement;
  let toolbarRangeWrap: HTMLDivElement | undefined;
  let timeline: Timeline | undefined;
  let itemsDs: DataSet<any> | undefined;
  let groupsDs: DataSet<any> | undefined;
  let rangeOpen = $state(false);
  let customFromInput = $state('');
  let customToInput = $state('');

  function presetLabel(preset: TimelineRangePreset | null): string {
    if (!preset) return 'Rango';
    return RANGE_PRESETS.find((p) => p.id === preset)?.label ?? 'Rango';
  }

  function presetDurationDays(preset: TimelineRangePreset, cal: CalendarConfig): number {
    const yearDays = daysPerYear(cal);
    const monthDays = Math.max(1, Math.round(yearDays / Math.max(1, cal.months.length)));
    if (preset === 'day') return 1;
    if (preset === 'decana') return 10;
    if (preset === 'month') return monthDays;
    if (preset === 'year') return yearDays;
    if (preset === '5y') return yearDays * 5;
    if (preset === '20y') return yearDays * 20;
    if (preset === '100y') return yearDays * 100;
    if (preset === '500y') return yearDays * 500;
    return yearDays;
  }

  function jsDateToFantasyDay(date: Date, cal: CalendarConfig): number {
    if (cal.months.length === 12) {
      return dateToDay(
        { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() },
        cal,
      );
    }
    const yearDays = daysPerYear(cal);
    const year = date.getFullYear();
    const fracOfYear = (date.getMonth() + (Math.max(1, date.getDate()) - 1) / 30) / 12;
    const dayInYear = Math.max(0, Math.min(yearDays - 1, Math.floor(fracOfYear * yearDays)));
    return (year - cal.epoch) * yearDays + dayInYear;
  }

  function dayToJSDate(day: number, cal: CalendarConfig): Date {
    return toJSDate(timestampToDate(day * DAY_MS, cal), cal);
  }

  function getWindowCenterDay(cal: CalendarConfig): number {
    if (!timeline) return dateToDay({ year: cal.epoch, month: 1, day: 1 }, cal);
    const win = timeline.getWindow();
    const centerMs = (win.start.getTime() + win.end.getTime()) / 2;
    return jsDateToFantasyDay(new Date(centerMs), cal);
  }

  function applyWindowAndFilter(startDay: number, endDay: number, preset: TimelineRangePreset | null) {
    const cal = $state.snapshot(campaign.data.calendar);
    const safeStart = Math.min(startDay, endDay);
    const safeEnd = Math.max(startDay, endDay);
    timeline?.setWindow(dayToJSDate(safeStart, cal), dayToJSDate(safeEnd + 1, cal), { animation: true });
    campaign.setFilter({
      dateRangeStartDay: safeStart,
      dateRangeEndDay: safeEnd,
      dateRangePreset: preset,
    });
  }

  function applyRangePreset(preset: TimelineRangePreset) {
    const cal = $state.snapshot(campaign.data.calendar);
    const span = presetDurationDays(preset, cal);
    const center = getWindowCenterDay(cal);
    const startDay = center - Math.floor(span / 2);
    const endDay = startDay + span - 1;
    applyWindowAndFilter(startDay, endDay, preset);
    rangeOpen = false;
  }

  function parseDateInput(input: string, cal: CalendarConfig): FantasyDate | null {
    const parts = input.trim().split('-').map((p) => Number.parseInt(p, 10));
    if (parts.length !== 3 || parts.some((v) => Number.isNaN(v))) return null;
    const [year, month, day] = parts;
    const parsed = { year, month, day };
    if (!isValidDate(parsed, cal)) return null;
    return parsed;
  }

  function applyCustomRange() {
    const cal = $state.snapshot(campaign.data.calendar);
    const from = parseDateInput(customFromInput, cal);
    const to = parseDateInput(customToInput, cal);
    if (!from || !to) return;
    applyWindowAndFilter(dateToDay(from, cal), dateToDay(to, cal), 'custom');
    rangeOpen = false;
  }

  function clearRangeFilter() {
    campaign.setFilter({
      dateRangeStartDay: null,
      dateRangeEndDay: null,
      dateRangePreset: null,
    });
    rangeOpen = false;
  }

  function fitCurrentFilteredEvents() {
    timeline?.fit();
  }

  onMount(() => {
    const cal = $state.snapshot(campaign.data.calendar);
    const allTs = $state.snapshot(campaign.data.events).map((ev: any) => toJSDate(ev.date, cal).getTime());
    const minTs = allTs.length ? Math.min(...allTs) : new Date(cal.epoch, 0, 1).getTime();
    const maxTs = allTs.length ? Math.max(...allTs) : new Date(cal.epoch, 11, 30).getTime();
    const pad = Math.max((maxTs - minTs) * 0.15, 86400 * 1000 * 14);

    itemsDs = new DataSet<any>(buildItems());
    groupsDs = new DataSet<any>(buildGroups());

    timeline = new Timeline(container, itemsDs, groupsDs, {
      start: new Date(minTs - pad),
      end: new Date(maxTs + pad),
      min: new Date(minTs - pad * 5),
      max: new Date(maxTs + pad * 5),
      zoomMin: DAY_MS,
      zoomMax: DAY_MS * 365 * 600,
      orientation: { axis: 'top' },
      stack: true,
      showMajorLabels: true,
      showMinorLabels: true,
      height: '100%',
      tooltip: { followMouse: true, overflowMethod: 'cap' },
      selectable: true,
      multiselect: false,
      moveable: true,
      zoomable: true,
      format: buildFormatOpts(),
      ...(import.meta.env.DEV ? { xss: { disabled: true } } : {}),
    });

    timeline.on('select', (props: { items: string[] }) => {
      const id = props.items[0] ?? null;
      campaign.setSelectedEvent(id);
      if (id) campaign.openDetail(id);
    });

    timeline.on('doubleClick', (props: { item: string | null }) => {
      if (props.item) {
        const ev = campaign.data.events.find((e) => e.id === props.item);
        if (ev) campaign.openEditor(ev);
      } else {
        campaign.openEditor();
      }
    });

    // Let layout compute, then fit
    setTimeout(() => timeline?.fit(), 50);

    const onPointerDown = (evt: PointerEvent) => {
      if (!rangeOpen || !toolbarRangeWrap) return;
      const target = evt.target as Node | null;
      if (target && !toolbarRangeWrap.contains(target)) {
        rangeOpen = false;
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
    };
  });

  onDestroy(() => timeline?.destroy());

  $effect(() => {
    campaign.filteredEvents;
    campaign.data.calendar;
    campaign.eventTypes;
    untrack(() => {
      if (!itemsDs) return;
      itemsDs.clear();
      itemsDs.add(buildItems());
    });
  });

  $effect(() => {
    campaign.data.timelines;
    untrack(() => {
      if (!groupsDs) return;
      groupsDs.clear();
      groupsDs.add(buildGroups());
    });
  });

  // Selection sync
  $effect(() => {
    const sel = campaign.selectedEventId; // track
    if (!timeline) return;
    timeline.setSelection(sel ? [sel] : []);
  });
</script>

<div class="tl-outer">
  <div class="tl-toolbar">
    <span class="tl-hint">Scroll to zoom · Drag to pan · Click event to view · Double-click to add</span>
    <button class="tl-btn" data-testid="timeline-add-event" aria-label="Add event" onclick={() => campaign.openEditor()}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
        <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
      </svg>
      Add Event
    </button>
    <div class="tl-range-wrap" bind:this={toolbarRangeWrap}>
      <button
        class="tl-btn tl-btn-ghost"
        data-testid="timeline-range-toggle"
        data-range-preset={campaign.filter.dateRangePreset ?? 'none'}
        data-range-start={campaign.filter.dateRangeStartDay ?? ''}
        data-range-end={campaign.filter.dateRangeEndDay ?? ''}
        aria-label="Select date range"
        aria-haspopup="dialog"
        aria-expanded={rangeOpen}
        aria-controls="timeline-range-dropdown"
        onclick={() => (rangeOpen = !rangeOpen)}
      >
        {presetLabel(campaign.filter.dateRangePreset)}
      </button>
      {#if rangeOpen}
        <div
          id="timeline-range-dropdown"
          class="tl-range-dropdown"
          role="dialog"
          aria-label="Date range filter"
          data-testid="timeline-range-dropdown"
        >
          <div class="tl-range-presets" role="listbox" aria-label="Range presets">
            {#each RANGE_PRESETS as preset}
              <button
                class="tl-range-preset"
                data-testid={`timeline-range-preset-${preset.id}`}
                role="option"
                aria-selected={campaign.filter.dateRangePreset === preset.id}
                onclick={() => applyRangePreset(preset.id)}
              >
                {preset.label}
              </button>
            {/each}
          </div>
          <div class="tl-range-custom">
            <label class="tl-range-label">
              Desde (YYYY-MM-DD)
              <input
                class="tl-range-input"
                data-testid="timeline-range-from"
                aria-label="Range start date"
                placeholder="1490-01-01"
                bind:value={customFromInput}
              />
            </label>
            <label class="tl-range-label">
              Hasta (YYYY-MM-DD)
              <input
                class="tl-range-input"
                data-testid="timeline-range-to"
                aria-label="Range end date"
                placeholder="1490-12-30"
                bind:value={customToInput}
              />
            </label>
            <div class="tl-range-actions">
              <button
                class="tl-btn tl-btn-ghost"
                data-testid="timeline-range-apply"
                aria-label="Apply custom range"
                onclick={applyCustomRange}
              >
                Aplicar
              </button>
              <button
                class="tl-btn tl-btn-ghost"
                data-testid="timeline-range-clear"
                aria-label="Clear date range"
                onclick={clearRangeFilter}
              >
                Limpiar
              </button>
            </div>
          </div>
        </div>
      {/if}
    </div>
    <button
      class="tl-btn tl-btn-ghost"
      data-testid="timeline-fit-view"
      aria-label="Fit timeline view"
      onclick={fitCurrentFilteredEvents}
    >
      Fit View
    </button>
  </div>

  <div class="tl-container" bind:this={container}></div>
</div>

<style>
  .tl-outer {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }
  .tl-toolbar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }
  .tl-hint { font-size: 12px; color: var(--text-dim); margin-right: auto; font-style: italic; }
  .tl-btn {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 5px 12px;
    background: var(--gold-dim);
    color: #fff;
    border: none;
    border-radius: 4px;
    font-size: 13px;
    font-family: 'Cinzel', serif;
    letter-spacing: 0.03em;
  }
  .tl-btn:hover { background: var(--gold); color: #0d0d1a; }
  .tl-btn-ghost {
    background: transparent;
    border: 1px solid var(--border);
    color: var(--text-muted);
  }
  .tl-btn-ghost:hover { border-color: var(--gold-dim); color: var(--text); background: transparent; }
  .tl-range-wrap { position: relative; }
  .tl-range-dropdown {
    position: absolute;
    top: calc(100% + 6px);
    right: 0;
    width: 290px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    z-index: 30;
    box-shadow: 0 8px 22px rgba(0, 0, 0, 0.35);
  }
  .tl-range-presets {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px;
  }
  .tl-range-preset {
    border: 1px solid var(--border);
    background: transparent;
    color: var(--text);
    border-radius: 6px;
    padding: 6px 8px;
    font-size: 12px;
    text-align: left;
  }
  .tl-range-preset:hover {
    border-color: var(--gold-dim);
    background: rgba(255, 215, 128, 0.08);
  }
  .tl-range-preset[aria-selected='true'] {
    border-color: var(--gold-dim);
    background: rgba(255, 215, 128, 0.12);
  }
  .tl-range-custom {
    border-top: 1px solid var(--border);
    padding-top: 10px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .tl-range-label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 11px;
    color: var(--text-muted);
  }
  .tl-range-input {
    border: 1px solid var(--border);
    background: rgba(10, 14, 28, 0.75);
    color: var(--text);
    border-radius: 6px;
    padding: 7px 8px;
    font-size: 12px;
  }
  .tl-range-actions {
    display: flex;
    justify-content: flex-end;
    gap: 6px;
  }
  .tl-container { flex: 1; min-height: 0; }
</style>
