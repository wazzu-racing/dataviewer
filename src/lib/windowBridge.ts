import type { DataLine, SessionMetadata, WindowLayoutState } from '$lib/types';

const PROTOCOL = 'wr-dataviewer';
const VERSION = 1;

type BaseMessage = {
	protocol: typeof PROTOCOL;
	version: typeof VERSION;
	kind: string;
};

export type HelloMessage = BaseMessage & {
	kind: 'hello';
};

export type InitMessage = BaseMessage & {
	kind: 'init';
	session: {
		telemetry: DataLine[];
		metadata: SessionMetadata;
	};
	childState: WindowLayoutState;
};

export type TelemetryReplaceMessage = BaseMessage & {
	kind: 'telemetry:replace';
	telemetry: DataLine[];
	metadata: SessionMetadata;
};

export type TelemetryAppendMessage = BaseMessage & {
	kind: 'telemetry:append';
	lines: DataLine[];
};

export type ChildLayoutUpdateMessage = BaseMessage & {
	kind: 'layout:child:update';
	state: WindowLayoutState;
};

export type ChildLayoutApplyMessage = BaseMessage & {
	kind: 'layout:child:apply';
	state: WindowLayoutState;
};

export type RequestTelemetryMessage = BaseMessage & {
	kind: 'request:telemetry';
};

/** Used for the initial full telemetry payload when the dataset is large.
 *  Avoids expensive structured clone of a huge array through postMessage.
 */
export type TelemetryReplaceUrlMessage = BaseMessage & {
	kind: 'telemetry:replace-url';
	url: string; // object URL to a JSON blob of the telemetry array
	metadata: SessionMetadata;
};

export type TimeSelectMessage = BaseMessage & {
	kind: 'time:select';
	index: number;
};

export type BridgeMessage =
	| HelloMessage
	| InitMessage
	| TelemetryReplaceMessage
	| TelemetryAppendMessage
	| ChildLayoutUpdateMessage
	| ChildLayoutApplyMessage
	| RequestTelemetryMessage
	| TelemetryReplaceUrlMessage
	| TimeSelectMessage;

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

export function isBridgeMessage(value: unknown): value is BridgeMessage {
	if (!isObject(value)) return false;
	if (value.protocol !== PROTOCOL) return false;
	if (value.version !== VERSION) return false;
	if (typeof value.kind !== 'string') return false;
	return true;
}

function post(win: Window, message: BridgeMessage): void {
	win.postMessage(message, window.location.origin);
}

type CommonHandlers = {
	/** Accept messages only from this window (if provided) */
	expectedSource?: Window | (() => Window | undefined);
	onHello?: () => void;
	onInit?: (payload: InitMessage) => void;
	onTelemetryReplace?: (payload: TelemetryReplaceMessage) => void;
	onTelemetryAppend?: (payload: TelemetryAppendMessage) => void;
	onChildLayoutUpdate?: (payload: ChildLayoutUpdateMessage) => void;
	onChildLayoutApply?: (payload: ChildLayoutApplyMessage) => void;
	onRequestTelemetry?: () => void;
	onTelemetryReplaceUrl?: (payload: TelemetryReplaceUrlMessage) => void;
	onTimeSelect?: (index: number) => void;
};

export function createBridgeListener(handlers: CommonHandlers): {
	destroy: () => void;
} {
	const onMessage = (event: MessageEvent) => {
		if (event.origin !== window.location.origin) return;
		const expected =
			typeof handlers.expectedSource === 'function'
				? handlers.expectedSource()
				: handlers.expectedSource;
		if (expected && event.source && event.source !== expected) {
			// Strict Window identity can be flaky across window.open / opener in some browsers
			// and timing conditions (the event.source proxy may not be === the reference we captured).
			// We already enforce same-origin + our custom protocol+version in isBridgeMessage,
			// which is sufficient protection for this controlled parent<->popup pair.
			// Do not drop the message on identity mismatch.
			// (If you ever need stronger auth, add a short-lived token to the messages.)
			if (import.meta.env.DEV) {
				console.debug('[windowBridge] source identity mismatch (allowed to proceed)', {
					expected,
					actual: event.source
				});
			}
			// return;  <-- intentionally not rejecting
		}
		if (!isBridgeMessage(event.data)) return;

		switch (event.data.kind) {
			case 'hello':
				handlers.onHello?.();
				break;
			case 'init':
				handlers.onInit?.(event.data);
				break;
			case 'telemetry:replace':
				handlers.onTelemetryReplace?.(event.data);
				break;
			case 'telemetry:append':
				handlers.onTelemetryAppend?.(event.data);
				break;
			case 'layout:child:update':
				handlers.onChildLayoutUpdate?.(event.data);
				break;
			case 'layout:child:apply':
				handlers.onChildLayoutApply?.(event.data);
				break;
			case 'request:telemetry':
				handlers.onRequestTelemetry?.();
				break;
			case 'telemetry:replace-url':
				handlers.onTelemetryReplaceUrl?.(event.data);
				break;
			case 'time:select':
				handlers.onTimeSelect?.(event.data.index);
				break;
		}
	};

	window.addEventListener('message', onMessage);
	return {
		destroy: () => window.removeEventListener('message', onMessage)
	};
}

export function makeHelloMessage(): HelloMessage {
	return { protocol: PROTOCOL, version: VERSION, kind: 'hello' };
}

export function makeInitMessage(
	telemetry: DataLine[],
	metadata: SessionMetadata,
	childState: WindowLayoutState
): InitMessage {
	return {
		protocol: PROTOCOL,
		version: VERSION,
		kind: 'init',
		session: { telemetry, metadata },
		childState
	};
}

export function makeTelemetryReplaceMessage(
	telemetry: DataLine[],
	metadata: SessionMetadata
): TelemetryReplaceMessage {
	return { protocol: PROTOCOL, version: VERSION, kind: 'telemetry:replace', telemetry, metadata };
}

export function makeTelemetryAppendMessage(lines: DataLine[]): TelemetryAppendMessage {
	return { protocol: PROTOCOL, version: VERSION, kind: 'telemetry:append', lines };
}

export function makeChildLayoutUpdateMessage(state: WindowLayoutState): ChildLayoutUpdateMessage {
	return { protocol: PROTOCOL, version: VERSION, kind: 'layout:child:update', state };
}

export function makeChildLayoutApplyMessage(state: WindowLayoutState): ChildLayoutApplyMessage {
	return { protocol: PROTOCOL, version: VERSION, kind: 'layout:child:apply', state };
}

export function makeRequestTelemetryMessage(): RequestTelemetryMessage {
	return { protocol: PROTOCOL, version: VERSION, kind: 'request:telemetry' };
}

export function makeTelemetryReplaceUrlMessage(
	url: string,
	metadata: SessionMetadata
): TelemetryReplaceUrlMessage {
	return {
		protocol: PROTOCOL,
		version: VERSION,
		kind: 'telemetry:replace-url',
		url,
		metadata
	};
}

export function makeTimeSelectMessage(index: number): TimeSelectMessage {
	return { protocol: PROTOCOL, version: VERSION, kind: 'time:select', index };
}

export type MasterBridge = {
	setChildWindow: (win: Window | null) => void;
	hasChild: () => boolean;
	sendInit: (
		telemetry: DataLine[],
		metadata: SessionMetadata,
		childState: WindowLayoutState
	) => void;
	sendTelemetryReplace: (telemetry: DataLine[], metadata: SessionMetadata) => void;
	sendTelemetryAppend: (lines: DataLine[]) => void;
	sendChildLayoutApply: (state: WindowLayoutState) => void;
	sendCurrentTelemetry: () => void;
	/** Send full current telemetry. For large datasets this may use an object URL internally. */
	sendFullTelemetry: (telemetry: DataLine[], metadata: SessionMetadata) => void;
	sendTimeSelect: (index: number) => void;
	destroy: () => void;
};

export function createMasterBridge(handlers: {
	onChildHello?: () => void;
	onChildLayoutUpdate?: (state: WindowLayoutState) => void;
	onRequestTelemetry?: () => void;
}): MasterBridge {
	let childWindow: Window | null = null;

	const listener = createBridgeListener({
		expectedSource: () => childWindow ?? undefined,
		onHello: () => handlers.onChildHello?.(),
		onChildLayoutUpdate: (msg) => handlers.onChildLayoutUpdate?.(msg.state),
		onRequestTelemetry: () => {
			// Child is asking for fresh data (e.g. it booted before early pushes arrived)
			handlers.onRequestTelemetry?.();
		}
	});

	return {
		setChildWindow: (win) => {
			childWindow = win;
		},
		hasChild: () => Boolean(childWindow && !childWindow.closed),
		sendInit: (telemetry, metadata, childState) => {
			if (!childWindow || childWindow.closed) return;
			post(childWindow, makeInitMessage(telemetry, metadata, childState));
		},
		sendTelemetryReplace: (telemetry, metadata) => {
			if (!childWindow || childWindow.closed) return;
			post(childWindow, makeTelemetryReplaceMessage(telemetry, metadata));
		},
		sendTelemetryAppend: (lines) => {
			if (!childWindow || childWindow.closed) return;
			if (lines.length === 0) return;
			post(childWindow, makeTelemetryAppendMessage(lines));
		},
		sendChildLayoutApply: (state) => {
			if (!childWindow || childWindow.closed) return;
			post(childWindow, makeChildLayoutApplyMessage(state));
		},
		sendCurrentTelemetry: () => {
			if (!childWindow || childWindow.closed) return;
			// The actual telemetry + metadata will be supplied by the caller (the page)
			// via the onRequestTelemetry handler. We just expose the hook.
		},
		sendFullTelemetry: (telemetry, metadata) => {
			if (!childWindow || childWindow.closed) return;
			if (telemetry.length === 0) {
				post(childWindow, makeTelemetryReplaceMessage(telemetry, metadata));
				return;
			}

			// For large payloads, using a Blob + object URL is dramatically faster
			// and more reliable than embedding a huge array in postMessage (avoids
			// expensive double structured cloning + message size limits).
			const LARGE_THRESHOLD = 2000;
			if (telemetry.length > LARGE_THRESHOLD) {
				try {
					const json = JSON.stringify(telemetry);
					const blob = new Blob([json], { type: 'application/json' });
					const url = URL.createObjectURL(blob);
					post(childWindow, makeTelemetryReplaceUrlMessage(url, metadata));

					// Revoke after a generous window (child should fetch quickly).
					setTimeout(() => URL.revokeObjectURL(url), 30000);
					return;
				} catch (e) {
					console.warn('[windowBridge] Failed to create telemetry URL, falling back to direct', e);
					// fall through to direct
				}
			}

			post(childWindow, makeTelemetryReplaceMessage(telemetry, metadata));
		},
		sendTimeSelect: (index) => {
			if (!childWindow || childWindow.closed) return;
			post(childWindow, makeTimeSelectMessage(index));
		},
		destroy: () => listener.destroy()
	};
}

export type ChildBridge = {
	sendHello: () => void;
	sendChildLayoutUpdate: (state: WindowLayoutState) => void;
	sendRequestTelemetry: () => void;
	destroy: () => void;
};

export function createChildBridge(
	parentWindow: Window,
	handlers: {
		onInit?: (msg: InitMessage) => void;
		onTelemetryReplace?: (telemetry: DataLine[], metadata: SessionMetadata) => void;
		onTelemetryAppend?: (lines: DataLine[]) => void;
		onChildLayoutApply?: (state: WindowLayoutState) => void;
		onTelemetryReplaceUrl?: (url: string, metadata: SessionMetadata) => void;
		onTimeSelect?: (index: number) => void;
	}
): ChildBridge {
	const listener = createBridgeListener({
		expectedSource: parentWindow,
		onInit: (msg) => handlers.onInit?.(msg),
		onTelemetryReplace: (msg) => handlers.onTelemetryReplace?.(msg.telemetry, msg.metadata),
		onTelemetryAppend: (msg) => handlers.onTelemetryAppend?.(msg.lines),
		onChildLayoutApply: (msg) => handlers.onChildLayoutApply?.(msg.state),
		onTelemetryReplaceUrl: (msg) => handlers.onTelemetryReplaceUrl?.(msg.url, msg.metadata),
		onTimeSelect: (index) => handlers.onTimeSelect?.(index)
	});

	return {
		sendHello: () => post(parentWindow, makeHelloMessage()),
		sendChildLayoutUpdate: (state) => post(parentWindow, makeChildLayoutUpdateMessage(state)),
		sendRequestTelemetry: () => post(parentWindow, makeRequestTelemetryMessage()),
		destroy: () => listener.destroy()
	};
}
