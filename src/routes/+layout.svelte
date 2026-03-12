<script lang="ts">
  import '../app.css';
  import { browser } from '$app/environment';
  import { ensureMermaid } from '$lib/mermaid-client';

  let { children } = $props();

  $effect(() => {
    if (!browser) return;

    void ensureMermaid().catch((error) => {
      console.error('Failed to initialize Mermaid runtime', error);
    });
  });
</script>

{@render children()}
