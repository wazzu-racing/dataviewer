import { isValidDataLine, parseDataLine } from '$lib/dataParser';
import { WR_FIELD_COUNT, type DataLine } from '$lib/types';

export const LIVE_FRAME_DELIMITER = [10, 10, 10] as const;
export const LIVE_FRAME_BYTES = WR_FIELD_COUNT * 4;
// The live stream delimiter is a run of 3 or more newlines.
const MAX_REMAINDER_BYTES = LIVE_FRAME_BYTES * 10 + LIVE_FRAME_DELIMITER.length + 8;

const DEBUG_LIVE_PARSE = false;

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

function delimiterEndIndex(buffer: number[], delimiterStart: number): number {
	// Accept both \n\n\n and \n\n\n\n (or more) as a delimiter run.
	let end = delimiterStart + LIVE_FRAME_DELIMITER.length;
	while (end < buffer.length && buffer[end] === 10) {
		end++;
	}
	return end;
}

function decodeFrameBytes(frame: number[]): number[] {
	const row: number[] = [];
	const arrayBuffer = new Uint8Array(frame).buffer;
	const dataview = new DataView(arrayBuffer);
	for (let i = 0; i < WR_FIELD_COUNT; i++) {
		row.push(dataview.getInt32(i * 4, true));
	}
	return row;
}

export function consumeLiveSerialBytes(
	buffer: number[],
	chunk: Uint8Array | number[]
): LiveFrameExtractionResult {
	if (DEBUG_LIVE_PARSE) {
		console.log(
			'[SerialDebug] consumeLiveSerialBytes called — incoming chunk:',
			Array.isArray(chunk) ? chunk.length : ((chunk as Uint8Array)?.byteLength ?? 0)
		);
	}

	const nextBuffer = buffer;
	for (const byte of chunk) {
		nextBuffer.push(byte);
	}
	const lines: DataLine[] = [];

	let remainingBuffer = nextBuffer;
	while (true) {
		const relativeDelimiterIndex = findDelimiterIndex(remainingBuffer);
		if (relativeDelimiterIndex === -1) break;

		const delimEnd = delimiterEndIndex(remainingBuffer, relativeDelimiterIndex);

		let foundValidFrame = false;

		if (relativeDelimiterIndex >= LIVE_FRAME_BYTES) {
			// The delimiter can land on any byte boundary in the stream.
			// Try a small alignment search (0..3 byte offset) to find a valid int32 row.
			for (let offset = 0; offset < 4; offset++) {
				const frameStart = relativeDelimiterIndex - LIVE_FRAME_BYTES - offset;
				if (frameStart < 0) continue;

				const frame = remainingBuffer.slice(frameStart, relativeDelimiterIndex);
				const row = decodeFrameBytes(frame);
				const valid = isValidDataLine(row);

				if (DEBUG_LIVE_PARSE) {
					console.log(
						'[SerialDebug] Attempting to parse frame at',
						frameStart,
						'offset',
						offset,
						'length',
						LIVE_FRAME_BYTES
					);
					console.log('[SerialDebug] isValidDataLine(', row, '):', valid);
				}

				if (valid) {
					lines.push(parseDataLine(row, 'wr'));
					remainingBuffer = remainingBuffer.slice(delimEnd);
					foundValidFrame = true;
					break;
				}
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
