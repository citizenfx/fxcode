import { Disposable } from "vs/base/common/lifecycle";

export class CommandBuffer extends Disposable {
	private firstKey = 0;
	private lastKey = -1;

	private ptr = 0;

	private entries: Record<number, string> = {};

	constructor(private maxLength = 200) {
		super();
	}

	resetState() {
		this.ptr = this.lastKey + 1;
	}

	stepBack(): string | undefined {
		const nextPtr = this.ptr - 1;
		if (nextPtr < this.firstKey) {
			return this.entries[this.firstKey];
		}

		this.ptr = nextPtr;

		return this.entries[this.ptr];
	}

	stepForward(): string | undefined {
		const nextPtr = this.ptr + 1;
		if (nextPtr > (this.lastKey + 1)) {
			return;
		}

		this.ptr = nextPtr;

		return this.entries[this.ptr];
	}

	push(cmd: string) {
		if (this.ptr !== (this.lastKey + 1)) {
			this.ptr = this.lastKey + 1;
			return;
		}

		this.lastKey++;
		this.ptr = this.lastKey + 1;

		this.entries[this.lastKey] = cmd;

		if (this.lastKey - this.firstKey > this.maxLength) {
			delete this.entries[this.firstKey];

			this.firstKey++;
		}
	}
}