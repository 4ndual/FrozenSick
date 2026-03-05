<script lang="ts">
  import { onMount, onDestroy, untrack } from 'svelte';
  import { Timeline, DataSet } from 'vis-timeline/standalone';
  import 'vis-timeline/styles/vis-timeline-graph2d.min.css';
  import { campaign } from '$lib/store/campaign.svelte';
  import { daysPerYear, formatDate, dateToDay } from '$lib/utils/calendar';
  import type { CampaignEvent, CalendarConfig, FantasyDate } from '$lib/types/schema';

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

  // Build item content as plain HTML string — no style attributes (sanitizer strips them).
  // Per-event coloring is done via style.borderLeftColor and className type-{eventType}.
  function buildItemContent(ev: CampaignEvent): string {
    const icon = ev.icon ?? typeIcon(ev.type);
    const emoji = TYPE_EMOJI[icon] ?? '•';
    return `<span class="tl-icon-em">${emoji}</span><span class="tl-title">${ev.title}</span>${ev.secret ? '<span class="tl-secret"> 🔒</span>' : ''}`;
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
  let timeline: Timeline | undefined;
  let itemsDs: InstanceType<typeof DataSet> | undefined;
  let groupsDs: InstanceType<typeof DataSet> | undefined;

  onMount(() => {
    const cal = $state.snapshot(campaign.data.calendar);
    const allTs = $state.snapshot(campaign.data.events).map((ev: any) => toJSDate(ev.date, cal).getTime());
    const minTs = allTs.length ? Math.min(...allTs) : new Date(cal.epoch, 0, 1).getTime();
    const maxTs = allTs.length ? Math.max(...allTs) : new Date(cal.epoch, 11, 30).getTime();
    const pad = Math.max((maxTs - minTs) * 0.15, 86400 * 1000 * 14);

    itemsDs = new DataSet<any>(buildItems());
    groupsDs = new DataSet<any>(buildGroups());

    // @ts-expect-error DataSet generics
    timeline = new Timeline(container, itemsDs, groupsDs, {
      start: new Date(minTs - pad),
      end: new Date(maxTs + pad),
      min: new Date(minTs - pad * 5),
      max: new Date(maxTs + pad * 5),
      zoomMin: 86400 * 1000,
      zoomMax: 86400 * 1000 * 365 * 200,
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
    <button class="tl-btn" onclick={() => campaign.openEditor()}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
        <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
      </svg>
      Add Event
    </button>
    <button class="tl-btn tl-btn-ghost" onclick={() => timeline?.fit()}>Fit View</button>
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
  .tl-container { flex: 1; min-height: 0; }
</style>
