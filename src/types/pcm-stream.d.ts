declare module '@fugood/react-native-audio-pcm-stream' {
  type Options = {
    sampleRate: number;
    channels: 1 | 2;
    bitsPerSample: 8 | 16;
    /** Android MediaRecorder.AudioSource; 6 = VOICE_RECOGNITION. */
    audioSource?: number;
    bufferSize?: number;
    wavFile: string;
  };
  type Subscription = { remove: () => void };
  const LiveAudioStream: {
    init: (options: Options) => Promise<void> | void;
    start: () => void;
    stop: () => Promise<string> | void;
    /** Base64-encoded PCM chunks. */
    on: (event: 'data', callback: (base64: string) => void) => Subscription;
  };
  export default LiveAudioStream;
}
