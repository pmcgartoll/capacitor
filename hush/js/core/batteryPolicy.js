/**
 * Pure battery → volume policy. No DOM, no native APIs.
 * Same thresholds as the Swift Hush app.
 */

/** @typedef {{ level: number, charging: boolean }} BatterySnapshot */

/**
 * Volume multiplier applied to the user's volume setting.
 * Charging/full always returns 1.0.
 *
 * @param {BatterySnapshot} battery
 * @returns {number} multiplier in [0.3, 1]
 */
export function batteryVolumeMultiplier(battery) {
  if (!battery || typeof battery.level !== 'number') return 1;
  if (battery.charging) return 1;

  const level = clamp01(battery.level);
  if (level >= 0.3) return 1.0;
  if (level >= 0.2) return 0.8;
  if (level >= 0.1) return 0.55;
  return 0.3;
}

/**
 * Human-readable detail for the current battery band.
 * @param {BatterySnapshot} battery
 * @returns {string}
 */
export function batteryDetail(battery) {
  if (!battery) return 'Battery unknown';
  if (battery.charging) return 'Charging — volume stays at your setting';
  const level = clamp01(battery.level);
  if (level < 0.1) return 'Critical — volume deeply reduced';
  if (level < 0.2) return 'Low — volume reduced to save power';
  if (level < 0.3) return 'Warm — volume gently trimmed';
  return 'Healthy — full volume available';
}

/**
 * @param {BatterySnapshot} battery
 * @returns {string} e.g. "72%"
 */
export function batteryPercentLabel(battery) {
  if (!battery || typeof battery.level !== 'number' || Number.isNaN(battery.level)) {
    return '—';
  }
  return `${Math.round(clamp01(battery.level) * 100)}%`;
}

/**
 * Map UI volume (0..1) and battery multiplier into engine gain.
 * @param {number} userVolume
 * @param {number} multiplier
 * @returns {number}
 */
export function effectiveGain(userVolume, multiplier) {
  const vol = clamp01(userVolume);
  const mult = typeof multiplier === 'number' ? multiplier : 1;
  return vol * mult * 0.55;
}

/**
 * @param {number} userVolume
 * @param {number} multiplier
 * @returns {number} effective volume 0..1 (before engine scale)
 */
export function effectiveVolume(userVolume, multiplier) {
  return clamp01(userVolume) * (typeof multiplier === 'number' ? multiplier : 1);
}

function clamp01(n) {
  if (typeof n !== 'number' || Number.isNaN(n)) return 0;
  return Math.min(1, Math.max(0, n));
}
