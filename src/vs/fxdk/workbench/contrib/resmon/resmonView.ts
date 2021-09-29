import 'vs/css!./resmon';
import { $ } from 'vs/base/browser/dom';
import { DomScrollableElement } from 'vs/base/browser/ui/scrollbar/scrollableElement';
import { ScrollbarVisibility } from 'vs/base/common/scrollable';
import { formatMemory, formatMS, formatTimePercentage, getIntensityColor } from "vs/fxdk/common/formatters";
import { IConfigurationService } from "vs/platform/configuration/common/configuration";
import { IContextKeyService } from "vs/platform/contextkey/common/contextkey";
import { IContextMenuService } from "vs/platform/contextview/browser/contextView";
import { IInstantiationService } from "vs/platform/instantiation/common/instantiation";
import { IKeybindingService } from "vs/platform/keybinding/common/keybinding";
import { IOpenerService } from "vs/platform/opener/common/opener";
import { ITelemetryService } from "vs/platform/telemetry/common/telemetry";
import { focusBorder, inputBackground } from 'vs/platform/theme/common/colorRegistry';
import { IThemeService, registerThemingParticipant } from "vs/platform/theme/common/themeService";
import { IViewPaneOptions, ViewPane } from "vs/workbench/browser/parts/views/viewPane";
import { IViewDescriptorService } from "vs/workbench/common/views";
import { IFxDKDataService } from "../../services/fxdkData/fxdkDataService";
import { ClientResourceData } from 'vs/fxdk/browser/glue';

type ResourceNodeData =
	| 'clientCpu'
	| 'serverCpu'
	| 'clientTime'
	| 'serverTime'
	| 'clientMemory'
	| 'serverMemory'
	| 'streaming';

class ResourceNode {
	private data: Record<ResourceNodeData, number> = {
		clientCpu: 0,
		serverCpu: 0,
		clientTime: 0,
		serverTime: 0,
		clientMemory: 0,
		serverMemory: 0,
		streaming: 0,
	};

	private clientTimeContainer: HTMLSpanElement;
	private serverTimeContainer: HTMLSpanElement;

	constructor(
		public row: HTMLTableRowElement,
		public clientCpu: HTMLTableCellElement,
		public serverCpu: HTMLTableCellElement,
		public clientTime: HTMLTableCellElement,
		public serverTime: HTMLTableCellElement,
		public clientMemory: HTMLTableCellElement,
		public serverMemory: HTMLTableCellElement,
		public streaming: HTMLTableCellElement,
	) {
		this.clientTimeContainer = $('span', {
			style: `padding: 0 2px; border: solid 2px transparent`,
		});
		this.clientTime.appendChild(this.clientTimeContainer);

		this.serverTimeContainer = $('span', {
			style: `padding: 0 2px; border: solid 2px transparent`,
		});
		this.serverTime.appendChild(this.serverTimeContainer);
	}

	update(data: ResourceNodeData, value: number) {
		if (this.data[data] !== value) {
			this.data[data] = value;

			const formattedValue = this.format(data, value);

			if (data === 'serverTime' || data === 'clientTime') {
				const container = this[`${data}Container`];

				container.style.borderColor = getIntensityColor(value);
				container.innerText = formattedValue;
			} else {
				this[data].innerText = formattedValue;
			}
		}
	}

	private format(data: ResourceNodeData, value: number): string {
		switch (data) {
			case 'clientCpu':
			case 'serverCpu': {
				return formatMS(value) + '';
			}

			case 'clientTime':
			case 'serverTime': {
				return formatTimePercentage(value) + '';
			}

			case 'clientMemory':
			case 'serverMemory': {
				return formatMemory('+', value) + '';
			}

			case 'streaming': {
				return formatMemory('', value) + '';
			}
		}
	}
}

export class ResmonViewPane extends ViewPane {
	private _container!: HTMLElement;

	protected tbodyNode: HTMLTableSectionElement | null = null;
	private _tableContainer!: HTMLDivElement;

	protected resourceNodes: Record<string, ResourceNode> = {};

	private scroll!: DomScrollableElement;

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
		@IFxDKDataService private readonly dataService: IFxDKDataService,
	) {
		super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, telemetryService);

		this._register(
			this.dataService.onClientResourcesData((data) => this.renderResourcesData(false, data)),
		);
		this._register(
			this.dataService.onServerResourcesData((data) => this.renderResourcesData(true, data)),
		);
	}

	override layoutBody(_width: number, _height: number) {
		this.updateScroll();
	}

	override renderBody(container: HTMLElement) {
		this._container = container;
		this._container.classList.add('fxdk-resmon-widget');

		this._tableContainer = $('table', {
			cellpadding: 0,
			cellspacing: 0,
		});

		this._tableContainer.innerHTML = `
		<thead>
			<th class="align-left">Resource</th>
			<th class="align-right">Client CPU</th>
			<th class="align-right">Server CPU</th>
			<th class="align-right">Client Time %</th>
			<th class="align-right">Server Time %</th>
			<th class="align-right">Client Memory</th>
			<th class="align-right">Server Memory</th>
			<th class="align-right">Streaming</th>
		</thead>
		`;

		this.tbodyNode = $('tbody') as HTMLTableSectionElement;

		this._tableContainer.appendChild(this.tbodyNode);

		this.scroll = this._register(new DomScrollableElement($('div', { style: 'width:100%;height:100%' }, this._tableContainer), {
			className: 'table-container',
			horizontal: ScrollbarVisibility.Hidden,
			vertical: ScrollbarVisibility.Auto,
		}));

		this.renderResourcesData(false, this.dataService.getClientResourcesData());
		this.renderResourcesData(true, this.dataService.getServerResourcesData());

		this.updateScroll();

		this._container.appendChild(this.scroll.getDomNode());
	}

	private renderResourcesData(server: boolean, data: ClientResourceData[]) {
		const aliveResourceNames: Record<string, boolean> = Object.create(null);

		for (const [resourceName, cpu, time, memory, streaming] of data) {
			aliveResourceNames[resourceName] = true;

			const resourceNode = this.getOrCreateResourceNode(resourceName);

			if (server) {
				resourceNode.update('serverCpu', cpu);
				resourceNode.update('serverTime', time);
				resourceNode.update('serverMemory', memory);
			} else {
				resourceNode.update('clientCpu', cpu);
				resourceNode.update('clientTime', time);
				resourceNode.update('clientMemory', memory);
				resourceNode.update('streaming', streaming);
			}
		}

		for (const resourceName of Object.keys(this.resourceNodes)) {
			if (!aliveResourceNames[resourceName]) {
				this.deleteResourceNode(resourceName);
			}
		}

		this.updateScroll();
	}

	private getOrCreateResourceNode(resourceName: string): ResourceNode {
		if (!this.resourceNodes[resourceName]) {
			const row = document.createElement('tr');

			const colors = this.dataService.getResourceColors(resourceName);

			row.style.setProperty('--resource-color', colors.bgRaw.transparent(.1).toString());

			const name = document.createElement('td');
			name.classList.add('align-left');
			name.appendChild($('span.resource-name', {
				style: `background-color: ${colors.bg}; color: ${colors.fg}`,
			}, resourceName));

			const node = this.resourceNodes[resourceName] = new ResourceNode(
				row,
				document.createElement('td'),
				document.createElement('td'),
				document.createElement('td'),
				document.createElement('td'),
				document.createElement('td'),
				document.createElement('td'),
				document.createElement('td'),
			);

			node.clientCpu.classList.add('align-right');
			node.serverCpu.classList.add('align-right');
			node.clientTime.classList.add('align-right');
			node.serverTime.classList.add('align-right');
			node.clientMemory.classList.add('align-right');
			node.serverMemory.classList.add('align-right');
			node.streaming.classList.add('align-right');

			row.append(
				name,
				node.clientCpu,
				node.serverCpu,
				node.clientTime,
				node.serverTime,
				node.clientMemory,
				node.serverMemory,
				node.streaming,
			);

			this.tbodyNode?.appendChild(row);
		}

		return this.resourceNodes[resourceName];
	}

	private deleteResourceNode(resourceName: string) {
		const resourceNode = this.resourceNodes[resourceName];

		if (resourceNode) {
			this.tbodyNode?.removeChild(resourceNode.row);
			delete this.resourceNodes[resourceName];
		}
	}

	private updateScroll() {
		this.scroll.scanDomNode();
	}
}

registerThemingParticipant((theme, collector) => {
	const focusBorderColor = theme.getColor(focusBorder);
	const inputBackgroundColor = theme.getColor(inputBackground);

	if (focusBorderColor) {
		collector.addRule(`
		.fxdk-resmon-widget table thead th {
			border-bottom: solid 1px ${focusBorderColor};
		}
		`);
	}

	if (inputBackgroundColor) {
		collector.addRule(`
		.fxdk-resmon-widget table thead th {
			background-color: ${inputBackgroundColor};
		}
		`);
	}
});