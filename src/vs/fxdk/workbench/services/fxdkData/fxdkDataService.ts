import { Color, RGBA } from "vs/base/common/color";
import { toDisposable, IDisposable } from "vs/base/common/lifecycle";
import { ClientResourceData, GameStates, IFxDKDataServiceBase, ResourceColors, ServerResourceData, StructuredMessage } from "vs/fxdk/browser/glue";
import { rgbForKey } from "vs/fxdk/common/color";
import { registerSingleton } from "vs/platform/instantiation/common/extensions";
import { createDecorator } from "vs/platform/instantiation/common/instantiation";

export class SingleEventEmitter<T> {
	private listeners: Set<(arg: T) => void> = new Set();

	on(listener: (arg: T) => void): IDisposable {
		this.listeners.add(listener);

		return toDisposable(() => this.listeners.delete(listener));
	}

	emit(data: T) {
		this.listeners.forEach((listener) => listener(data));
	}
}

export type IFxDKDataService = IFxDKDataServiceBase;
export const IFxDKDataService = createDecorator<IFxDKDataService>('fxdkDataService');

const resourceColorsCache: Record<string, ResourceColors> = {};
export class FxDKDataService implements IFxDKDataService {
	declare readonly _serviceBrand: undefined;

	public data: { [key: string]: any } = {
		player_ped_pos: [0, 0, 0],
		player_ped_rot: [0, 0, 0],
		player_ped_heading: 0,
	};

	acceptData(data: { key: string, value: any}[] | { key: string, value: any }) {
		if (Array.isArray(data)) {
			data.forEach(({ key, value }) => {
				this.data[key] = value;
			})
		} else {
			this.data[data.key] = data.value;
		}
	}

	private clientResourcesData: ClientResourceData[] = [];
	private serverResourcesData: ServerResourceData[] = [];

	private bufferedServerOutput: string = '';
	private structuredServerMessages: StructuredMessage[] = [];

	private readonly bufferedServerOutputChanged = new SingleEventEmitter<string>();
	public onBufferedServerOutputChanged(cb: (output: string) => void): IDisposable {
		return this.bufferedServerOutputChanged.on(cb);
	}

	private readonly structuredServerMessageReceivedEvent = new SingleEventEmitter<StructuredMessage>();
	public onStructuredServerMessageReceived(cb: (st: StructuredMessage) => void): IDisposable {
		return this.structuredServerMessageReceivedEvent.on(cb);
	}

	private readonly clearAllServerOutputsEvent = new SingleEventEmitter<void>();
	public onClearAllServerOutputs(cb: () => void): IDisposable {
		return this.clearAllServerOutputsEvent.on(cb);
	}

	//#region client-resources-data
	private readonly clientResourcesDataEvent = new SingleEventEmitter<ClientResourceData[]>();
	public onClientResourcesData(cb: (data: ClientResourceData[]) => void): IDisposable {
		return this.clientResourcesDataEvent.on(cb);
	}

	getClientResourcesData(): ClientResourceData[] {
		return this.clientResourcesData;
	}

	setClientResourcesData(data: ClientResourceData[]) {
		this.clientResourcesData = data;

		this.clientResourcesDataEvent.emit(data);
	}
	//#endregion

	//#region server-resources-data
	private readonly serverResourcesDataEvent = new SingleEventEmitter<ServerResourceData[]>();
	public onServerResourcesData(cb: (data: ServerResourceData[]) => void): IDisposable {
		return this.serverResourcesDataEvent.on(cb);
	}

	getServerResourcesData(): ServerResourceData[] {
		return this.serverResourcesData;
	}

	setServerResourcesData(data: ServerResourceData[]) {
		this.serverResourcesData = data;

		this.serverResourcesDataEvent.emit(data);
	}
	//#endregion

	getBufferedServerOutput(): string {
		return this.bufferedServerOutput;
	}

	getStructuredServerMessages(): StructuredMessage[] {
		return this.structuredServerMessages;
	}

	clearAllServerOutputs() {
		this.bufferedServerOutput = '';
		this.structuredServerMessages = [];

		this.clearAllServerOutputsEvent.emit();
	}

	setBufferedServerOutput(output: string) {
		this.bufferedServerOutput = output;
		this.bufferedServerOutputChanged.emit(this.bufferedServerOutput);
	}

	receiveStructuredServerMessage(message: StructuredMessage) {
		this.structuredServerMessages.push(message);
		this.structuredServerMessageReceivedEvent.emit(message);
	}

	private structuredGameMessages: StructuredMessage[] = [];
	private readonly structuredGameMessageReceivedEvent = new SingleEventEmitter<StructuredMessage>();
	public onStructuredGameMessageReceived(cb: (st: StructuredMessage) => void): IDisposable {
		return this.structuredGameMessageReceivedEvent.on(cb);
	}

	private readonly clearGameOutputEvent = new SingleEventEmitter<void>();
	public onClearGameOutput(cb: () => void): IDisposable {
		return this.clearGameOutputEvent.on(cb);
	}

	getStructuredGameMessages(): StructuredMessage[] {
		return this.structuredGameMessages;
	}

	receiveStructuredGameMessage(message: StructuredMessage) {
		this.structuredGameMessages.push(message);
		this.structuredGameMessageReceivedEvent.emit(message);
	}

	clearGameOutput() {
		this.structuredGameMessages = [];
		this.clearGameOutputEvent.emit();
	}

	private fxcodeIsActive = false;
	private fxcodeIsActiveEvent = new SingleEventEmitter<boolean>();
	onFXCodeIsActiveChange(cb: (isActive: boolean) => void): IDisposable {
		return this.fxcodeIsActiveEvent.on(cb);
	}
	setFXCodeIsActive(isActive: boolean) {
		this.fxcodeIsActive = isActive;
		this.fxcodeIsActiveEvent.emit(isActive);
	}
	getFXCodeIsActive(): boolean {
		return this.fxcodeIsActive;
	}

	private gameState = GameStates.NOT_RUNNING;
	private gameStateChangeEvent = new SingleEventEmitter<GameStates>();

	onGameStateChange(cb: (gameState: GameStates) => void): IDisposable {
		return this.gameStateChangeEvent.on(cb);
	}

	getGameState(): GameStates {
		return this.gameState;
	}

	setGameState(gameState: GameStates) {
		this.gameState = gameState;
		this.gameStateChangeEvent.emit(this.gameState);
	}

	getResourceColors(channel: string): ResourceColors {
		resourceColorsCache[channel] ??= computeResourceColors(channel);

		return resourceColorsCache[channel];
	}
}

function computeResourceColors(resourceName: string): ResourceColors {
	const [r, g, b] = rgbForKey(resourceName);

	// Yes, ImGUI uses BGR but who would have known, right
	const color = new Color(new RGBA(b, g, r));
	const contrastRatio = color.getContrastRatio(Color.black);

	const fg = contrastRatio > 3
		? '#000'
		: '#fff';

	return {
		bg: color.toString(),
		bgRaw: color,

		fg,
		fgRaw: Color.fromHex(fg),
	};
}

registerSingleton(IFxDKDataService, FxDKDataService);