import { $, addDisposableListener } from "vs/base/browser/dom";
import { DomScrollableElement } from "vs/base/browser/ui/scrollbar/scrollableElement";
import { Disposable, IDisposable } from "vs/base/common/lifecycle";
import { ScrollbarVisibility } from "vs/base/common/scrollable";
import { StructuredMessage } from "vs/fxdk/browser/glue";
import { colorizeString } from "vs/fxdk/common/color";
import { FixedLengthBuffer } from "vs/fxdk/common/fixedLengthBuffer";
import { inputBackground, inputBorder, inputForeground, toolbarHoverBackground } from "vs/platform/theme/common/colorRegistry";
import { attachStylerCallback } from "vs/platform/theme/common/styler";
import { IThemeService, registerThemingParticipant, ThemeIcon } from "vs/platform/theme/common/themeService";
import { searchClearIcon } from "vs/workbench/contrib/search/browser/searchIcons";
import { IFxDKDataService } from "../../services/fxdkData/fxdkDataService";
import { ConsoleCmdInputController } from "./consoleCmdInputController";

export interface IConsoleDataAccessor {
	send(cmd: string): void,
	clear(): void,
	onClear(cb: () => void): IDisposable,

	getBufferedString?(): string | undefined,
	getBufferedStructuredMessages(): StructuredMessage[],

	onStructuredMessage(cb: (message: StructuredMessage) => void): void,
}

export class ConsoleFrontendView extends Disposable {
	readonly element: HTMLElement;

	private readonly scrollable!: DomScrollableElement;

	private readonly logs: HTMLDivElement;
	private readonly cmdInput: HTMLInputElement;

	private readonly buffer = this._register(new FixedLengthBuffer<HTMLDivElement>(200));

	private disableAutoScroll = false;

	constructor(
		private readonly dataAccessor: IConsoleDataAccessor,
		@IThemeService private readonly themeService: IThemeService,
		@IFxDKDataService private readonly dataService: IFxDKDataService,
	) {
		super();

		this.element = $('div.fxdk-console');

		this.logs = $('div.fxdk-console-entries');
		this.cmdInput = $('input.fxdk-console-input');

		this.scrollable = this._register(new DomScrollableElement(this.logs, {
			className: 'fxdk-console-entries-container',
			horizontal: ScrollbarVisibility.Hidden,
			vertical: ScrollbarVisibility.Auto,
		}));
		this.element.appendChild(this.scrollable.getDomNode());
		this.element.appendChild(this.createControls());

		this.scrollable.scanDomNode();

		this.dataAccessor.onStructuredMessage((message) => {
			this.insertNode(message);

			this.updateScroll();
		});

		this.buffer.onRemove((node) => this.logs.removeChild(node));

		this._register(this.dataAccessor.onClear(() => {
			this.buffer.reset();
			this.logs.innerHTML = '';
			this.updateScroll();
		}));

		this._register(this.scrollable.onScroll((e) => {
			if (e.scrollTopChanged) {
				// User scrolled up - disable scroll auto-update
				if (!this.disableAutoScroll && e.oldScrollTop > e.scrollTop) {
					this.disableAutoScroll = true;
				}

				// User scrolled to the end - enable scroll auto-update back
				if (this.disableAutoScroll && e.scrollTop + e.height === e.scrollHeight) {
					this.disableAutoScroll = false;
				}
			}
		}));

		this._register(attachStylerCallback(this.themeService, { inputBackground, inputForeground, inputBorder }, (colors) => {
			this.element.style.setProperty('--input-bg', colors.inputBackground?.toString() || '');
			this.element.style.setProperty('--input-fg', colors.inputForeground?.toString() || '');
			this.element.style.setProperty('--input-br', colors.inputBorder?.toString() || '');
		}));

		this._register(addDisposableListener(this.logs, 'mousedown', (e) => {
			// Handling right-click
			if (e.button === 2) {
				e.preventDefault();
				e.stopPropagation();

				const selection = window.getSelection();
				if (!selection) {
					return;
				}

				const selectionString = selection.toString();
				if (!selectionString) {
					return;
				}

				document.execCommand('copy');
				selection.empty();
			}
		}));

		this._register(new ConsoleCmdInputController(this.cmdInput, this.dataAccessor));

		this.render();
	}

	focus() {
		this.cmdInput.focus();
	}

	layout() {
		this.updateScroll();
	}

	private render() {
		this.dataAccessor.getBufferedStructuredMessages().forEach((message) => {
			this.logs.appendChild(this.getStructuredMessageNode(message));
		});

		this.updateScroll();
	}

	private createControls(): HTMLDivElement {
		const decorator = $('div.decorator', {}, '>');

		const clearAction = $(`a.action-label${ThemeIcon.asCSSSelector(searchClearIcon)}`, {
			title: 'Clear console',
		});

		this._register(addDisposableListener(clearAction, 'click', () => {
			this.dataAccessor.clear();
		}));

		const actions = $('div.actions-container', {}, clearAction);

		return $('div.fxdk-console-input-wrapper', {}, this.cmdInput, decorator, actions);
	}

	private getStructuredMessageNode({ message, channel }: StructuredMessage): HTMLDivElement {
		const { bg, fg } = this.dataService.getResourceColors(channel);

		const channelNode = $('div.channel', {
			style: `--channel-color:${bg}; --channel-text-color:${fg}`,
		}, channel);

		const messageNode = $('div.message');
		messageNode.innerHTML = colorizeString(message);

		return $('div.structured-message', {}, channelNode, messageNode);
	}

	private insertNode(message: StructuredMessage) {
		const node = this.getStructuredMessageNode(message);

		this.buffer.push(node);

		this.logs.appendChild(node);
	}

	updateScroll() {
		this.scrollable.scanDomNode();

		if (!this.disableAutoScroll) {
			this.scrollable.setScrollPosition({
				scrollTop: this.scrollable.getScrollDimensions().scrollHeight,
			});
		}
	}
}

registerThemingParticipant((theme, collector) => {
	const toolbarHoverBackgroundColor = theme.getColor(toolbarHoverBackground);
	if (toolbarHoverBackgroundColor) {
		collector.addRule(`
			.fxdk-console-input-wrapper .actions-container .action-label:hover {
				background-color: ${toolbarHoverBackgroundColor};
			}
		`);
	}
});