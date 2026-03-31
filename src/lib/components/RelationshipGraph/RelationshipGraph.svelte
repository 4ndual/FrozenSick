<script lang="ts">
  import { untrack } from 'svelte';
  import { SvelteFlow, Background, Controls, MiniMap, type Node, type Edge } from '@xyflow/svelte';
  import '@xyflow/svelte/dist/style.css';
  import { campaign } from '$lib/store/campaign.svelte';
  import { RELATION_TYPE_LABELS } from '$lib/types/schema';
  import { formatDate } from '$lib/utils/calendar';
  import { loadGraphLayout, saveGraphLayout } from '$lib/utils/storage';
  import type { CampaignEvent, CalendarConfig } from '$lib/types/schema';
  import type { GraphLayoutPositions } from '$lib/utils/storage';
  import EventNode from './EventNode.svelte';

  const nodeTypes = { eventNode: EventNode };

  const EDGE_COLORS: Record<string, string> = {
    caused: '#cc4444',
    leads_to: '#d4af37',
    concurrent: '#4a7a9a',
    related: '#6a6a9a',
    contradicts: '#9a4a9a',
  };

  let focusId = $state<string | null>(campaign.selectedEventId);
  let showAll = $state(true);

  function getVisibleEvents(filtered: CampaignEvent[], all: CampaignEvent[]): CampaignEvent[] {
    if (showAll || !focusId) return filtered;
    const connected = new Set<string>([focusId]);
    for (const ev of all) {
      for (const rel of ev.relations) {
        if (rel.targetId === focusId) connected.add(ev.id);
        if (ev.id === focusId) connected.add(rel.targetId);
      }
    }
    return filtered.filter((ev) => connected.has(ev.id));
  }

  function typeInfo(typeId: string) {
    const et = campaign.eventTypes.find((e) => e.id === typeId);
    return { color: et?.color ?? '#888', label: et?.label ?? typeId };
  }

  function layoutNodes(
    events: CampaignEvent[],
    cal: CalendarConfig,
    selId: string | null,
    savedPositions: GraphLayoutPositions,
  ): Node[] {
    const cols = Math.max(1, Math.ceil(Math.sqrt(events.length)));
    return events.map((ev, i) => {
      const info = typeInfo(ev.type);
      const color = ev.color ?? info.color;
      const saved = savedPositions[ev.id];
      const position = saved
        ? { x: saved.x, y: saved.y }
        : { x: (i % cols) * 240 + 40, y: Math.floor(i / cols) * 180 + 40 };
      return {
        id: ev.id,
        type: 'eventNode',
        position,
        data: {
          title: ev.title,
          typeLabel: info.label,
          typeColor: color,
          dateStr: formatDate(ev.date, cal),
          secret: ev.secret ?? false,
          selected: ev.id === selId,
          borderColor: color,
        },
      };
    });
  }

  function computeEdges(events: CampaignEvent[]): Edge[] {
    const visIds = new Set(events.map((e) => e.id));
    const result: Edge[] = [];
    const seen = new Set<string>();
    for (const ev of events) {
      for (const rel of ev.relations) {
        if (!visIds.has(rel.targetId)) continue;
        const edgeId = `${ev.id}→${rel.targetId}`;
        if (seen.has(edgeId)) continue;
        seen.add(edgeId);
        result.push({
          id: edgeId,
          source: ev.id,
          target: rel.targetId,
          label: rel.label || RELATION_TYPE_LABELS[rel.type],
          type: 'smoothstep',
          animated: rel.type === 'concurrent',
          style: `stroke: ${EDGE_COLORS[rel.type] ?? '#6a6a9a'}; stroke-width: 2`,
          labelStyle: 'font-size: 11px; font-family: Crimson Text; fill: var(--text-muted)',
          markerEnd: { type: 'arrowclosed', color: EDGE_COLORS[rel.type] ?? '#6a6a9a' },
        });
      }
    }
    return result;
  }

  // $state.raw: writable by SvelteFlow (positions, dimensions, drag state)
  let nodes = $state.raw<Node[]>([]);
  let edges = $state.raw<Edge[]>([]);
  let savedPositions = $state.raw<GraphLayoutPositions>(loadGraphLayout());

  // Sync campaign data -> nodes/edges when dependencies change.
  // Before recomputing, persist current node positions so drags and reloads are preserved.
  $effect.pre(() => {
    campaign.filteredEvents;
    campaign.data.events;
    campaign.selectedEventId;
    campaign.data.calendar;
    showAll;
    focusId;

    untrack(() => {
      if (nodes.length > 0) {
        for (const n of nodes) {
          if (n.id && n.position) {
            savedPositions[n.id] = { x: n.position.x, y: n.position.y };
          }
        }
        saveGraphLayout(savedPositions);
      }

      const snap = $state.snapshot(campaign.filteredEvents) as CampaignEvent[];
      const allSnap = $state.snapshot(campaign.data.events) as CampaignEvent[];
      const cal = $state.snapshot(campaign.data.calendar) as CalendarConfig;
      const selId = campaign.selectedEventId;
      const visible = getVisibleEvents(snap, allSnap);
      nodes = layoutNodes(visible, cal, selId, savedPositions);
      edges = computeEdges(visible);
    });
  });
</script>

<div class="graph-outer">
  <div class="graph-toolbar">
    <span class="graph-hint">Drag nodes · Scroll to zoom · Click to select</span>
    <label class="focus-toggle">
      <input type="checkbox" bind:checked={showAll} />
      Show all events
    </label>
    {#if !showAll}
      <select bind:value={focusId} style="max-width:180px">
        <option value={null}>— focus on event —</option>
        {#each campaign.data.events as ev}
          <option value={ev.id}>{ev.title}</option>
        {/each}
      </select>
    {/if}
    <button class="tl-btn" onclick={() => campaign.openEditor()}>+ Add Event</button>
  </div>

  <div class="graph-canvas">
    <SvelteFlow
      bind:nodes
      bind:edges
      {nodeTypes}
      fitView
      nodesDraggable
      nodesConnectable={false}
      elementsSelectable
      onnodeclick={({ node }) => {
        campaign.setSelectedEvent(node.id);
        campaign.openDetail(node.id);
        focusId = node.id;
      }}
      onnodedragstop={({ nodes: updatedNodes }) => {
        for (const n of updatedNodes) {
          if (n.id && n.position) savedPositions[n.id] = { x: n.position.x, y: n.position.y };
        }
        saveGraphLayout(savedPositions);
      }}
    >
      <Background gap={24} size={1} />
      <Controls style="background:var(--surface-2);border:1px solid var(--border);border-radius:6px" />
      <MiniMap
        nodeColor={(n) => {
          const ev = campaign.data.events.find((e) => e.id === n.id);
          return ev ? (ev.color ?? typeInfo(ev.type).color) : '#888';
        }}
        style="background:var(--surface-2);border:1px solid var(--border)"
      />
    </SvelteFlow>
  </div>

  <!-- Legend -->
  <div class="legend">
    <span class="legend-title">Relations:</span>
    {#each Object.entries(EDGE_COLORS) as [type, color]}
      <span class="legend-item">
        <span class="legend-line" style="border-color:{color}"></span>
        {RELATION_TYPE_LABELS[type as keyof typeof RELATION_TYPE_LABELS]}
      </span>
    {/each}
  </div>
</div>

<style>
  .graph-outer {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  .graph-toolbar {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }

  .graph-hint {
    font-size: 12px;
    color: var(--text-dim);
    margin-right: auto;
    font-style: italic;
  }

  .focus-toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: var(--text-muted);
    cursor: pointer;
  }
  .focus-toggle input { accent-color: var(--gold); }

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

  .graph-canvas {
    flex: 1;
    min-height: 0;
    position: relative;
  }

  /* Override Svelte Flow defaults */
  .graph-canvas :global(.svelte-flow) {
    background: var(--surface) !important;
  }
  .graph-canvas :global(.svelte-flow__background) {
    background: var(--surface) !important;
  }
  .graph-canvas :global(.svelte-flow__node) {
    font-family: 'Crimson Text', serif;
    visibility: visible !important;
  }
  .graph-canvas :global(.svelte-flow__edge-label) {
    font-family: 'Crimson Text', serif;
    font-size: 11px;
  }
  .graph-canvas :global(.svelte-flow__controls button) {
    background: var(--surface-2) !important;
    border: none !important;
    color: var(--text-muted) !important;
  }
  .graph-canvas :global(.svelte-flow__controls button:hover) {
    color: var(--text) !important;
    background: var(--surface-3) !important;
  }
  .graph-canvas :global(.svelte-flow__minimap-svg) {
    background: var(--surface-2) !important;
  }

  .legend {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 6px 12px;
    background: var(--surface);
    border-top: 1px solid var(--border);
    flex-shrink: 0;
    flex-wrap: wrap;
  }

  .legend-title {
    font-size: 11px;
    font-family: 'Cinzel', serif;
    text-transform: uppercase;
    color: var(--text-dim);
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 12px;
    color: var(--text-muted);
  }

  .legend-line {
    display: inline-block;
    width: 22px;
    height: 0;
    border-bottom: 2px solid;
    border-radius: 2px;
  }
</style>
