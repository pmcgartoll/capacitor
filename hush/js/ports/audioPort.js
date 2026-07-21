/**
 * @typedef {object} AudioPort
 * @property {() => Promise<void>} start
 * @property {() => void} stop
 * @property {(gain: number) => void} setGain  gain in [0, 1]
 * @property {() => boolean} isPlaying
 */

export {};
