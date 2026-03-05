import { marked } from 'marked';
import DOMPurify from 'isomorphic-dompurify';

marked.use({
  renderer: {
    code({ text, lang }) {
      if (lang === 'mermaid') {
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

const ALLOWED_TAGS = [
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'br', 'hr',
  'ul', 'ol', 'li',
  'blockquote', 'pre', 'code',
  'a', 'strong', 'em', 'del', 's', 'mark', 'sub', 'sup',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'img',
  'div', 'span',
  'details', 'summary',
  'dl', 'dt', 'dd',
];

const ALLOWED_ATTR = [
  'href', 'title', 'target', 'rel',
  'src', 'alt', 'width', 'height',
  'class', 'id',
  'colspan', 'rowspan',
  'open',
];

export function renderMarkdown(md: string): string {
  const raw = marked.parse(md) as string;
  return DOMPurify.sanitize(raw, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
  });
}
