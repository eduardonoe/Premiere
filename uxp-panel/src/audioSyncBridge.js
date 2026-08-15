// Bridge for the Audio Sync module.
// This file defines the intended access pattern for selecting timeline clips,
// sending audio data to the sync engine, and applying timeline offsets.

export const SyncStatus = Object.freeze({
  MATCHED: 'matched',
  REVIEW: 'review',
  NO_MATCH: 'no_match',
  ERROR: 'error',
});

export const ReferenceMode = Object.freeze({
  AUTO: 'auto',
  EXTERNAL_AUDIO: 'external_audio',
  CAMERA_AUDIO: 'camera_audio',
});

export const MoveMode = Object.freeze({
  MOVE_VIDEO_TO_AUDIO: 'move_video_to_audio',
  MOVE_AUDIO_TO_VIDEO: 'move_audio_to_video',
  PRESERVE_REFERENCE: 'preserve_reference',
});

export function createDefaultSyncOptions() {
  return {
    referenceMode: ReferenceMode.AUTO,
    moveMode: MoveMode.PRESERVE_REFERENCE,
    minConfidence: 0.78,
    preserveTracks: true,
    addMarkers: true,
    dryRun: true,
  };
}

export async function findSelectedTimelineItems() {
  // TODO: Wire to Premiere UXP active sequence/timeline selection API.
  // Expected return: array of selected timeline item descriptors:
  // {
  //   id,
  //   type: 'video' | 'audio' | 'linked_av',
  //   trackIndex,
  //   startTicks,
  //   endTicks,
  //   mediaPath,
  //   hasAudio,
  //   linkedItemIds: []
  // }
  throw new Error('findSelectedTimelineItems() must be connected to the Premiere UXP API.');
}

export function classifySyncSelection(items) {
  const videos = [];
  const audios = [];
  const linked = [];

  for (const item of items) {
    if (item.type === 'video') videos.push(item);
    if (item.type === 'audio') audios.push(item);
    if (item.type === 'linked_av') linked.push(item);
  }

  return {
    videos,
    audios,
    linked,
    total: items.length,
    canSync: items.length >= 2 && (audios.length > 0 || linked.some((item) => item.hasAudio)),
  };
}

export async function runAudioSyncAnalysis(items, options = createDefaultSyncOptions()) {
  // TODO: Send media paths/time ranges to the native sync engine or worker.
  // The sync engine should return offsets and confidence scores without moving clips.
  void items;
  void options;
  throw new Error('runAudioSyncAnalysis() must be connected to the Audio Sync Engine.');
}

export async function applySyncOffsets(syncResult, options = createDefaultSyncOptions()) {
  // TODO: Move timeline items according to offsets returned by the sync engine.
  // Must preserve tracks by default and must not apply low-confidence matches automatically.
  void syncResult;
  void options;
  throw new Error('applySyncOffsets() must be connected to timeline mutation APIs.');
}

export async function syncSelectedTimelineItems(options = createDefaultSyncOptions()) {
  const items = await findSelectedTimelineItems();
  const selection = classifySyncSelection(items);

  if (!selection.canSync) {
    throw new Error('Select at least two timeline items with usable audio.');
  }

  const result = await runAudioSyncAnalysis(items, options);

  if (options.dryRun) {
    return {
      applied: false,
      selection,
      result,
    };
  }

  const applied = await applySyncOffsets(result, options);

  return {
    applied: true,
    selection,
    result,
    appliedCount: applied.count,
  };
}
