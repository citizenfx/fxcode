import 'vs/css!./console';
import { $, addDisposableListener } from "vs/base/browser/dom";
import { IActionViewItem } from "vs/base/browser/ui/actionbar/actionbar";
import { BaseActionViewItem } from "vs/base/browser/ui/actionbar/actionViewItems";
import { IAction } from "vs/base/common/actions";
import { IConfigurationService } from "vs/platform/configuration/common/configuration";
import { IContextKeyService } from "vs/platform/contextkey/common/contextkey";
import { IContextMenuService } from "vs/platform/contextview/browser/contextView";
import { IInstantiationService } from "vs/platform/instantiation/common/instantiation";
import { IKeybindingService } from "vs/platform/keybinding/common/keybinding";
import { IOpenerService } from "vs/platform/opener/common/opener";
import { ITelemetryService } from "vs/platform/telemetry/common/telemetry";
import { IThemeService } from "vs/platform/theme/common/themeService";
import { IViewPaneOptions, ViewPane } from "vs/workbench/browser/parts/views/viewPane";
import { IViewDescriptorService } from "vs/workbench/common/views";
import { IConsoleService } from "./consoleService";
import { ConsoleFrontendView, IConsoleDataAccessor } from './consoleFrontendView';
import { IFxDKDataService } from '../../services/fxdkData/fxdkDataService';
import { getShellApi } from 'vs/fxdk/browser/shellApi';

export class ConsoleViewPane extends ViewPane {
	private _container!: HTMLElement;

	private clientConsoleView!: ConsoleFrontendView;
	private serverConsoleView!: ConsoleFrontendView;

	constructor(
		options: IViewPaneOptions,
		@IKeybindingService keybindingService: IKeybindingService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IConfigurationService configurationService: IConfigurationService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IViewDescriptorService viewDescriptorService: IViewDescriptorService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IOpenerService openerService: IOpenerService,
		@IThemeService themeService: IThemeService,
		@ITelemetryService telemetryService: ITelemetryService,
		@IConsoleService private readonly consoleService: IConsoleService,
		@IFxDKDataService private readonly dataService: IFxDKDataService,
	) {
		super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, telemetryService);

		this._register(this.consoleService.onServerConsoleToggle((enabled) => {
			if (enabled) {
				this.showServerConsole();
			} else {
				this.hideServerConsole();
			}
		}));

		this._register(this.onDidFocus(() => {
			this.clientConsoleView.focus();
		}));
	}

	override saveState() {
		this.consoleService.saveState();
	}

	override layoutBody(_width: number, _height: number) {
		this.clientConsoleView?.layout();
		this.serverConsoleView?.layout();
	}

	override renderBody(container: HTMLElement) {
		this._container = container;

		this.clientConsoleView = this.instantiationService.createInstance(ConsoleFrontendView, {
			clear: () => this.dataService.clearGameOutput(),
			onClear: (cb) => this.dataService.onClearGameOutput(cb),
			send: (cmd) => (window as any).invokeNative('sendCommand', cmd),
			onStructuredMessage: (cb) => this.dataService.onStructuredGameMessageReceived(cb),
			getBufferedStructuredMessages: () => this.dataService.getStructuredGameMessages(),
		} as IConsoleDataAccessor);

		this.serverConsoleView = this.instantiationService.createInstance(ConsoleFrontendView, {
			clear: () => this.dataService.clearAllServerOutputs(),
			onClear: (cb) => this.dataService.onClearAllServerOutputs(cb),
			send: (cmd) => getShellApi().events.emit('server:sendCommand', cmd),
			onStructuredMessage: (cb) => this.dataService.onStructuredServerMessageReceived(cb),
			getBufferedStructuredMessages: () => this.dataService.getStructuredServerMessages(),
			getBufferedString: () => this.dataService.getBufferedServerOutput(),
		} as IConsoleDataAccessor);

		container.classList.add('fxdk-consoles-container');

		container.appendChild(this.clientConsoleView.element);

		if (this.consoleService.serverConsoleEnabled) {
			this.showServerConsole();
		}
	}

	override getActionViewItem(action: IAction): IActionViewItem | undefined {
		if (action.id === 'fxdk.console.toggleServerConsole') {
			return this.instantiationService.createInstance(ConsoleTogglesActionViewItem as any, action);
		}

		return super.getActionViewItem(action);
	}

	private showServerConsole() {
		this._container.appendChild(this.serverConsoleView.element);
	}

	private hideServerConsole() {
		this._container.removeChild(this.serverConsoleView.element);
	}
}

class ConsoleTogglesActionViewItem extends BaseActionViewItem implements IActionViewItem {
	private readonly serverButton: HTMLAnchorElement;

	constructor(
		action: IAction,
		@IConsoleService private readonly consoleService: IConsoleService,
	) {
		super(null, action);

		this.serverButton = $('a.action-label');

		this._register(this.consoleService.onServerConsoleToggle(() => {
			this.updateButton();
		}));

		this._register(addDisposableListener(this.serverButton, 'click', () => {
			this.consoleService.serverConsoleEnabled = !this.consoleService.serverConsoleEnabled;
		}));
	}

	override render(container: HTMLElement) {
		container.classList.add('fxdk-console-actions');

		container.appendChild(this.serverButton);

		this.updateButton();
	}

	private updateButton() {
		this.serverButton.innerText = this.consoleService.serverConsoleEnabled
			? 'Hide server console'
			: 'Show server console';
	}
}