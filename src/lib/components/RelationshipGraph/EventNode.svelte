<script lang="ts">
  import { Handle, Position } from '@xyflow/svelte';

  let { data }: { data: {
    title: string;
    typeLabel: string;
    typeColor: string;
    dateStr: string;
    secret: boolean;
    selected: boolean;
    borderColor: string;
  }} = $props();
</script>

<Handle type="target" position={Position.Top} style="opacity:0.5;background:var(--border)" />

<div
  class="ev-node"
  role="button"
  aria-label="{data.title} — {data.typeLabel}, {data.dateStr}"
  data-testid="graph-node-{data.title.toLowerCase().replace(/\s+/g, '-')}"
  style:border-color={data.selected ? 'var(--gold)' : data.borderColor}
  style:box-shadow={data.selected ? `0 0 12px ${data.borderColor}55` : '0 2px 8px rgba(0,0,0,0.4)'}
>
  <span class="ev-type" style:color={data.typeColor}>{data.typeLabel}</span>
  <span class="ev-title">{data.title}</span>
  <span class="ev-date">{data.dateStr}</span>
  {#if data.secret}<span class="ev-secret">🔒 Secret</span>{/if}
</div>

<Handle type="source" position={Position.Bottom} style="opacity:0.5;background:var(--border)" />

<style>
  .ev-node {
    background: var(--surface-2);
    border: 2px solid;
    border-radius: 8px;
    padding: 10px 14px;
    min-width: 160px;
    max-width: 200px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    cursor: pointer;
    font-family: 'Crimson Text', serif;
  }
  .ev-type {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-family: 'Cinzel', serif;
  }
  .ev-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--text);
    word-break: break-word;
  }
  .ev-date {
    font-size: 11px;
    color: var(--text-muted);
  }
  .ev-secret {
    font-size: 10px;
    color: var(--gold-dim);
  }
</style>
