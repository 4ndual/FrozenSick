import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const TARGET_DIRS = ['content', 'src'];
const TEXT_EXTENSIONS = new Set(['.md', '.txt', '.json', '.ts', '.svelte', '.js', '.cjs', '.mjs', '.css', '.html']);
const EXCLUDED_DIRS = new Set(['node_modules', '.git', '.svelte-kit', '.vercel', 'timeline', 'Assets', '.cursor', '.data']);

const CHECKS = [
  { label: 'Use DragonBorn (capital) consistently', pattern: /\bDragon Born\b/g },
  { label: 'Replace Luney legacy variants', pattern: /\bLunei(?:\s+Milei(?:\s+Maili|\s+Meili)?)?\b/g },
  { label: 'Replace DragonBorne typo', pattern: /\bDragonBorne\b/g },
  { label: 'Replace Kenitzira with Nixira Silversong', pattern: /\bKenitzira\b/g },
  { label: 'Replace non-canonical Veil name', pattern: /Veil of the Seven Songs/g },
  { label: 'Replace La Blanca with Centinelas de la Era Blanca', pattern: /\bLa Blanca(?:'s)?\b/g },
  { label: 'Replace malformed Era Blanca variants', pattern: /de era la blanca|de la a la blanca/gi },
  { label: 'Replace La Ultima Gota variant', pattern: /La Ultima Gota/g },
  { label: 'Replace Kahel variants', pattern: /\b(?:Khael Varos|Caelvaros)\b/g },
  { label: 'Replace old Brasboredon chapter numbering', pattern: /Chapter 4 - The Battle of Brasboredon|Chapter 5 - The Escape from Brasboredon/g },
  { label: 'Remove formal Las Cuerdas Rotas references', pattern: /^###\s+Las Cuerdas Rotas\b/gm },
  { label: 'Remove formal Farquad forces organization references', pattern: /^(###+)\s+Farquad(?: Drasky)?'s Forces\b/gm },
  { label: 'Remove formal Malacor network organization references', pattern: /^(###+)\s+Malacor'?s Network\b/gm },
  { label: 'Suspicious mojibake sequence', pattern: /Ã.|Â.|â.|â|�/g },
];

function findBrokenLocalLinks(text, filePath) {
  const matches = [...text.matchAll(/\[[^\]]*]\((?!https?:\/\/|#)([^)]+)\)/g)];
  const broken = [];
  for (const match of matches) {
    const rawTarget = match[1].split('#')[0].trim();
    if (!rawTarget) continue;
    const resolved = path.resolve(path.dirname(filePath), rawTarget);
    try {
      // eslint-disable-next-line no-await-in-loop
      awaitableAccess(resolved);
    } catch {
      broken.push(rawTarget);
    }
  }
  return broken;
}

async function awaitableAccess(targetPath) {
  await fs.access(targetPath);
}

async function* walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (EXCLUDED_DIRS.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(fullPath);
      continue;
    }
    if (!entry.isFile()) continue;
    if (!TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) continue;
    yield fullPath;
  }
}

const findings = [];

for (const dir of TARGET_DIRS) {
  for await (const filePath of walk(path.join(ROOT, dir))) {
    const text = await fs.readFile(filePath, 'utf8');
    const rel = path.relative(ROOT, filePath);
    for (const check of CHECKS) {
      const match = text.match(check.pattern);
      if (!match) continue;
      findings.push({
        file: rel,
        label: check.label,
        count: match.length,
      });
    }

    const brokenLinks = [];
    for (const match of text.matchAll(/\[[^\]]*]\((?!https?:\/\/|#)([^)]+)\)/g)) {
      const rawTarget = match[1].split('#')[0].trim();
      if (!rawTarget) continue;
      if (rawTarget.startsWith('/')) continue;
      const resolved = path.resolve(path.dirname(filePath), rawTarget);
      try {
        // eslint-disable-next-line no-await-in-loop
        await fs.access(resolved);
      } catch {
        brokenLinks.push(rawTarget);
      }
    }
    if (brokenLinks.length > 0) {
      findings.push({
        file: rel,
        label: `Broken local links: ${brokenLinks.slice(0, 3).join(', ')}`,
        count: brokenLinks.length,
      });
    }
  }
}

const chaptersDir = path.join(ROOT, 'content', 'Chapters');
const chapterEntries = await fs.readdir(chaptersDir, { withFileTypes: true });
const chapterNumbers = chapterEntries
  .filter((entry) => entry.isDirectory())
  .map((entry) => {
    const match = entry.name.match(/^Chapter\s+(\d+)\s+-/i);
    return match ? Number(match[1]) : null;
  })
  .filter((value) => value !== null)
  .sort((a, b) => a - b);

for (let index = 0; index < chapterNumbers.length; index += 1) {
  const expected = index + 1;
  if (chapterNumbers[index] !== expected) {
    findings.push({
      file: 'content/Chapters',
      label: `Chapter numbering gap: expected Chapter ${expected} but found Chapter ${chapterNumbers[index]}`,
      count: 1,
    });
  }
}

if (findings.length === 0) {
  console.log('Wiki audit passed: no canonical-name, numbering, or mojibake issues detected.');
  process.exit(0);
}

console.error('Wiki audit found issues:');
for (const finding of findings) {
  console.error(`- ${finding.file}: ${finding.label} (${finding.count})`);
}
process.exit(1);
