import { parseDataLine } from '$lib/dataParser';
import { NUM_FIELDS, type DataLine } from '$lib/types';

export const LIVE_FRAME_DELIMITER = [10, 10, 10] as const;
export const LIVE_FRAME_BYTES = NUM_FIELDS * 4;

type LiveFrameExtractionResult = {
	lines: DataLine[];
	remainder: number[];
};

function findDelimiterIndex(buffer: number[]): number {
	for (let i = 0; i <= buffer.length - LIVE_FRAME_DELIMITER.length; i++) {
		let matches = true;
		for (let j = 0; j < LIVE_FRAME_DELIMITER.length; j++) {
			if (buffer[i + j] !== LIVE_FRAME_DELIMITER[j]) {
				matches = false;
				break;
			}
		}
		if (matches) return i;
	}
	return -1;
}

function parseFrameBytes(frame: number[]): DataLine | null {
	if (frame.length < LIVE_FRAME_BYTES) return null;

	const rowBytes = frame.slice(-LIVE_FRAME_BYTES);
	const dataview = new DataView(Uint8Array.from(rowBytes).buffer);
	const row: number[] = [];

	for (let i = 0; i < NUM_FIELDS; i++) {
		row.push(dataview.getInt32(i * 4, true));
	}

	return parseDataLine(row);
}

export function consumeLiveSerialBytes(
	buffer: number[],
	chunk: Uint8Array | number[]
): LiveFrameExtractionResult {
	const nextBuffer = [...buffer, ...Array.from(chunk)];
	const lines: DataLine[] = [];

	let delimiterIndex = findDelimiterIndex(nextBuffer);
	while (delimiterIndex !== -1) {
		const frame = nextBuffer.slice(0, delimiterIndex);
		const line = parseFrameBytes(frame);
		if (line) {
			lines.push(line);
		}

		nextBuffer.splice(0, delimiterIndex + LIVE_FRAME_DELIMITER.length);
		delimiterIndex = findDelimiterIndex(nextBuffer);
	}

	return {
		lines,
		remainder: nextBuffer
	};
}
