/**
 * @typedef {{ level: number, charging: boolean }} BatterySnapshot
 *
 * @typedef {object} BatteryPort
 * @property {() => BatterySnapshot} getSnapshot
 * @property {(listener: (snap: BatterySnapshot) => void) => () => void} subscribe
 *   Returns an unsubscribe function.
 */

export {};
