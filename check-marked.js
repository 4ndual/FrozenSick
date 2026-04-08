
import { marked } from 'marked';
const result = marked.parse('# Hello');
console.log('Result type:', typeof result);
console.log('Is Promise:', result instanceof Promise);
