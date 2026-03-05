export interface NavItem {
  title: string;
  href: string;
  external?: boolean;
}

export interface NavSection {
  section: string;
  children: (NavItem & { sub?: NavItem[] })[];
}

export type NavEntry = NavItem | NavSection;

export function isSection(entry: NavEntry): entry is NavSection {
  return 'section' in entry && 'children' in entry;
}

export const WIKI_NAV: NavEntry[] = [
  { title: 'Home', href: '/' },
  {
    section: 'Chapters',
    children: [
      { title: 'Ch 1 — The Tavern', href: '/chapters/chapter-1-the-tavern/summary' },
      { title: 'Ch 2 — The Plateau', href: '/chapters/chapter-2-the-plateau/summary' },
      {
        title: 'Ch 3 — The Flying Turtle',
        href: '/chapters/chapter-3-the-flying-turtle/summary',
        sub: [{ title: 'Missing: Branig', href: '/chapters/chapter-3-the-flying-turtle/missing-branig-and-the-mysterious-woman' }],
      },
      {
        title: 'Ch 4 — Battle of Brasboredon',
        href: '/chapters/chapter-4-the-battle-of-brasboredon/summary',
        sub: [{ title: "Missing: Demon's Lair", href: '/chapters/chapter-4-the-battle-of-brasboredon/missing-demons-lair-to-brasboredon' }],
      },
      { title: 'Ch 5 — Escape from Brasboredon', href: '/chapters/chapter-5-the-escape-from-brasboredon/summary' },
    ],
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
    ],
  },
  {
    section: 'World',
    children: [
      { title: 'Lore', href: '/world/lore' },
      { title: 'Organizations', href: '/world/organizations' },
      { title: 'Places', href: '/world/places' },
    ],
  },
  { title: 'Plot Tracker', href: '/plot/tracker' },
  { title: 'Relations', href: '/relations' },
  { title: '⟳ Timeline', href: '/timeline/' },
];
