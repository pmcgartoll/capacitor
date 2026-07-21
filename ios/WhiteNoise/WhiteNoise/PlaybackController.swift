import Combine
import SwiftUI
import UIKit

/// Coordinates white-noise playback with battery-aware volume reduction.
@MainActor
final class PlaybackController: ObservableObject {
    @Published var isPlaying = false
    @Published var userVolume: Double = 0.55
    @Published var effectiveVolume: Double = 0.55
    @Published var batteryMultiplier: Double = 1.0
    @Published var statusMessage: String = "Ready"
    @Published var errorMessage: String?

    let battery = BatteryMonitor()
    private let engine = WhiteNoiseEngine()
    private var cancellables = Set<AnyCancellable>()

    /// Battery thresholds → volume multipliers (applied only while unplugged).
    /// Above 30%: full user volume.
    /// 20–30%: gentle trim.
    /// 10–20%: stronger trim.
    /// Below 10%: deep trim to stretch remaining charge.
    private let thresholds: [(minLevel: Float, multiplier: Double)] = [
        (0.30, 1.00),
        (0.20, 0.80),
        (0.10, 0.55),
        (0.00, 0.30)
    ]

    init() {
        battery.$level
            .combineLatest(battery.$state, $userVolume)
            .receive(on: DispatchQueue.main)
            .sink { [weak self] _, _, _ in
                self?.applyVolumePolicy()
            }
            .store(in: &cancellables)

        applyVolumePolicy()
    }

    func togglePlayback() {
        if isPlaying {
            stop()
        } else {
            start()
        }
    }

    func start() {
        errorMessage = nil
        do {
            try engine.configureSession()
            applyVolumePolicy()
            try engine.start()
            isPlaying = true
            UIApplication.shared.isIdleTimerDisabled = true
            statusMessage = "Playing indefinitely"
        } catch {
            isPlaying = false
            errorMessage = error.localizedDescription
            statusMessage = "Could not start audio"
        }
    }

    func stop() {
        engine.stop()
        isPlaying = false
        UIApplication.shared.isIdleTimerDisabled = false
        statusMessage = "Paused"
    }

    private func applyVolumePolicy() {
        let multiplier = computeBatteryMultiplier()
        batteryMultiplier = multiplier
        let effective = userVolume * multiplier
        effectiveVolume = effective
        // Map UI 0...1 into a comfortable noise gain range.
        let gain = Float(effective) * 0.55
        engine.updateGain(gain)

        if battery.isCharging {
            statusMessage = isPlaying
                ? "Playing · charging — full volume"
                : "Ready · charging"
        } else if multiplier < 1 {
            let pct = Int((battery.level * 100).rounded())
            statusMessage = isPlaying
                ? "Playing · battery \(pct)% — volume reduced"
                : "Ready · battery \(pct)% — volume will reduce"
        } else if isPlaying {
            statusMessage = "Playing indefinitely"
        }
    }

    private func computeBatteryMultiplier() -> Double {
        // While charging or full, never throttle — the phone is plugged in.
        if battery.isCharging {
            return 1.0
        }
        let level = battery.level
        for threshold in thresholds {
            if level >= threshold.minLevel {
                return threshold.multiplier
            }
        }
        return 0.30
    }
}
