const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const CONTENT_DIR = path.resolve(ROOT, 'content');
const EXCLUDE = new Set(['.cursor', 'node_modules', 'Assets', 'dist', '.git', 'timeline']);
const EXCLUDE_FILES = new Set(['README.md']);

function slugify(str) {
  return str.toLowerCase().replace(/['']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function slugifyPath(relPath) {
  return relPath.replace(/\.(md|txt)$/i, '').split(path.sep).map(slugify).join('/');
}

function walkContent(dir, base) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (EXCLUDE.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkContent(full, base));
    } else if (entry.name.match(/\.(md|txt)$/i) && !EXCLUDE_FILES.has(entry.name)) {
      results.push(path.relative(base, full));
    }
  }
  return results;
}

const contentFiles = walkContent(CONTENT_DIR, CONTENT_DIR);
const slugToPath = {};
for (const rel of contentFiles) {
  const slug = '/' + slugifyPath(rel);
  slugToPath[slug] = 'content/' + rel;
  const parts = rel.split(path.sep);
  const fileName = parts[parts.length - 1].replace(/\.(md|txt)$/i, '').toLowerCase();
  if ((fileName === 'summary' || fileName === 'index') && parts.length > 1) {
    const parentSlug = '/' + slugifyPath(parts.slice(0, -1).join(path.sep));
    slugToPath[parentSlug] = 'content/' + rel;
  }
}

const outPaths = [
  path.join(ROOT, 'timeline', 'src', 'lib', 'wiki-manifest.json'),
  path.join(ROOT, 'src', 'lib', 'wiki-manifest.json')
];

for (const outPath of outPaths) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(slugToPath, null, 2), 'utf-8');
}
console.log('Wrote wiki-manifest.json to', outPaths.length, 'locations with', Object.keys(slugToPath).length, 'entries');
