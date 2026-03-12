export type NavItemKind = 'file' | 'folder' | 'special';

export interface NavItem {
  title: string;
  href: string;
  external?: boolean;
  /**
   * Canonical repository target for mutation actions.
   * - file: content/.../entry.md
   * - folder: content/.../Folder Name
   * - special: undefined (non-content links such as Home/Timeline/Map)
   */
  sourcePath?: string;
  kind?: NavItemKind;
  sub?: NavItem[];
}

export interface NavSection {
  section: string;
  sourcePath?: string;
  children: NavItem[];
}

export type NavEntry = NavItem | NavSection;

export function isSection(entry: NavEntry): entry is NavSection {
  return 'section' in entry && 'children' in entry;
}
