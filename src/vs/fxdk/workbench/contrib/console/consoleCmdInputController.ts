import { addDisposableListener } from "vs/base/browser/dom";
import { Disposable } from "vs/base/common/lifecycle";
import { CommandBuffer } from "vs/fxdk/common/commandBuffer";
import { IConsoleDataAccessor } from "./consoleFrontendView";

export class ConsoleCmdInputController extends Disposable {
	private readonly buffer = this._register(new CommandBuffer());

	private dirty = false;

	constructor(
		private readonly element: HTMLInputElement,
		private readonly dataAccessor: IConsoleDataAccessor,
	) {
		super();

		this._register(addDisposableListener(this.element, 'keydown', this.handleKeyDown));
	}

	private handleKeyDown = (e: KeyboardEvent) => {
		const cmd = this.element.value.trim();

		switch (e.key) {
			case 'Enter': {
				this.dirty = false;

				if (cmd) {
					this.element.value = '';
					this.dataAccessor.send(cmd);
					this.buffer.push(cmd);
				}

				break;
			}

			case 'ArrowUp': {
				if (!this.dirty) {
					this.element.value = this.buffer.stepBack() || '';
				}

				break;
			}
			case 'ArrowDown': {
				if (!this.dirty) {
					this.element.value = this.buffer.stepForward() || '';
				}

				break;
			}

			default: {
				this.dirty = this.element.value.trim().length > 0;
			}
		}
	};
}