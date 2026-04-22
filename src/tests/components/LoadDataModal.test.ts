import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/svelte';
import LoadDataModal from '$lib/components/LoadDataModal.svelte';

vi.mock('$lib/components/ReadData.svelte', () => ({
	default: vi.fn()
}));

vi.mock('$lib/components/GithubFilePicker.svelte', () => ({
	default: vi.fn()
}));

describe('LoadDataModal', () => {
	it('calls the connect handler when Connect to Car is clicked', async () => {
		const onConnectToCar = vi.fn();
		const { getByRole } = render(LoadDataModal, {
			props: {
				onDismiss: vi.fn(),
				onConnectToCar
			}
		});

		await fireEvent.click(getByRole('button', { name: 'Connect to Car' }));

		expect(onConnectToCar).toHaveBeenCalledTimes(1);
	});
});
