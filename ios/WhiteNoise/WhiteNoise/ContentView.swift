import SwiftUI

struct ContentView: View {
    @EnvironmentObject private var playback: PlaybackController

    var body: some View {
        ZStack {
            AtmosphereBackground()

            VStack(spacing: 0) {
                header
                    .padding(.top, 12)

                Spacer(minLength: 24)

                playControl

                Spacer(minLength: 24)

                controlsCard
                    .padding(.bottom, 28)
            }
            .padding(.horizontal, 22)
            .padding(.top, 8)
        }
        .alert("Audio error", isPresented: errorBinding) {
            Button("OK", role: .cancel) {
                playback.errorMessage = nil
            }
        } message: {
            Text(playback.errorMessage ?? "")
        }
    }

    private var errorBinding: Binding<Bool> {
        Binding(
            get: { playback.errorMessage != nil },
            set: { if !$0 { playback.errorMessage = nil } }
        )
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("HUSH")
                .font(.system(size: 42, weight: .bold, design: .serif))
                .tracking(6)
                .foregroundStyle(Color(red: 0.93, green: 0.94, blue: 0.90))

            Text("White noise that keeps going — and backs off when your battery needs it.")
                .font(.system(size: 16, weight: .regular, design: .default))
                .foregroundStyle(Color(red: 0.72, green: 0.74, blue: 0.68))
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var playControl: some View {
        VStack(spacing: 18) {
            Button(action: playback.togglePlayback) {
                ZStack {
                    Circle()
                        .fill(
                            RadialGradient(
                                colors: [
                                    Color(red: 0.35, green: 0.55, blue: 0.48).opacity(0.55),
                                    Color(red: 0.12, green: 0.18, blue: 0.16).opacity(0.9)
                                ],
                                center: .center,
                                startRadius: 10,
                                endRadius: 110
                            )
                        )
                        .frame(width: 168, height: 168)
                        .overlay(
                            Circle()
                                .stroke(Color.white.opacity(0.14), lineWidth: 1)
                        )
                        .shadow(color: Color(red: 0.25, green: 0.45, blue: 0.38).opacity(0.35), radius: 28, y: 10)

                    Image(systemName: playback.isPlaying ? "pause.fill" : "play.fill")
                        .font(.system(size: 44, weight: .semibold))
                        .foregroundStyle(Color(red: 0.93, green: 0.95, blue: 0.90))
                        .offset(x: playback.isPlaying ? 0 : 3)
                }
            }
            .buttonStyle(.plain)
            .accessibilityLabel(playback.isPlaying ? "Pause white noise" : "Play white noise")

            Text(playback.statusMessage)
                .font(.system(size: 14, weight: .medium, design: .default))
                .foregroundStyle(Color(red: 0.78, green: 0.80, blue: 0.74))
                .multilineTextAlignment(.center)
                .animation(.easeInOut(duration: 0.25), value: playback.statusMessage)
        }
    }

    private var controlsCard: some View {
        VStack(alignment: .leading, spacing: 20) {
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    Text("Volume")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Color(red: 0.90, green: 0.91, blue: 0.86))
                    Spacer()
                    Text("\(Int((playback.effectiveVolume * 100).rounded()))%")
                        .font(.system(size: 13, weight: .medium, design: .monospaced))
                        .foregroundStyle(Color(red: 0.68, green: 0.78, blue: 0.72))
                }

                Slider(
                    value: $playback.userVolume,
                    in: 0.05...1.0
                )
                .tint(Color(red: 0.45, green: 0.72, blue: 0.62))

                if playback.batteryMultiplier < 1 {
                    Text("Battery saver active — output is \(Int((playback.batteryMultiplier * 100).rounded()))% of your setting.")
                        .font(.system(size: 12))
                        .foregroundStyle(Color(red: 0.86, green: 0.72, blue: 0.48))
                        .transition(.opacity.combined(with: .move(edge: .top)))
                }
            }

            Divider().overlay(Color.white.opacity(0.08))

            batteryRow
        }
        .padding(18)
        .background(
            RoundedRectangle(cornerRadius: 22, style: .continuous)
                .fill(Color.white.opacity(0.05))
                .overlay(
                    RoundedRectangle(cornerRadius: 22, style: .continuous)
                        .stroke(Color.white.opacity(0.08), lineWidth: 1)
                )
        )
        .animation(.easeInOut(duration: 0.3), value: playback.batteryMultiplier)
    }

    private var batteryRow: some View {
        HStack(spacing: 14) {
            Image(systemName: batterySymbol)
                .font(.system(size: 22, weight: .semibold))
                .foregroundStyle(batteryColor)
                .frame(width: 28)

            VStack(alignment: .leading, spacing: 4) {
                Text("Battery \(playback.battery.percentLabel)")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Color(red: 0.92, green: 0.93, blue: 0.88))

                Text(batteryDetail)
                    .font(.system(size: 12))
                    .foregroundStyle(Color(red: 0.68, green: 0.70, blue: 0.64))
            }

            Spacer(minLength: 0)
        }
    }

    private var batterySymbol: String {
        if playback.battery.isCharging {
            return "battery.100.bolt"
        }
        let level = playback.battery.level
        if level >= 0.75 { return "battery.100" }
        if level >= 0.50 { return "battery.75" }
        if level >= 0.25 { return "battery.50" }
        return "battery.25"
    }

    private var batteryColor: Color {
        if playback.battery.isCharging {
            return Color(red: 0.45, green: 0.78, blue: 0.62)
        }
        if playback.battery.level < 0.20 {
            return Color(red: 0.92, green: 0.55, blue: 0.38)
        }
        return Color(red: 0.70, green: 0.78, blue: 0.72)
    }

    private var batteryDetail: String {
        if playback.battery.isCharging {
            return "Charging — volume stays at your setting"
        }
        if playback.battery.level < 0.10 {
            return "Critical — volume deeply reduced"
        }
        if playback.battery.level < 0.20 {
            return "Low — volume reduced to save power"
        }
        if playback.battery.level < 0.30 {
            return "Warm — volume gently trimmed"
        }
        return "Healthy — full volume available"
    }
}

private struct AtmosphereBackground: View {
    @State private var phase: CGFloat = 0

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [
                    Color(red: 0.07, green: 0.10, blue: 0.09),
                    Color(red: 0.10, green: 0.14, blue: 0.13),
                    Color(red: 0.06, green: 0.08, blue: 0.07)
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()

            Circle()
                .fill(Color(red: 0.22, green: 0.38, blue: 0.32).opacity(0.28))
                .frame(width: 340, height: 340)
                .blur(radius: 50)
                .offset(x: -80 + phase * 12, y: -220)

            Circle()
                .fill(Color(red: 0.18, green: 0.22, blue: 0.18).opacity(0.45))
                .frame(width: 280, height: 280)
                .blur(radius: 40)
                .offset(x: 120, y: 280 - phase * 10)
        }
        .onAppear {
            withAnimation(.easeInOut(duration: 8).repeatForever(autoreverses: true)) {
                phase = 1
            }
        }
    }
}

#Preview {
    ContentView()
        .environmentObject(PlaybackController())
        .preferredColorScheme(.dark)
}
