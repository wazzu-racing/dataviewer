import { isValidDataLine, parseDataLine } from '$lib/dataParser';
import { BIN_FIELD_COUNT, type DataLine } from '$lib/types';

export const LIVE_FRAME_DELIMITER = [10, 10, 10] as const;
export const LIVE_FRAME_BYTES = BIN_FIELD_COUNT * 4;
const MAX_REMAINDER_BYTES = LIVE_FRAME_BYTES * 10 + LIVE_FRAME_DELIMITER.length;

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

export function consumeLiveSerialBytes(
	buffer: number[],
	chunk: Uint8Array | number[]
): LiveFrameExtractionResult {
	const nextBuffer = buffer;
	for (const byte of chunk) {
		nextBuffer.push(byte);
	}
	const lines: DataLine[] = [];

	let remainingBuffer = nextBuffer;
	while (true) {
		const relativeDelimiterIndex = findDelimiterIndex(remainingBuffer);
		if (relativeDelimiterIndex === -1) break;

		let foundValidFrame = false;

		if (relativeDelimiterIndex >= LIVE_FRAME_BYTES) {
			const frameStart = relativeDelimiterIndex - LIVE_FRAME_BYTES;
			const frame = remainingBuffer.slice(frameStart, relativeDelimiterIndex);
			const row: number[] = [];
			const arrayBuffer = new Uint8Array(frame).buffer;
			const dataview = new DataView(arrayBuffer);
			for (let i = 0; i < BIN_FIELD_COUNT; i++) {
				row.push(dataview.getInt32(i * 4, true));
			}

			if (isValidDataLine(row)) {
				const line = parseDataLine(row);
				lines.push(line);
				remainingBuffer = remainingBuffer.slice(
					relativeDelimiterIndex + LIVE_FRAME_DELIMITER.length
				);
				foundValidFrame = true;
			}
		}

		if (!foundValidFrame) {
			// If we found a delimiter but no valid frame, check if there's another delimiter.
			const nextDelimIndex = findDelimiterIndex(remainingBuffer.slice(relativeDelimiterIndex + 1));
			if (nextDelimIndex !== -1) {
				remainingBuffer = remainingBuffer.slice(relativeDelimiterIndex + 1);
				continue;
			}

			// If NO later delimiter, we decide whether to wait or skip.
			// If the buffer is large enough for a full frame plus delimiter,
			// we skip THIS delimiter. This ensures we eventually find the
			// "next" delimiter in the next chunk.
			if (remainingBuffer.length >= LIVE_FRAME_BYTES + LIVE_FRAME_DELIMITER.length) {
				remainingBuffer = remainingBuffer.slice(relativeDelimiterIndex + 1);
			} else {
				break;
			}
		}
	}

	let finalBuffer = remainingBuffer;
	if (finalBuffer.length > MAX_REMAINDER_BYTES) {
		finalBuffer = finalBuffer.slice(-MAX_REMAINDER_BYTES);
	}

	return {
		lines,
		remainder: finalBuffer
	};
}
