const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const EXCLUDE = new Set(['.cursor', 'node_modules', 'Assets', 'dist', '.git', 'timeline']);
const EXCLUDE_FILES = new Set(['README.md']);

function slugify(str) {
  return str.toLowerCase().replace(/['']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function slugifyPath(relPath) {
  return relPath.replace(/\.md$/i, '').split(path.sep).map(slugify).join('/');
}

function walkMd(dir, base) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (EXCLUDE.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkMd(full, base));
    } else if (entry.name.endsWith('.md') && !EXCLUDE_FILES.has(entry.name)) {
      results.push(path.relative(base, full));
    }
  }
  return results;
}

const mdFiles = walkMd(ROOT, ROOT);
const slugToPath = {};
for (const rel of mdFiles) {
  const slug = '/' + slugifyPath(rel);
  slugToPath[slug] = rel;
}

const outPath = path.join(ROOT, 'timeline', 'src', 'lib', 'wiki-manifest.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(slugToPath, null, 2), 'utf-8');
console.log('Wrote wiki-manifest.json with', Object.keys(slugToPath).length, 'entries');
