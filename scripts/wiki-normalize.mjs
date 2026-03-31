import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const TARGET_DIRS = ['content', 'src'];
const TEXT_EXTENSIONS = new Set(['.md', '.txt', '.json', '.ts', '.svelte', '.js', '.cjs', '.mjs', '.css', '.html']);
const EXCLUDED_DIRS = new Set(['node_modules', '.git', '.svelte-kit', '.vercel', 'timeline', 'Assets', '.cursor', '.data']);

const REPLACEMENTS = [
  [/Dragon Born/g, 'DragonBorn'],
  [/La Última Gota/g, 'La ultima Gota'],
  [/La última Gota/g, 'La ultima Gota'],
  [/La última gota/g, 'La ultima Gota'],
  [/La Última gota/g, 'La ultima Gota'],
  [/La Ultima Gota/g, 'La ultima Gota'],
  [/El Unei/g, 'La ultima Gota'],
  [/Lunei Milei Meili/g, 'Luney IcePeak'],
  [/Lunei Miley Maili/g, 'Luney IcePeak'],
  [/Lunei Milei Maili/g, 'Luney IcePeak'],
  [/Kenitzira/g, 'Nixira Silversong'],
  [/Veil of the Seven Songs/g, 'El Velo de las Siete Canciones'],
  [/White Era Sentinels/g, 'Centinelas de la Era Blanca'],
  [/Los Centinelas de Era la Blanca/g, 'Centinelas de la Era Blanca'],
  [/Centinelas de era la blanca/gi, 'Centinelas de la Era Blanca'],
  [/de la a la blanca/gi, 'de la Era Blanca'],
  [/La Blanca's/g, 'Centinelas de la Era Blanca'],
  [/\bLa Blanca\b/g, 'Centinelas de la Era Blanca'],
  [/Khael Varos/g, 'Kahel Varos'],
  [/Caelvaros/g, 'Kahel Varos'],
  [/Line the Wyrmling/g, 'Chimuelo the Wyrmling'],
  [/names it Line/g, 'names it Chimuelo'],
  [/where Line was kept/g, 'where Chimuelo was kept'],
  [/\bLine is in the cave\b/g, 'Chimuelo is in the cave'],
  [/DragonBorne/g, 'DragonBorn'],
  [/â€”/g, '—'],
  [/â€“/g, '–'],
  [/â€˜/g, '‘'],
  [/â€™/g, '’'],
  [/â€œ/g, '“'],
  [/â€�/g, '”'],
  [/â€¦/g, '…'],
  [/â†’/g, '→'],
  [/ÃƒÂ¡/g, 'á'],
  [/ÃƒÂ©/g, 'é'],
  [/ÃƒÂ­/g, 'í'],
  [/ÃƒÂ³/g, 'ó'],
  [/ÃƒÂº/g, 'ú'],
  [/ÃƒÂ±/g, 'ñ'],
  [/Ãƒâ€š/g, ''],
  [/Ã¡/g, 'á'],
  [/Ã©/g, 'é'],
  [/Ãí/g, 'í'],
  [/Ã³/g, 'ó'],
  [/Ãº/g, 'ú'],
  [/Ã±/g, 'ñ'],
  [/Ã/g, 'Á'],
  [/Ã‰/g, 'É'],
  [/Ã/g, 'Í'],
  [/Ã“/g, 'Ó'],
  [/Ãš/g, 'Ú'],
  [/Ã‘/g, 'Ñ'],
  [/Â¿/g, '¿'],
  [/Â¡/g, '¡'],
  [/Â/g, ''],
];

function mojibakeScore(text) {
  const matches = text.match(/Ã.|Â.|â.|â|�/g);
  return matches ? matches.length : 0;
}

function repairMojibake(text) {
  let current = text;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (mojibakeScore(current) === 0) break;

    const repaired = Buffer.from(current, 'latin1').toString('utf8');
    if (mojibakeScore(repaired) >= mojibakeScore(current)) break;
    current = repaired;
  }

  return current;
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

async function normalizeFile(filePath) {
  const original = await fs.readFile(filePath, 'utf8');
  let next = repairMojibake(original);
  for (const [pattern, replacement] of REPLACEMENTS) {
    next = next.replace(pattern, replacement);
  }
  if (next !== original) {
    await fs.writeFile(filePath, next, 'utf8');
    return true;
  }
  return false;
}

let changed = 0;
for (const dir of TARGET_DIRS) {
  const fullDir = path.join(ROOT, dir);
  for await (const filePath of walk(fullDir)) {
    if (await normalizeFile(filePath)) {
      changed += 1;
      console.log('normalized', path.relative(ROOT, filePath));
    }
  }
}

console.log(`Normalization complete. Updated ${changed} file(s).`);
