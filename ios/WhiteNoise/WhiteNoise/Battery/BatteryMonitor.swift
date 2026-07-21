import Combine
import UIKit

/// Observes device battery level/state and publishes updates on the main thread.
final class BatteryMonitor: ObservableObject {
    @Published private(set) var level: Float
    @Published private(set) var state: UIDevice.BatteryState
    @Published private(set) var isMonitoringEnabled: Bool

    private var observers: [NSObjectProtocol] = []

    init() {
        let device = UIDevice.current
        device.isBatteryMonitoringEnabled = true
        isMonitoringEnabled = device.isBatteryMonitoringEnabled
        // On simulator, batteryLevel is often -1.0; treat unknown as full.
        let raw = device.batteryLevel
        level = raw < 0 ? 1.0 : raw
        state = device.batteryState

        let center = NotificationCenter.default
        observers.append(
            center.addObserver(
                forName: UIDevice.batteryLevelDidChangeNotification,
                object: nil,
                queue: .main
            ) { [weak self] _ in
                self?.refresh()
            }
        )
        observers.append(
            center.addObserver(
                forName: UIDevice.batteryStateDidChangeNotification,
                object: nil,
                queue: .main
            ) { [weak self] _ in
                self?.refresh()
            }
        )
    }

    deinit {
        observers.forEach(NotificationCenter.default.removeObserver)
        UIDevice.current.isBatteryMonitoringEnabled = false
    }

    func refresh() {
        let device = UIDevice.current
        let raw = device.batteryLevel
        level = raw < 0 ? 1.0 : raw
        state = device.batteryState
        isMonitoringEnabled = device.isBatteryMonitoringEnabled
    }

    var isCharging: Bool {
        state == .charging || state == .full
    }

    var percentLabel: String {
        "\(Int((level * 100).rounded()))%"
    }
}
