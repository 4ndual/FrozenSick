import { browser } from '$app/environment';
import type MermaidApi from 'mermaid';

type MermaidRuntime = typeof MermaidApi;

let mermaidPromise: Promise<MermaidRuntime> | null = null;

export async function ensureMermaid(): Promise<MermaidRuntime | null> {
  if (!browser) return null;

  if (!mermaidPromise) {
    mermaidPromise = import('mermaid')
      .then(({ default: mermaid }) => {
        mermaid.initialize({
          startOnLoad: false,
          theme: 'dark',
        });

        // Keep compatibility with existing window-based checks in older components.
        (window as Window & { mermaid?: MermaidRuntime }).mermaid = mermaid;
        return mermaid;
      })
      .catch((error) => {
        mermaidPromise = null;
        throw error;
      });
  }

  return mermaidPromise;
}

export async function runMermaidIn(container: ParentNode | null | undefined): Promise<void> {
  if (!browser || !container) return;

  const mermaid = await ensureMermaid();
  if (!mermaid) return;

  const nodes = container.querySelectorAll<HTMLElement>('.mermaid');
  if (!nodes.length) return;

  await mermaid.run({ nodes });
}
