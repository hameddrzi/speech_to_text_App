/**
 * Stable `testID`s for end-to-end tests (Maestro flows in `.maestro/`, see docs/testing.md).
 *
 * Rules:
 * - kebab-case, never derived from user-visible copy, so text and translations can change freely.
 * - Every id a flow uses must be listed here; `node scripts/check-e2e-ids.js` verifies it.
 * - On Android a testID becomes the view's `resource-id`, on iOS its `accessibilityIdentifier`.
 *   Put it on the touchable itself (Pressable / TextInput), not on a decorative child.
 */
export const TestIDs = {
  // Tab bar
  tab: {
    record: 'tab-record',
    archive: 'tab-archive',
    profile: 'tab-profile',
  },

  // Record screen
  record: {
    button: 'record-button',
    pauseResume: 'record-pause-resume',
    discard: 'record-discard',
    timer: 'record-timer',
    status: 'record-status',
    liveTranscript: 'live-transcript-card',
    modelPill: 'model-pill',
    savedToast: 'saved-toast',
    savedToastView: 'saved-toast-view',
    permissionCard: 'permission-card',
    permissionAction: 'permission-card-action',
    permissionDismiss: 'permission-card-dismiss',
  },

  // Archive list
  archive: {
    list: 'archive-list',
    search: 'archive-search',
    searchClear: 'archive-search-clear',
    filterAll: 'archive-filter-all',
    filterFavorites: 'archive-filter-favorites',
    filterTranscribed: 'archive-filter-transcribed',
    emptyState: 'archive-empty-state',
    /** Prefix; the full id is `recording-row-<recording id>` (see `recordingRow`). */
    rowPrefix: 'recording-row-',
    rowFavorite: 'row-action-favorite',
    rowShare: 'row-action-share',
    rowDelete: 'row-action-delete',
    chipDone: 'status-chip-done',
    chipProcessing: 'status-chip-processing',
    chipWaiting: 'status-chip-waiting',
    chipRetry: 'status-chip-retry',
  },

  // Recording detail screen
  detail: {
    back: 'detail-back',
    export: 'detail-export',
    share: 'detail-share',
    delete: 'detail-delete',
    title: 'detail-title',
    titleInput: 'detail-title-input',
    meta: 'detail-meta',
    play: 'detail-play-pause',
    skipBack: 'detail-skip-back',
    skipForward: 'detail-skip-forward',
    speed: 'detail-speed',
    favorite: 'detail-favorite',
    scrubber: 'detail-scrubber',
    position: 'detail-position',
    remaining: 'detail-remaining',
    copyText: 'transcript-copy',
    /** Prefix; the full id is `transcript-segment-<index>` (see `transcriptSegment`). */
    segmentPrefix: 'transcript-segment-',
    noticeAction: 'transcript-notice-action',
    processing: 'transcript-processing',
  },

  // Export sheet (detail → download button)
  exportSheet: {
    sheet: 'export-sheet',
    done: 'export-done',
    optionPdf: 'export-option-pdf',
    optionMd: 'export-option-md',
    sharePdf: 'export-share-pdf',
    shareMd: 'export-share-md',
    success: 'export-success',
    error: 'export-error',
    changeFolder: 'export-change-folder',
  },

  // Profile screen
  profile: {
    scroll: 'profile-scroll',
    nameEdit: 'profile-name-edit',
    nameInput: 'name-sheet-input',
    nameSave: 'name-sheet-save',
    nameCancel: 'name-sheet-cancel',
    speechModelRow: 'speech-model-row',
    modelGet: 'model-download-get',
    modelCancel: 'model-download-cancel',
    modelRemove: 'model-remove',
    modelStatusRow: 'model-status-row',
    liveTranscriptSwitch: 'live-transcript-switch',
    hapticsSwitch: 'haptics-switch',
    autoDeleteRow: 'delete-recordings-row',
  },

  // Option sheets (prefix → `<prefix>-sheet`, `<prefix>-sheet-done`, `<prefix>-option-<value>`)
  optionSheet: {
    model: 'model',
    autoDelete: 'auto-delete',
  },

  // Shared bottom sheet
  sheetBackdrop: 'sheet-backdrop',
} as const;

export const recordingRow = (id: string) => `${TestIDs.archive.rowPrefix}${id}`;
export const transcriptSegment = (index: number) => `${TestIDs.detail.segmentPrefix}${index}`;
export const optionSheetIds = (prefix: string) => ({
  sheet: `${prefix}-sheet`,
  done: `${prefix}-sheet-done`,
  option: (value: string) => `${prefix}-option-${value}`,
});
