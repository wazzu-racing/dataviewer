import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// jsdom doesn't implement ResizeObserver or matchMedia — mock them globally
// so components that use them (GraphWidget, MapWidget) don't throw.

// ResizeObserver must be a real constructor (class), not a plain arrow function.
global.ResizeObserver = class ResizeObserver {
	observe = vi.fn();
	unobserve = vi.fn();
	disconnect = vi.fn();
};

// uPlot calls canvas.getContext('2d') and uses Path2D for drawing series lines.
// jsdom provides neither — stub them so the real uPlot can run without crashing.
// (The vi.mock('uplot') in GraphWidget.test.ts targets static imports; the
// dynamic import('uplot') inside $effect bypasses it, so we stub the environment.)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).Path2D = class Path2D {
	moveTo = vi.fn();
	lineTo = vi.fn();
	closePath = vi.fn();
	arc = vi.fn();
	rect = vi.fn();
};

// Use a Proxy so any Canvas 2D method uPlot calls is silently handled.
const canvasCtxStub = new Proxy(
	{
		canvas: { width: 0, height: 0 },
		measureText: vi.fn().mockReturnValue({ width: 0 }),
		getImageData: vi.fn().mockReturnValue({ data: new Uint8ClampedArray(4) })
	},
	{
		get(target, prop) {
			if (prop in target) return target[prop as keyof typeof target];
			// Return a no-op function for any other canvas method (strokeStyle, fillStyle, etc.)
			return typeof prop === 'string' ? vi.fn() : undefined;
		},
		set() {
			return true; // silently accept strokeStyle = '...', fillStyle = '...', etc.
		}
	}
);
if (typeof HTMLCanvasElement !== 'undefined') {
	HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(canvasCtxStub);
}

if (typeof window !== 'undefined') {
	Object.defineProperty(window, 'matchMedia', {
		writable: true,
		value: vi.fn().mockImplementation((query: string) => ({
			matches: false,
			media: query,
			onchange: null,
			addListener: vi.fn(),
			removeListener: vi.fn(),
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
			dispatchEvent: vi.fn()
		}))
	});
}
