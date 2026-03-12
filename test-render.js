
import { marked } from 'marked';
import DOMPurify from 'isomorphic-dompurify';

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
  'open', 'align',
];

function renderMarkdown(md) {
  const raw = marked.parse(md);
  return DOMPurify.sanitize(raw, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
  });
}

const tableMd = `
| Header 1 | Header 2 |
| -------- | -------- |
| Cell 1   | Cell 2   |
`;

console.log('--- RAW MARKED ---');
console.log(marked.parse(tableMd));
console.log('--- SANITIZED ---');
console.log(renderMarkdown(tableMd));
