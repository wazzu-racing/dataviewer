import { describe, it, expect } from 'vitest';
import {
	isBridgeMessage,
	makeHelloMessage,
	makeTelemetryAppendMessage,
	makeTelemetryReplaceMessage,
	makeChildLayoutApplyMessage
} from '$lib/windowBridge';

describe('windowBridge message validation', () => {
	it('recognizes valid bridge messages', () => {
		const msg = makeHelloMessage();
		expect(isBridgeMessage(msg)).toBe(true);
	});

	it('rejects non-matching protocol/version', () => {
		expect(isBridgeMessage({ protocol: 'nope', version: 1, kind: 'hello' })).toBe(false);
		expect(isBridgeMessage({ protocol: 'wr-dataviewer', version: 999, kind: 'hello' })).toBe(false);
	});

	it('constructors produce expected shapes', () => {
		const append = makeTelemetryAppendMessage([{ write_millis: 1 } as any]);
		expect(append.kind).toBe('telemetry:append');

		const replace = makeTelemetryReplaceMessage([{ write_millis: 1 } as any], { name: 'x' } as any);
		expect(replace.kind).toBe('telemetry:replace');

		const apply = makeChildLayoutApplyMessage({
			layout: { id: 'a', type: 'graph' },
			floatingPanes: []
		});
		expect(apply.kind).toBe('layout:child:apply');
	});
});
