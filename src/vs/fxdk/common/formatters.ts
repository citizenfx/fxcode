function f(n: number): string {
	return n.toFixed(2);
}

export function formatMS(cell: unknown): unknown {
	if (typeof cell === 'number') {
		if (cell <= 0.005) {
			return '—';
		}

		return cell.toFixed(2) + ' ms';
	}

	return cell;
}

export function getIntensityColor(value: number): string {
	const alpha = typeof value === 'number' ? (value < 0.005 ? 0 : value) : 0;

	return `rgba(244, 5, 82, ${alpha})`;
}

export function formatTimePercentage(cell: unknown): unknown {
	if (typeof cell === 'number') {
		if (cell < 0.005) {
			return '—';
		}

		return `${(cell * 100).toFixed(2)}%`;
	}

	return cell;
}

export function formatMemory(postfix: string, mem: unknown): unknown {
	if (typeof mem === 'number') {
		if (mem <= 0) {
			return '?';
		}

		switch (true) {
			case mem >= (1024 ** 3): {
				return f(mem / (1024 ** 3)) + ' GiB' + postfix;
			}
			case mem >= (1024 ** 2): {
				return f(mem / (1024 ** 2)) + ' MiB' + postfix;
			}
			case mem >= 1024: {
				return f(mem / 1024) + ' KiB' + postfix;
			}
			default: {
				return f(mem) + ' B' + postfix;
			}
		}
	}

	return mem;
}