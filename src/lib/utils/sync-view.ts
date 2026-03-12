export type HeaderSyncState = 'viewing' | 'draft' | 'saved' | 'synced' | 'behind' | 'error';

export type TimelineSyncStatus = 'idle' | 'synced' | 'dirty' | 'saving' | 'loading' | 'error';
export type WikiSyncStatus = 'viewing' | 'draft' | 'saved' | 'synced' | 'behind';

export interface SyncViewModel {
  state: HeaderSyncState;
  busy: boolean;
  label: string;
}

/**
 * Map timeline-internal sync states to the shared header sync contract.
 */
export function timelineSyncToHeader(
  status: TimelineSyncStatus,
  behindPublished = false,
): SyncViewModel {
  if (status === 'error') {
    return { state: 'error', busy: false, label: 'Error' };
  }
  if (status === 'saving') {
    return { state: 'saved', busy: true, label: 'Saving' };
  }
  if (status === 'loading') {
    return { state: 'saved', busy: true, label: 'Updating' };
  }
  if (behindPublished) {
    return { state: 'behind', busy: false, label: 'Behind' };
  }
  if (status === 'dirty') {
    return { state: 'draft', busy: false, label: 'Unsaved' };
  }
  if (status === 'synced') {
    return { state: 'synced', busy: false, label: 'Synced' };
  }
  return { state: 'viewing', busy: false, label: 'Viewing' };
}

/**
 * Map wiki-internal sync states to the shared header sync contract.
 */
export function wikiSyncToHeader(status: WikiSyncStatus): SyncViewModel {
  switch (status) {
    case 'draft':
      return { state: 'draft', busy: false, label: 'Draft' };
    case 'saved':
      return { state: 'saved', busy: false, label: 'Saved' };
    case 'synced':
      return { state: 'synced', busy: false, label: 'Synced' };
    case 'behind':
      return { state: 'behind', busy: false, label: 'Behind' };
    default:
      return { state: 'viewing', busy: false, label: 'Viewing' };
  }
}
