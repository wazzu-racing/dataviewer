/**
 * Time formatting utilities for the graph x-axis.
 *
 * The datalogger stores time as integer millisecond counters. The `unixtime`
 * field holds the wall-clock UTC time for each row. Together these allow us to
 * display both relative (elapsed) and absolute (wall-clock) timestamps.
 */

// ---------------------------------------------------------------------------
// Field classification
// ---------------------------------------------------------------------------

/** Fields that represent a millisecond counter and can be formatted as timestamps. */
export const TIME_FIELDS = new Set([
	'write_millis',
	'ecu_millis',
	'gps_millis',
	'imu_millis',
	'accel_millis',
	'analogx1_millis',
	'analogx2_millis',
	'analogx3_millis',
	'time'
]);

/** Returns true when the given field name is a millisecond-counter time field. */
export function isTimeField(field: string): boolean {
	return TIME_FIELDS.has(field);
}

// ---------------------------------------------------------------------------
// Relative formatting — "elapsed since start"
// ---------------------------------------------------------------------------

/**
 * Formats a raw millisecond offset (relative to the start of recording) as a
 * human-readable elapsed time string.
 *
 * Examples:
 *   0       → "0:00.000"
 *   61234   → "1:01.234"
 *   3723456 → "1:02:03.456"
 *
 * @param ms - Milliseconds elapsed since recording start (i.e. value minus
 *             the first row's value for the selected field).
 */
export function formatRelative(ms: number): string {
	const absMs = Math.abs(ms);
	const sign = ms < 0 ? '-' : '';

	const totalSeconds = Math.floor(absMs / 1000);
	const millis = Math.floor(absMs % 1000);
	const seconds = totalSeconds % 60;
	const totalMinutes = Math.floor(totalSeconds / 60);
	const minutes = totalMinutes % 60;
	const hours = Math.floor(totalMinutes / 60);

	const mmm = String(millis).padStart(3, '0');
	const ss = String(seconds).padStart(2, '0');

	if (hours > 0) {
		const mm = String(minutes).padStart(2, '0');
		return `${sign}${hours}:${mm}:${ss}.${mmm}`;
	}
	return `${sign}${minutes}:${ss}.${mmm}`;
}

// ---------------------------------------------------------------------------
// Absolute formatting — "wall-clock datetime"
// ---------------------------------------------------------------------------

const MONTH_ABBR = [
	'Jan',
	'Feb',
	'Mar',
	'Apr',
	'May',
	'Jun',
	'Jul',
	'Aug',
	'Sep',
	'Oct',
	'Nov',
	'Dec'
];

/**
 * Formats a raw millisecond counter value as a wall-clock time by anchoring it
 * to the known `unixtime` of the first (earliest) data row.
 *
 * Formula: `epochDate + (ms - firstMs)` → real UTC Date → formatted string
 *
 * Output format: `HH:MM:SS.mmm` (e.g. `"14:32:05.123"`).
 * If the computed timestamp falls on a different calendar date than `epochDate`,
 * the date is prepended: `"Feb 25 00:01:23.456"`.
 *
 * @param ms        - The raw millis value of the tick/point being formatted.
 * @param epochDate - The `unixtime` (UTC Date) of the first-by-time row.
 * @param firstMs   - The millis field value of that same first-by-time row.
 */
export function formatAbsolute(ms: number, epochDate: Date, firstMs: number): string {
	const offset = ms - firstMs;
	const wallMs = epochDate.getTime() + offset;
	const d = new Date(wallMs);

	const hh = String(d.getUTCHours()).padStart(2, '0');
	const mm = String(d.getUTCMinutes()).padStart(2, '0');
	const ss = String(d.getUTCSeconds()).padStart(2, '0');
	const mmm = String(d.getUTCMilliseconds()).padStart(3, '0');
	const timeStr = `${hh}:${mm}:${ss}.${mmm}`;

	// Prepend date if it differs from the epoch's calendar date (UTC)
	if (
		d.getUTCFullYear() !== epochDate.getUTCFullYear() ||
		d.getUTCMonth() !== epochDate.getUTCMonth() ||
		d.getUTCDate() !== epochDate.getUTCDate()
	) {
		const dateStr = `${MONTH_ABBR[d.getUTCMonth()]} ${d.getUTCDate()}`;
		return `${dateStr} ${timeStr}`;
	}

	return timeStr;
}
