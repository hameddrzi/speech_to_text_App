import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { useRecordings } from '@/store/recordings';
import { recoverOrphans } from '@/stt/recover-orphans';

/**
 * Short pause before scanning, so launch isn't slowed down and the recordings store has certainly
 * finished loading (the scan compares the files on disk against it).
 */
const SCAN_DELAY_MS = 1500;

/**
 * Renders nothing. Once per mount of the root layout, adds any take that was left on disk without a
 * recording (app killed mid-take, crash, Activity recreated while recording) as "Recovered Recording".
 * Mounted inside RecordingsProvider; uses only its public API.
 */
export function OrphanRecovery() {
  const store = useRecordings();
  const latest = useRef(store);
  useEffect(() => {
    latest.current = store;
  });

  // Runs once per mount; reads the store through the ref when the timer fires.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const timer = setTimeout(() => {
      const { recordings, addRecording } = latest.current;
      for (const rec of recoverOrphans(recordings)) addRecording(rec);
    }, SCAN_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  return null;
}
