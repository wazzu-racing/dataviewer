declare module 'virtual:pwa-register/svelte' {
	export function useRegisterSW(options?: {
		onNeedRefresh?: () => void;
		onOfflineReady?: () => void;
	}): {
		needRefresh: { subscribe: (run: (value: boolean) => void) => () => void };
		offlineReady: { subscribe: (run: (value: boolean) => void) => () => void };
		updateServiceWorker: (reloadPage?: boolean) => Promise<void>;
	};
}
