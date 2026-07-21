/**
 * Contract stubs for Capacitor / Swift native adapters.
 * Not used at runtime in the web build — documented so the shell can swap ports.
 *
 * NativeAudioAdapter (iOS):
 *   - AVAudioEngine white-noise source (see ios/WhiteNoise/…/WhiteNoiseEngine.swift)
 *   - UIBackgroundModes: audio
 *   - Implements AudioPort: start / stop / setGain / isPlaying
 *
 * NativeBatteryAdapter (iOS):
 *   - UIDevice.isBatteryMonitoringEnabled = true
 *   - Implements BatteryPort: getSnapshot / subscribe
 *
 * Wire-up sketch (Capacitor):
 *   const audio = Capacitor.isNativePlatform()
 *     ? new NativeAudioAdapter()
 *     : new WebAudioAdapter();
 *   const battery = Capacitor.isNativePlatform()
 *     ? new NativeBatteryAdapter()
 *     : new WebBatteryAdapter();
 */

export const NATIVE_ADAPTER_NOTES = {
  audio: 'Use AVAudioEngine for lock-screen / background playback on iOS.',
  battery: 'Use UIDevice battery monitoring; Safari has no Battery Status API.'
};
