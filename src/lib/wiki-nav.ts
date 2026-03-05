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
