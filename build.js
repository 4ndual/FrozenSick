const fs = require('fs');
const path = require('path');
const { marked } = require('marked');

const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');
const EXCLUDE = new Set(['.cursor', 'node_modules', 'Assets', 'dist', '.git']);
const EXCLUDE_FILES = new Set(['README.md']);

marked.use({
  renderer: {
    code({ text, lang }) {
      if (lang === 'mermaid') {
        return `<pre class="mermaid">${text}</pre>\n`;
      }
      return false;
    }
  }
});

function slugify(str) {
  return str.toLowerCase().replace(/['']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function slugifyPath(relPath) {
  return relPath.replace(/\.md$/i, '').split(path.sep).map(slugify).join('/');
}

function walkMd(dir, base) {
  const results = [];
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

function extractTitle(md) {
  const match = md.match(/^#\s+(.+)$/m);
  if (!match) return 'Untitled';
  return match[1].replace(/\s*—\s*Frozen Sick$/, '').trim();
}

const mdFiles = walkMd(ROOT, ROOT);
const fileMap = {};
for (const rel of mdFiles) {
  fileMap[rel] = '/' + slugifyPath(rel);
}

function rewriteLinks(html, sourceDir) {
  return html.replace(/href="([^"]*\.md)"/g, (_, href) => {
    if (href.startsWith('http')) return `href="${href}"`;
    const resolved = path.normalize(path.join(sourceDir, href));
    const rel = path.relative(ROOT, resolved);
    const mapped = fileMap[rel];
    return mapped ? `href="${mapped}"` : `href="${href}"`;
  });
}

const NAV = [
  { title: 'Home', href: '/' },
  {
    section: 'Chapters',
    children: [
      { title: 'Ch 1 — The Tavern', href: '/chapters/chapter-1-the-tavern/summary' },
      { title: 'Ch 2 — The Plateau', href: '/chapters/chapter-2-the-plateau/summary' },
      {
        title: 'Ch 3 — The Flying Turtle',
        href: '/chapters/chapter-3-the-flying-turtle/summary',
        sub: [{ title: 'Missing: Branig', href: '/chapters/chapter-3-the-flying-turtle/missing-branig-and-the-mysterious-woman' }]
      },
      {
        title: 'Ch 4 — Battle of Brasboredon',
        href: '/chapters/chapter-4-the-battle-of-brasboredon/summary',
        sub: [{ title: "Missing: Demon's Lair", href: '/chapters/chapter-4-the-battle-of-brasboredon/missing-demons-lair-to-brasboredon' }]
      },
      { title: 'Ch 5 — Escape from Brasboredon', href: '/chapters/chapter-5-the-escape-from-brasboredon/summary' },
    ]
  },
  {
    section: 'Characters',
    children: [
      { title: 'Tidus — Story', href: '/characters/tidus/story' },
      { title: 'Tidus — Sheet', href: '/characters/tidus/sheet' },
      { title: 'Nixira — Story', href: '/characters/nixira/story' },
      { title: 'Zacarías — Story', href: '/characters/zacarias/story' },
      { title: 'Zacarías — Sheet', href: '/characters/zacarias/sheet' },
      { title: 'NPCs', href: '/characters/npcs' },
    ]
  },
  {
    section: 'World',
    children: [
      { title: 'Lore', href: '/world/lore' },
      { title: 'Organizations', href: '/world/organizations' },
      { title: 'Places', href: '/world/places' },
    ]
  },
  { title: 'Plot Tracker', href: '/plot/tracker' },
  { title: 'Relations', href: '/relations' },
];

function renderSidebar(activeHref) {
  let h = '<ul>\n';
  for (const item of NAV) {
    if (item.section) {
      h += `<li><span class="section-title">${item.section}</span>\n<ul>\n`;
      for (const c of item.children) {
        const act = c.href === activeHref ? ' class="active"' : '';
        h += `<li><a href="${c.href}"${act}>${c.title}</a>\n`;
        if (c.sub) {
          h += '<ul>\n';
          for (const s of c.sub) {
            const sAct = s.href === activeHref ? ' class="active"' : '';
            h += `<li><a href="${s.href}"${sAct}>${s.title}</a></li>\n`;
          }
          h += '</ul>\n';
        }
        h += '</li>\n';
      }
      h += '</ul></li>\n';
    } else {
      const act = item.href === activeHref ? ' class="active"' : '';
      h += `<li><a href="${item.href}"${act}>${item.title}</a></li>\n`;
    }
  }
  h += '</ul>';
  return h;
}

function buildLandingPage() {
  return `<div class="landing">
  <h1>Frozen Sick</h1>
  <p class="tagline">A D&amp;D chronicle of bounty hunters, cursed artifacts, and a city on fire.</p>

  <div class="landing-grid">
    <div class="card">
      <h2>The Story So Far</h2>
      <p>Five chapters of chaos, from a humble tavern job gone wrong to a full-scale revolution.</p>
      <ul>
        <li><a href="/chapters/chapter-1-the-tavern/summary">Chapter 1 &mdash; The Tavern</a></li>
        <li><a href="/chapters/chapter-2-the-plateau/summary">Chapter 2 &mdash; The Plateau</a></li>
        <li><a href="/chapters/chapter-3-the-flying-turtle/summary">Chapter 3 &mdash; The Flying Turtle</a></li>
        <li><a href="/chapters/chapter-4-the-battle-of-brasboredon/summary">Chapter 4 &mdash; The Battle of Brasboredon</a></li>
        <li><a href="/chapters/chapter-5-the-escape-from-brasboredon/summary">Chapter 5 &mdash; The Escape from Brasboredon</a></li>
      </ul>
    </div>

    <div class="card">
      <h2>The Party</h2>
      <ul>
        <li><a href="/characters/tidus/story"><strong>Tidus</strong></a> &mdash; Rogue / Waiter. Val medallion bearer, prince-killer, bomb defuser.</li>
        <li><a href="/characters/nixira/story"><strong>Nixira</strong></a> &mdash; Bard / Cook. Fire ballista operator, rap battle champion, dwarf-cursed.</li>
        <li><a href="/characters/zacarias/story"><strong>Zacar&iacute;as</strong></a> &mdash; Warlock / Guard. Dreamer, one-handed revolutionary.</li>
      </ul>
    </div>

    <div class="card">
      <h2>The World</h2>
      <ul>
        <li><a href="/world/lore">Lore</a> &mdash; Prophecies, artifacts, and ancient powers</li>
        <li><a href="/world/organizations">Organizations</a> &mdash; Factions pulling the strings</li>
        <li><a href="/world/places">Places</a> &mdash; From La &Uacute;ltima Gota to Brasboredon</li>
      </ul>
    </div>

    <div class="card">
      <h2>Campaign Tools</h2>
      <ul>
        <li><a href="/plot/tracker">Plot Tracker</a> &mdash; Active quests, loose ends, mysteries</li>
        <li><a href="/relations">Relations</a> &mdash; Character &amp; faction diagrams</li>
        <li><a href="/characters/npcs">NPCs</a> &mdash; Every face the party has met</li>
      </ul>
    </div>
  </div>
</div>`;
}

// ── Build ───────────────────────────────────────────

const template = fs.readFileSync(path.join(ROOT, 'template.html'), 'utf-8');

if (fs.existsSync(DIST)) {
  fs.rmSync(DIST, { recursive: true });
}
fs.mkdirSync(DIST, { recursive: true });

console.log('Building Frozen Sick wiki...');
console.log(`Found ${mdFiles.length} markdown files\n`);

for (const relPath of mdFiles) {
  const slug = slugifyPath(relPath);
  const href = '/' + slug;
  const src = fs.readFileSync(path.join(ROOT, relPath), 'utf-8');
  const title = extractTitle(src);

  let content = marked.parse(src);
  content = rewriteLinks(content, path.dirname(path.join(ROOT, relPath)));

  const outFile = path.join(DIST, slug + '.html');
  fs.mkdirSync(path.dirname(outFile), { recursive: true });

  const html = template
    .replace(/\{\{TITLE\}\}/g, title)
    .replace('{{SIDEBAR}}', renderSidebar(href))
    .replace('{{CONTENT}}', content);

  fs.writeFileSync(outFile, html);
  console.log(`  ${relPath} -> ${slug}`);
}

const indexHtml = template
  .replace(/\{\{TITLE\}\}/g, 'Home')
  .replace('{{SIDEBAR}}', renderSidebar('/'))
  .replace('{{CONTENT}}', buildLandingPage());

fs.writeFileSync(path.join(DIST, 'index.html'), indexHtml);
console.log('\n  index.html (landing page)');

fs.copyFileSync(path.join(ROOT, 'style.css'), path.join(DIST, 'style.css'));
console.log('  style.css');

const assetsDir = path.join(ROOT, 'Assets');
const distAssets = path.join(DIST, 'assets');
fs.mkdirSync(distAssets, { recursive: true });

for (const file of fs.readdirSync(assetsDir)) {
  if (/\.(svg|png|jpg|jpeg|webp)$/i.test(file)) {
    const dest = slugify(file.replace(/\.\w+$/, '')) + path.extname(file).toLowerCase();
    fs.copyFileSync(path.join(assetsDir, file), path.join(distAssets, dest));
    console.log(`  asset: ${file} -> ${dest}`);
  }
}

console.log(`\nDone! ${mdFiles.length + 1} pages built in dist/`);
