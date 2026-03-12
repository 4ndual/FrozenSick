import { marked } from 'marked';

// isomorphic-dompurify is NOT imported here so it never loads on the server (Vercel Node).
// It pulls in html-encoding-sniffer → @exodus/bytes (ESM), which causes ERR_REQUIRE_ESM.
// Server uses renderMarkdownServer(); client uses renderMarkdownClient() via dynamic import.

marked.setOptions({ gfm: true });

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

function toRaw(parsed: string | Promise<string>): string {
  return typeof parsed === 'string' ? parsed : String(parsed ?? '');
}

/**
 * Server-safe render: marked + minimal strip only. No isomorphic-dompurify (avoids ESM deps on Vercel).
 * Use for SSR. Client will run full sanitization on hydration.
 */
export function renderMarkdownServer(md: string): string {
  const raw = toRaw(marked.parse(md));
  return serverSanitize(raw);
}

function serverSanitize(html: string): string {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/\s on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/\s on\w+\s*=\s*[^\s>]*/gi, '')
    .replace(/javascript:\s*/gi, '');
}

/**
 * Client-only: full sanitization with DOMPurify. Dynamic import so server never loads it.
 */
export async function renderMarkdownClient(md: string): Promise<string> {
  const raw = toRaw(marked.parse(md));
  const DOMPurify = (await import('isomorphic-dompurify')).default;
  return DOMPurify.sanitize(raw, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
  });
}

/**
 * Sync render for components. Use on server (SSR) and as initial client value; client upgrades via renderMarkdownClient.
 */
export function renderMarkdown(md: string): string {
  return renderMarkdownServer(md);
}
