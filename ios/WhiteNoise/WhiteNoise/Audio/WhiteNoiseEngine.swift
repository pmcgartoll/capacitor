import AVFoundation
import Foundation

/// Generates continuous white noise with AVAudioEngine and plays indefinitely.
final class WhiteNoiseEngine {
    private let engine = AVAudioEngine()
    private var sourceNode: AVAudioSourceNode?
    private let gainBox = GainBox(initial: 0.35)
    private var isConfigured = false

    var isPlaying: Bool { engine.isRunning }

    func configureSession() throws {
        let session = AVAudioSession.sharedInstance()
        try session.setCategory(
            .playback,
            mode: .default,
            options: [.mixWithOthers]
        )
        try session.setActive(true)
    }

    func start() throws {
        if !isConfigured {
            try attachSourceNode()
            isConfigured = true
        }
        if !engine.isRunning {
            try engine.start()
        }
    }

    func stop() {
        guard engine.isRunning else { return }
        engine.stop()
    }

    /// Linear gain applied to generated samples (0...1).
    func updateGain(_ value: Float) {
        gainBox.value = max(0, min(1, value))
    }

    private func attachSourceNode() throws {
        let mainMixer = engine.mainMixerNode
        guard let format = AVAudioFormat(
            standardFormatWithSampleRate: 44_100,
            channels: 1
        ) else {
            throw EngineError.invalidFormat
        }

        let box = gainBox
        // Simple LCG kept off the system RNG so the realtime audio thread stays lock-free.
        let rng = NoiseRNG(seed: 0xC0FFEE)
        let node = AVAudioSourceNode(format: format) { _, _, frameCount, audioBufferList -> OSStatus in
            let ablPointer = UnsafeMutableAudioBufferListPointer(audioBufferList)
            let currentGain = box.value
            for buffer in ablPointer {
                guard let data = buffer.mData?.assumingMemoryBound(to: Float.self) else {
                    continue
                }
                let count = Int(frameCount)
                for i in 0..<count {
                    // Uniform white noise in [-1, 1], scaled by gain.
                    data[i] = rng.nextSample() * currentGain
                }
            }
            return noErr
        }

        engine.attach(node)
        engine.connect(node, to: mainMixer, format: format)
        mainMixer.outputVolume = 1.0
        sourceNode = node
    }

    enum EngineError: LocalizedError {
        case invalidFormat

        var errorDescription: String? {
            switch self {
            case .invalidFormat:
                return "Could not create an audio format for white noise."
            }
        }
    }
}

/// Shared gain for the realtime audio callback.
/// Aligned Float load/store is atomic on ARM64; avoid locks on the render thread.
private final class GainBox: @unchecked Sendable {
    private var raw: Float

    init(initial: Float) {
        raw = initial
    }

    var value: Float {
        get { raw }
        set { raw = newValue }
    }
}

/// Minimal LCG for realtime-safe white noise samples in [-1, 1].
private final class NoiseRNG: @unchecked Sendable {
    private var state: UInt64

    init(seed: UInt64) {
        state = seed == 0 ? 1 : seed
    }

    func nextSample() -> Float {
        state = state &* 6364136223846793005 &+ 1
        let bits = UInt32(truncatingIfNeeded: state >> 32)
        // Map to [0, 1) then to [-1, 1].
        let unit = Float(bits) / Float(UInt32.max)
        return unit * 2 - 1
    }
}
