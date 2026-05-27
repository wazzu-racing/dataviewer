import type { MasterBridge } from '$lib/windowBridge';

let masterBridge: MasterBridge | null = null;

export function setMasterBridge(bridge: MasterBridge | null): void {
	masterBridge = bridge;
}

export function getMasterBridge(): MasterBridge | null {
	return masterBridge;
}
