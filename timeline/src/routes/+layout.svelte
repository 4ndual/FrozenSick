<script lang="ts">
  import '../app.css';
  import { browser } from '$app/environment';

  let { children } = $props();

  // Initialize mermaid on client side
  $effect(() => {
    if (browser && typeof (window as unknown as { mermaid?: { initialize: (opts: { theme: string }) => void } }).mermaid?.initialize === 'function') {
      (window as unknown as { mermaid?: { initialize: (opts: { theme: string }) => void } }).mermaid?.initialize({ theme: 'dark' });
    }
  });
</script>

{@render children()}
