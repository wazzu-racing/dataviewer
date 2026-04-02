import { strToU8, unzipSync, zipSync, strFromU8 } from 'fflate';
import Papa from 'papaparse';
import type { DataLine, SessionMetadata } from './types';
import { parseDataLine } from './dataParser';

/**
 * Loads a .wazzuracing file from an ArrayBuffer.
 * Returns the parsed telemetry data and the session metadata.
 */
export async function loadWazzuFile(buffer: ArrayBuffer): Promise<{
	telemetry: DataLine[];
	metadata: SessionMetadata;
}> {
	const uint8 = new Uint8Array(buffer);
	const unzipped = unzipSync(uint8);

	// Find the metadata.json file
	let metadataFile: Uint8Array | undefined;
	const keys = Object.keys(unzipped);

	for (const key of keys) {
		const cleanKey = key.endsWith('/') ? key.slice(0, -1) : key;
		if (cleanKey === 'metadata.json' || cleanKey.endsWith('/metadata.json')) {
			if (unzipped[key].length > 0) {
				metadataFile = unzipped[key];
				break;
			}
		}
	}

	if (!metadataFile) {
		throw new Error('Invalid .wazzuracing file: metadata.json not found or empty');
	}

	const metadataText = strFromU8(metadataFile);
	const metadata: SessionMetadata = JSON.parse(metadataText);
	const telemetryFileName = metadata.files.telemetry;

	// Find the telemetry CSV file
	let telemetryFile: Uint8Array | undefined;
	for (const key in unzipped) {
		const cleanKey = key.endsWith('/') ? key.slice(0, -1) : key;
		if (cleanKey === telemetryFileName || cleanKey.endsWith('/' + telemetryFileName)) {
			if (unzipped[key].length > 0) {
				telemetryFile = unzipped[key];
				break;
			}
		}
	}

	if (!telemetryFile) {
		throw new Error(`Invalid .wazzuracing file: ${telemetryFileName} not found`);
	}

	const csvString = strFromU8(telemetryFile);
	const parsed = Papa.parse(csvString, {
		header: true,
		dynamicTyping: true,
		skipEmptyLines: true
	});

	if (parsed.errors.length > 0) {
		console.warn('CSV parsing errors:', parsed.errors);
	}

	// Map CSV data back to DataLine format
	const telemetry = (parsed.data as any[]).map((row) => ({
		...row,
		unixtime: new Date(row.unixtime)
	})) as DataLine[];

	return { telemetry, metadata };
}

/**
 * Saves telemetry data and metadata as a .wazzuracing ZIP blob.
 */
export async function saveWazzuFile(
	telemetry: DataLine[],
	metadata: SessionMetadata
): Promise<Blob> {
	const csvString = Papa.unparse(telemetry);
	const zipData: Record<string, Uint8Array> = {
		'metadata.json': strToU8(JSON.stringify(metadata, null, 2)),
		'data.csv': strToU8(csvString)
	};
	const zipped = zipSync(zipData);
	// We use Array.from or a standard Uint8Array to ensure Blob compatibility
	return new Blob([new Uint8Array(zipped)], { type: 'application/zip' });
}

/**
 * Converts a raw binary telemetry buffer to the new .wazzuracing format.
 */
export async function convertBinToWazzu(
	buffer: ArrayBuffer,
	name: string,
	driver: string = '',
	location: string = '',
	datetime: string = new Date().toISOString()
): Promise<Blob> {
	const dataview = new DataView(buffer);
	const numFields = 48; // from types.ts
	const bytesPerRow = 4 * numFields;
	const numRows = Math.floor(buffer.byteLength / bytesPerRow);

	const telemetry: DataLine[] = [];
	for (let row_i = 0; row_i < numRows; row_i++) {
		const row: number[] = [];
		for (let i = 0; i < numFields; i++) {
			row.push(dataview.getInt32(row_i * bytesPerRow + 4 * i, true));
		}
		telemetry.push(parseDataLine(row));
	}

	const metadata: SessionMetadata = {
		version: '1.0',
		name,
		driver,
		location,
		datetime,
		files: {
			telemetry: 'data.csv'
		}
	};

	return saveWazzuFile(telemetry, metadata);
}
