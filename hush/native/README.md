# Native adapters (Capacitor / Swift)

The web build uses `WebAudioAdapter` + `WebBatteryAdapter`. On a real iPhone shell,
swap those ports for native implementations.

## Suggested Capacitor wiring

```js
import { Capacitor } from '@capacitor/core';
import { WebAudioAdapter } from '../js/adapters/webAudioAdapter.js';
import { WebBatteryAdapter } from '../js/adapters/webBatteryAdapter.js';
// import { NativeAudioAdapter } from './NativeAudioAdapter';
// import { NativeBatteryAdapter } from './NativeBatteryAdapter';

export function createPorts() {
  if (Capacitor.isNativePlatform()) {
    return {
      audio: new NativeAudioAdapter(),
      battery: new NativeBatteryAdapter()
    };
  }
  return {
    audio: new WebAudioAdapter(),
    battery: new WebBatteryAdapter()
  };
}
```

## Port contracts

See `js/ports/audioPort.js` and `js/ports/batteryPort.js`.

Reference native implementations already live in the sibling Swift app:

- Audio → `ios/WhiteNoise/WhiteNoise/Audio/WhiteNoiseEngine.swift`
- Battery → `ios/WhiteNoise/WhiteNoise/Battery/BatteryMonitor.swift`

Those can be wrapped as Capacitor plugins without changing the pure TS/JS core.
