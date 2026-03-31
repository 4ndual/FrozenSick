
import { renderMarkdown } from './src/lib/wiki-markdown.js';

const tableMd = `
| Header 1 | Header 2 |
| -------- | -------- |
| Cell 1   | Cell 2   |
`;

console.log(renderMarkdown(tableMd));
