// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	interface SerialPort {
		readable: ReadableStream<Uint8Array> | null;
		writable: WritableStream<Uint8Array> | null;
		open(options: { baudRate: number }): Promise<void>;
		close(): Promise<void>;
	}

	interface Serial {
		requestPort(options?: { filters?: Array<{ usbVendorId?: number; usbProductId?: number }> }): Promise<SerialPort>;
	}

	interface Navigator {
		serial?: Serial;
	}

	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
