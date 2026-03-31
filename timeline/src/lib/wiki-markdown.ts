import { marked } from 'marked';

marked.use({
  renderer: {
    code({ text, lang }) {
      const codeLang = (lang ?? '').trim().toLowerCase();
      if (codeLang === 'mermaid') {
        return `<pre class="mermaid">${escapeHtml(text)}</pre>\n`;
      }
      return false;
    },
  },
});

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderMarkdown(md: string): string {
  return marked.parse(md) as string;
}
