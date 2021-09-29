import { Emitter } from "vs/base/common/event";
import { Disposable, IDisposable } from "vs/base/common/lifecycle";
import { registerSingleton } from "vs/platform/instantiation/common/extensions";
import { createDecorator } from "vs/platform/instantiation/common/instantiation";
import { IStorageService, StorageScope, StorageTarget } from "vs/platform/storage/common/storage";
import { Memento, MementoObject } from "vs/workbench/common/memento";

export const IConsoleService = createDecorator<IConsoleService>('fxdkConsoleService');

export interface IConsoleService {
	onServerConsoleToggle(cb: (enabled: boolean) => void): IDisposable,

	serverConsoleEnabled: boolean,

	saveState(): void,
}

export class ConsoleService extends Disposable implements IConsoleService {
	private _serverConsoleEnabled = true;
	private readonly _onServerConsoleToggle = this._register(new Emitter<boolean>());
	readonly onServerConsoleToggle = this._onServerConsoleToggle.event;

	private memento: Memento;
	private state: MementoObject;

	constructor(
		@IStorageService private readonly storageService: IStorageService,
	) {
		super();

		this.memento = new Memento('fxdk.consoleService', this.storageService);
		this.state = this.memento.getMemento(StorageScope.WORKSPACE, StorageTarget.USER);

		this.restoreState();
	}

	get serverConsoleEnabled(): boolean {
		return this._serverConsoleEnabled;
	}
	set serverConsoleEnabled(enabled: boolean) {
		this._serverConsoleEnabled = enabled;
		this._onServerConsoleToggle.fire(enabled);
	}

	private restoreState() {
		const showServerConsole = this.state['showServerConsole'];
		if (typeof showServerConsole === 'boolean') {
			this._serverConsoleEnabled = showServerConsole;
		} else {
			this._serverConsoleEnabled = true;
		}
	}

	saveState() {
		this.state['showServerConsole'] = this._serverConsoleEnabled;

		this.memento.saveMemento();
	}
}

registerSingleton(IConsoleService, ConsoleService);