# Hush — White Noise for iOS

Native SwiftUI app that generates continuous white noise and automatically
reduces volume as battery life drops.

## Features

- **Indefinite playback** — procedural white noise via `AVAudioEngine` / `AVAudioSourceNode` (no audio files)
- **Background audio** — keeps playing with the screen locked (`UIBackgroundModes: audio`)
- **Battery-aware volume** — watches `UIDevice` battery level and trims output while unplugged:

  | Battery (unplugged) | Volume vs your setting |
  | ------------------- | ---------------------- |
  | ≥ 30%               | 100%                   |
  | 20–30%              | 80%                    |
  | 10–20%              | 55%                    |
  | &lt; 10%            | 30%                    |

  While **charging** or **full**, volume stays at your setting regardless of level.

- **Idle timer disabled** while playing so the phone doesn’t interrupt for timeout reasons mid-session

## Open & run

Requires a Mac with Xcode 15+ (iOS 16 deployment target).

1. Open `WhiteNoise.xcodeproj` in Xcode
2. Select your Team under **Signing & Capabilities** (bundle id: `com.pmcgartoll.hush`)
3. Run on a physical iPhone for real battery readings (Simulator often reports level as unknown/`-1`, which this app treats as 100%)

```bash
open ios/WhiteNoise/WhiteNoise.xcodeproj
```

## Project layout

```
WhiteNoise/
├── WhiteNoiseApp.swift          # App entry
├── ContentView.swift            # UI
├── PlaybackController.swift     # Play/pause + battery volume policy
├── Audio/WhiteNoiseEngine.swift # Noise generation
├── Battery/BatteryMonitor.swift # UIDevice battery observation
├── Info.plist                   # Background audio mode
└── Assets.xcassets
```

## Notes

- Lower volume reduces DAC/amplifier draw a bit; the bigger battery win vs silence is modest, but progressive reduction keeps the sound usable longer on a dying phone instead of cutting out abruptly.
- White noise is generated sample-by-sample on the audio render thread; gain is shared through a lock-backed box so slider/battery updates apply without glitching the engine graph.
