import SwiftUI

@main
struct WhiteNoiseApp: App {
    @StateObject private var playback = PlaybackController()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(playback)
                .preferredColorScheme(.dark)
        }
    }
}
