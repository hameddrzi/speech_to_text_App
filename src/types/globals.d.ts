// React Native exposes `global`; whisper.rn's TypeScript sources (resolved via the "react-native" export condition) use it.
// eslint-disable-next-line no-var
declare var global: typeof globalThis;
